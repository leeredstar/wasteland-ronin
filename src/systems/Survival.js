/* ============================================================
 * 荒原浪人 systems/Survival — 生存系统（纯逻辑）
 * 覆盖：饥饿衰减/进食 · 倒地流血与苏醒 · 绷带 · 救助通道
 * 数值集中在 SURV 表；表现副作用经 attach(env) 注入。
 * 双模式：浏览器挂 WR.Survival；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory(root.WR = root.WR || {});
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR.Survival = api; }
})(typeof self !== 'undefined' ? self : this, function (WR) {
  'use strict';

  var BodyMod = WR.Body || (typeof require !== 'undefined' ? require('../entities/Body.js') : null);

  var FALLBACK_SURV = {
    HUNGER_DECAY_PER_SEC: 100 / 420,
    HUNGER_WARN_AT: 25,
    STARVE_CHEST_DPS: 2,
    EAT_RESTORE: 45,
    EAT_MAX: 98,
    DOWN_REGEN_CPS: 1.2,
    DOWN_HEAD_REGEN_POS: 0.9,
    DOWN_HEAD_REGEN_NEG: 0.3,
    DOWN_CHEST_REGEN_POS: 0.6,
    BLEED_RATE: 0.55,
    CLOT_RATE: 0.32,
    CLOT_ABOVE_RATIO: 0.3,     // chest.hp > -max*此值 时才凝结
    DEATH_AT_RATIO: 0.6,       // 流血至 -60% 死亡
    WAKE_CHEST: 0.3,
    WAKE_HEAD: 0.5,
    RESCUE_TIME: 2.5,
    RESCUE_START_RANGE: 46,
    RESCUE_KEEP_RANGE: 55,
    RESCUE_CHEST_TO: 0.33,
    RESCUE_HEAD_TO: 0.6,
    BANDAGE_TIME: 2.2,
    BANDAGE_HEAL_TO: 0.7,
    NATURAL_REGEN: 0.55,
    CAMP_REGEN_MULT: 3,
    CAMP_REGEN_RADIUS: 150
  };

  /* 唯一事实源：src/data/balance.js 的 SURVIVAL 段；此处仅独立运行兜底 */
  var SURV = (WR.BALANCE && WR.BALANCE.SURVIVAL) ? WR.BALANCE.SURVIVAL : FALLBACK_SURV;

  var _env = null;
  /**
   * env = {
   *   log, text, sfx,
   *   knockDown(attackerNull,unit,part),
   *   getSelection(), getUnits(),
   *   canAct(u),
   *   camps()            -> 营地数组（回复光环）
   *   dist(a,b)
   * }
   */
  function attach(env) { _env = env; }
  function e() {
    if (!_env) throw new Error('[Survival] 未 attach 环境');
    return _env;
  }

  /* ---------------- 饥饿 ---------------- */
  /** 返回 true 表示单位已因饥饿倒地，调用方应立即 return */
  function hungerTick(u, dt) {
    if (u.faction !== 'player') return false;
    var E = e();
    u.hunger = Math.max(0, u.hunger - dt * SURV.HUNGER_DECAY_PER_SEC);
    if (u.hunger < SURV.HUNGER_WARN_AT && u.hunger > 0 && !u.hungWarned) {
      u.hungWarned = true;
      E.log(u.name + ' 快饿晕了，按 F 进食！', 'bad');
    }
    if (u.hunger >= SURV.HUNGER_WARN_AT) u.hungWarned = false;
    if (u.hunger <= 0) {
      u.body.chest.hp -= dt * SURV.STARVE_CHEST_DPS;
      if (u.body.chest.hp <= 0) { E.knockDown(null, u, 'chest'); return true; }
    }
    return false;
  }

  /* ---------------- 倒地状态（流血/凝结/苏醒/死亡） ---------------- */
  /** 返回 { died, woke } */
  function tickDowned(u, dt) {
    var ch = u.body.chest, hd = u.body.head;
    if (ch.hp > 0) {
      hd.hp += dt * SURV.DOWN_HEAD_REGEN_POS;
      ch.hp += dt * SURV.DOWN_CHEST_REGEN_POS;
    } else {
      var clot = ch.hp > -ch.max * SURV.CLOT_ABOVE_RATIO ? SURV.CLOT_RATE : 0;
      ch.hp += (clot - SURV.BLEED_RATE) * dt;
      hd.hp += dt * SURV.DOWN_HEAD_REGEN_NEG;
    }
    var died = ch.hp <= -ch.max * SURV.DEATH_AT_RATIO;
    var woke = !died &&
      ch.hp >= ch.max * SURV.WAKE_CHEST &&
      hd.hp >= hd.max * SURV.WAKE_HEAD;
    return { died: died, woke: woke };
  }

  /* ---------------- 救助通道 ---------------- */
  /** 返回 true 表示本帧被通道占用（调用方 return） */
  function tickRescue(u, dt, hooks) {
    if (u.rescueChannel <= 0) return false;
    var rt = u.rescueTarget;
    var E = e();
    if (!rt || rt.state !== 'down' || E.dist(u, rt) > SURV.RESCUE_KEEP_RANGE) {
      u.rescueChannel = 0; u.rescueTarget = null;
      return true;
    }
    u.rescueChannel -= dt;
    if (u.rescueChannel <= 0) {
      rt.body.chest.hp = Math.max(rt.body.chest.hp, rt.body.chest.max * SURV.RESCUE_CHEST_TO);
      rt.body.head.hp = Math.max(rt.body.head.hp, rt.body.head.max * SURV.RESCUE_HEAD_TO);
      E.log(u.name + ' 救起了 ' + rt.name, 'good');
      E.text(rt.x, rt.y - 30, '获救', '#9fe07a');
      E.sfx('heal');
      if (hooks && hooks.done) hooks.done(rt);
    }
    return true;
  }

  /** 发起救助（R） */
  function tryRescue() {
    var E = e();
    var sel = E.getSelection();
    var units = E.getUnits();
    for (var i = 0; i < sel.length; i++) {
      var u = sel[i];
      if (!E.canAct(u)) continue;
      for (var j = 0; j < units.length; j++) {
        var t = units[j];
        if (t.faction === 'player' && t.state === 'down' && E.dist(u, t) < SURV.RESCUE_START_RANGE) {
          u.rescueChannel = SURV.RESCUE_TIME;
          u.rescueTarget = t;
          u.moveTarget = null;
          u.attackTarget = null;
          E.log(u.name + ' 正在救助 ' + t.name + '……', 'sys');
          return;
        }
      }
    }
    E.log('附近没有倒地的队友（走近倒地的队友按 R）', 'sys');
  }

  /* ---------------- 包扎通道 ---------------- */
  /** 返回 true 表示占用；完成时自动结算治疗 */
  function tickBandage(u, dt) {
    if (u.rescueChannel > 0) return true; /* 救助中不可同时包扎 */
    if (u.bandageChannel <= 0) return false;
    u.bandageChannel -= dt;
    if (u.bandageChannel <= 0) {
      for (var p = 0; p < BodyMod.PART_KEYS.length; p++) {
        var pp = u.body[BodyMod.PART_KEYS[p]];
        pp.hp = Math.min(pp.max, Math.max(pp.hp, pp.max * SURV.BANDAGE_HEAL_TO));
      }
      e().log(u.name + ' 处理好了伤口', 'good');
      e().text(u.x, u.y - 30, '包扎完毕', '#9fe07a');
      e().sfx('heal');
    }
    return true;
  }

  /** 发起包扎（C）：需要绷带且有部位低于 70% */
  function tryBandage(res, selectionArr, logFn) {
    if (res.bandage <= 0) { logFn('没有绷带了！城镇有售（🩹 2 卷 45 猫）', 'bad'); return; }
    for (var i = 0; i < selectionArr.length; i++) {
      var u = selectionArr[i];
      if (!e().canAct(u)) continue;
      for (var p = 0; p < BodyMod.PART_KEYS.length; p++) {
        var pp = u.body[BodyMod.PART_KEYS[p]];
        if (pp.hp / pp.max < SURV.BANDAGE_HEAL_TO) {
          res.bandage--;
          u.bandageChannel = SURV.BANDAGE_TIME;
          u.moveTarget = null;
          u.attackTarget = null;
          logFn(u.name + ' 开始包扎伤口……', 'sys');
          return;
        }
      }
    }
    logFn('选中的人没有需要包扎的伤口', 'sys');
  }

  /* ---------------- 进食（F） ---------------- */
  function tryEat(getSelection, res, logFn) {
    var sel = getSelection();
    for (var i = 0; i < sel.length; i++) {
      var u = sel[i];
      if (!e().canAct(u)) continue;
      if (u.hunger >= SURV.EAT_MAX) { logFn(u.name + ' 现在很饱', 'sys'); return; }
      if (res.food <= 0) { logFn('没有干粮了！去城镇补给', 'bad'); return; }
      res.food--;
      u.hunger = Math.min(100, u.hunger + SURV.EAT_RESTORE);
      e().text(u.x, u.y - 26, '吃了一口', '#e8b45a');
      e().sfx('eat');
      return;
    }
    logFn('先选择一个能行动的队员（F 进食）', 'sys');
  }

  /* ---------------- 睡眠恢复结算（时间跳跃后的体力恢复） ---------------- */
  /** 对每个存活玩家：各部位至少回复 45%max，饥饿 -18 */
  function applySleepRecovery(unitsList) {
    var healed = 0;
    for (var i = 0; i < unitsList.length; i++) {
      var u = unitsList[i];
      if (u.faction !== 'player' || u.state === 'dead' || u.state === 'down') continue;
      for (var p = 0; p < BodyMod.PART_KEYS.length; p++) {
        var pp = u.body[BodyMod.PART_KEYS[p]];
        pp.hp = Math.min(pp.max, Math.max(pp.hp, pp.hp + pp.max * SURV.SLEEP_HEAL_RATIO));
      }
      u.hunger = Math.max(5, u.hunger - SURV.SLEEP_HUNGER_COST);
      u.combatT = 0;
      healed++;
    }
    return healed;
  }

  /* ---------------- 脱战自然回复（营地光环加速） ---------------- */
  function naturalRegen(u, camps, dist, dt) {
    var rate = SURV.NATURAL_REGEN;
    for (var c = 0; c < camps.length; c++) {
      if (dist(u, camps[c]) < SURV.CAMP_REGEN_RADIUS) { rate *= SURV.CAMP_REGEN_MULT; break; }
    }
    for (var i = 0; i < BodyMod.PART_KEYS.length; i++) {
      var p = u.body[BodyMod.PART_KEYS[i]];
      if (p.hp > 0) p.hp = Math.min(p.max, p.hp + dt * rate);
    }
  }

  return {
    SURV: SURV,
    attach: attach,
    hungerTick: hungerTick,
    tickDowned: tickDowned,
    tickRescue: tickRescue,
    tryRescue: tryRescue,
    tickBandage: tickBandage,
    tryBandage: tryBandage,
    tryEat: tryEat,
    applySleepRecovery: applySleepRecovery,
    naturalRegen: naturalRegen
  };
});
