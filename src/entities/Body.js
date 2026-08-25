/* ============================================================
 * 荒原浪人 entities/Body — 六部位血量模型（Kenshi 灵魂系统）
 * 设计要点：
 *  - 头/胸/双臂/双腿独立血量；部位状态直接改变行为能力
 *  - 胸归零→倒地流血；头归零→昏迷
 *  - 四肢 HP≤ -50%max → 永久截断('cut')；机械义肢('robo')
 *    血量下限 35%，永不恶化
 * 双模式：浏览器挂 WR.Body；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory(root.WR = root.WR || {});
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR.Body = api; }
})(typeof self !== 'undefined' ? self : this, function (WR) {
  'use strict';

  /* 阈值取自 data/balance.js（加载顺序保证其在前）；独立运行时用兜底 */
  var CB = (WR.BALANCE && WR.BALANCE.COMBAT) || {};
  var SEVER_AT = (CB.SEVER_AT_RATIO != null) ? CB.SEVER_AT_RATIO : -0.5;
  var ROBO_FLOOR = (CB.ROBO_FLOOR_RATIO != null) ? CB.ROBO_FLOOR_RATIO : 0.35;
  var PART_KEYS = ['head', 'chest', 'armL', 'armR', 'legL', 'legR'];
  var LIMB_KEYS = ['armL', 'armR', 'legL', 'legR'];
  var PART_NAMES = { head: '头', chest: '胸', armL: '左臂', armR: '右臂', legL: '左腿', legR: '右腿' };

  /* 部位血量比例系数（以 constitution 为基数） */
  var PART_RATIO = {
    head: 0.40, chest: 0.62,
    armL: 0.34, armR: 0.34,
    legL: 0.38, legR: 0.38
  };

  /** 创建六部位体格。c = 体格基准值（约等于旧 maxHp） */
  function makeBody(c) {
    c = c || 60;
    var body = {};
    for (var i = 0; i < PART_KEYS.length; i++) {
      var k = PART_KEYS[i];
      var max = Math.round(c * PART_RATIO[k]);
      body[k] = { hp: max, max: max };
    }
    return body;
  }

  /** 部位比率 [0..1]，允许负数表示过伤 */
  function ratio(p) { return p.hp / p.max; }
  function chestRatio(body) { return ratio(body.chest); }
  function headRatio(body) { return ratio(body.head); }

  /**
   * 对某部位施加伤害。
   * limbState: 单位的四肢状态表 {armL:'cut'|'robo'|undefined,...}
   * 返回 { severed:bool } —— 本次是否触发了新截断
   */
  function applyDamage(body, limbState, part, dmg) {
    var p = body[part];
    if (!p) throw new Error('[Body] 未知部位: ' + part);
    var res = { severed: false };

    if (limbState[part] === 'robo' && p.hp - dmg < p.max * ROBO_FLOOR) {
      /* 机械义肢：血量下限（balance 可调），永不恶化 */
      p.hp = p.max * ROBO_FLOOR;
    } else {
      p.hp -= dmg;
    }

    if ((part === 'armL' || part === 'armR' || part === 'legL' || part === 'legR') &&
        !limbState[part] && p.hp <= p.max * SEVER_AT) {
      limbState[part] = 'cut';
      res.severed = true;
    }
    return res;
  }

  /** 自然回复单个部位（不超过 max） */
  function regenPart(p, amount) {
    if (p.hp > 0) p.hp = Math.min(p.max, p.hp + amount);
  }

  /**
   * 倒地胸腔结算：正血量缓慢回升（可自然苏醒），负血量流血并部分凝结。
   * 返回 { died:bool } —— chest ≤ -60%max 时 true
   */
  function tickDownedChest(body, dt, bleedRate, clotRate, clotAboveRatio, deathAtRatio) {
    var ch = body.chest;
    if (ch.hp > 0) {
      ch.hp += dt * 1; /* 由调用方传入具体速率时覆盖此行为 */
      return { died: false };
    }
    var clot = ch.hp > -ch.max * clotAboveRatio ? clotRate : 0;
    ch.hp += (clot - bleedRate) * dt;
    return { died: ch.hp <= -ch.max * deathAtRatio };
  }

  /** 苏醒条件：胸 ≥30% 且 头 ≥50% */
  function canWake(body) {
    return body.chest.hp >= body.chest.max * 0.3 &&
           body.head.hp >= body.head.max * 0.5;
  }

  /** 是否倒地判定依据：胸或头归零 */
  function isKO(body) {
    return body.chest.hp <= 0 || body.head.hp <= 0;
  }

  /** UI 快照：各部位 {ratio,state}，state∈ok|hurt|bad|gone|robo|cut */
  function snapshot(body, limbState) {
    var out = {};
    for (var i = 0; i < PART_KEYS.length; i++) {
      var k = PART_KEYS[i];
      var r = ratio(body[k]);
      var st;
      if (limbState && limbState[k] === 'robo') st = r > 0 ? 'robo' : 'gone';
      else if (limbState && limbState[k] === 'cut') st = 'cut';
      else if (r <= 0) st = 'gone';
      else if (r < 0.4) st = 'bad';
      else if (r < 0.7) st = 'hurt';
      else st = 'ok';
      out[k] = { ratio: Math.max(0, Math.min(1, r)), state: st };
    }
    return out;
  }

  /* 部位状态 → 中文文案（M2/T076） */
  var STATE_TEXT = { ok: '完好', hurt: '轻伤', bad: '重伤', gone: '残废', cut: '截断', robo: '机械' };
  function stateText(st) { return STATE_TEXT[st] || ''; }

  return {
    PART_KEYS: PART_KEYS,
    LIMB_KEYS: LIMB_KEYS,
    PART_NAMES: PART_NAMES,
    PART_RATIO: PART_RATIO,
    makeBody: makeBody,
    ratio: ratio,
    chestRatio: chestRatio,
    headRatio: headRatio,
    stateText: stateText,
    applyDamage: applyDamage,
    regenPart: regenPart,
    tickDownedChest: tickDownedChest,
    canWake: canWake,
    isKO: isKO,
    snapshot: snapshot
  };
});
