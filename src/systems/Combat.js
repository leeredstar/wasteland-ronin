/* ============================================================
 * 荒原浪人 systems/Combat — 战斗系统（纯逻辑）
 * 设计要点：
 *  - 全部公式/常量集中在 BALANCE，数值调参不改代码
 *  - 表现副作用通过 attach(env) 注入的端口回调发出，
 *    本模块零 DOM 依赖 → 可无头单测、可在服务器运行
 *  - 随机只使用 env.rng() 提供的种子实例（确定性回放基础）
 *  - 部位伤害委托 entities/Body（robo 下限 / 截断判定）
 * 双模式：浏览器挂 WR.Combat；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory(root.WR = root.WR || {});
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR.Combat = api; }
})(typeof self !== 'undefined' ? self : this, function (WR) {
  'use strict';

  var BodyMod = WR.Body || (typeof require !== 'undefined' ? require('../entities/Body.js') : null);

  /* ---------------- 数值平衡表 ----------------
   * 唯一事实源：src/data/balance.js（WR.BALANCE.COMBAT）。
   * 下方 FALLBACK 仅用于本模块被单独 require 的测试环境。 */
  var FALLBACK_BALANCE = {
    SWING_TIME: 0.22,
    DODGE_BASE: 0.04,
    DODGE_PER_DIFF: 0.012,
    DODGE_MIN: 0.03,
    DODGE_MAX: 0.42,
    DMG_STR_COEF: 0.028,
    DMG_RAND_MIN: 0.85,
    DMG_RAND_MAX: 1.15,
    ARM_MULT_BASE: 0.6,
    ARM_MULT_PER: 0.2,
    SEVER_AT_RATIO: -0.5,
    ROBO_FLOOR_RATIO: 0.35,
    XP: {
      HIT_ATTACKER_MELEE: 4,
      HIT_ATTACKER_STR: 2,
      HIT_VICTIM_TGH: 3,
      DODGE_VICTIM: 3,
      DODGE_ATTACKER: 1
    },
    PART_WEIGHTS: [
      ['chest', 0.38], ['head', 0.15],
      ['armR', 0.15], ['armL', 0.15],
      ['legL', 0.085], ['legR', 0.085]
    ],
    KNOCKDOWN_DUST: 6,
    SHAKE_ON_PLAYER_HIT: 1.0,
    SHAKE_MAX: 5,
    COMBAT_T_ON_HIT: 4,
    BLEED_DEATH_RATIO: 0.6
  };

  var BALANCE = (WR.BALANCE && WR.BALANCE.COMBAT) ? WR.BALANCE.COMBAT : FALLBACK_BALANCE;

  var _env = null;
  /** 注入输出端口与随机源（游戏启动时调用一次） */
  function attach(env) { _env = env; }

  function rng() { return _env.rng(); }
  function out() { return _env.out; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /** 加权随机选部位 */
  function pickPart(r) {
    r = r || rng();
    var roll = r.next();
    var acc = 0;
    for (var i = 0; i < BALANCE.PART_WEIGHTS.length; i++) {
      acc += BALANCE.PART_WEIGHTS[i][1];
      if (roll < acc) return BALANCE.PART_WEIGHTS[i][0];
    }
    return 'chest';
  }

  /** 闪避概率（仅由双方技能差决定） */
  function dodgeChance(aMelee, dDodge) {
    return clamp(BALANCE.DODGE_BASE + (dDodge - aMelee) * BALANCE.DODGE_PER_DIFF,
                 BALANCE.DODGE_MIN, BALANCE.DODGE_MAX);
  }

  /** 伤害掷值：含力量系数、双臂可用度、浮动；不含护甲 */
  function rollRawDamage(weaponDmg, str, armsUsable, r) {
    r = r || rng();
    var mult = BALANCE.ARM_MULT_BASE + BALANCE.ARM_MULT_PER * armsUsable;
    return weaponDmg * (0.75 + str * BALANCE.DMG_STR_COEF) *
           (r.range(BALANCE.DMG_RAND_MIN, BALANCE.DMG_RAND_MAX)) * mult;
  }

  /** 最终伤害：取整后减护甲，至少 1 点 */
  function finalDamage(raw, armorDef) {
    return Math.max(1, Math.round(raw) - (armorDef || 0));
  }

  /* ============================================================
   * 主流程：攻击者 a 对防御者 d 的一次完整攻击尝试
   * ============================================================ */
  function tryHit(a, d) {
    if (!_env) throw new Error('[Combat] 未 attach 环境');
    var O = out();

    a.swingT = BALANCE.SWING_TIME;
    O.sfx('swing');

    // 闪避判定
    var dc = dodgeChance(a.skills.melee, d.skills.dodge);
    if (rng().next() < dc) {
      O.text(d.x, d.y - 24, '闪避', '#9fd8ff');
      O.gainXp(d, 'dodge', BALANCE.XP.DODGE_VICTIM);
      O.gainXp(a, 'melee', BALANCE.XP.DODGE_ATTACKER);
      return { dodged: true, dmg: 0 };
    }

    // 伤害结算
    var au = armsUsableCount(a);
    var raw = rollRawDamage(a.weapon.dmg, a.skills.str, au);
    var dmg = finalDamage(raw, d.armor ? d.armor.def : 0);
    var part = pickPart();

    var applied = BodyMod.applyDamage(d.body, d.limbState, part, dmg);
    d.lastAttacker = a;
    d.combatT = BALANCE.COMBAT_T_ON_HIT;
    a.combatT = BALANCE.COMBAT_T_ON_HIT;

    // 表现
    O.blood(d);
    O.spark(d.x, d.y);
    O.text(d.x, d.y - 24, '-' + dmg + ' ' + (BodyMod.PART_NAMES[part]), '#ff9a80');
    O.gainXp(a, 'melee', BALANCE.XP.HIT_ATTACKER_MELEE);
    O.gainXp(a, 'str', BALANCE.XP.HIT_ATTACKER_STR);
    O.gainXp(d, 'tgh', BALANCE.XP.HIT_VICTIM_TGH);
    O.sfx('hit');
    if (a.faction === 'player' || d.faction === 'player') {
      O.shake(BALANCE.SHAKE_ON_PLAYER_HIT, BALANCE.SHAKE_MAX);
    }

    // 截断播报（Body 已写入状态）
    if (applied.severed) {
      O.blood(d); O.blood(d);
      O.decal(d.x, d.y, 8 + rng().next() * 4);
      if (d.faction === 'player') {
        O.log(d.name + ' 的' + BodyMod.PART_NAMES[part] + '被斩断了！去城镇装机械义肢', 'bad');
      } else if (a.faction === 'player') {
        O.log('你斩断了敌人的' + BodyMod.PART_NAMES[part] + '！', 'gold');
      }
    }

    // 打城镇的人 → 声望受损 + 卫兵翻脸（由宿主环境处理全局状态）
    if (a.faction === 'player' && d.faction === 'town') {
      O.hurtTownRep(d);
    }

    // 击倒判定
    var ko = false;
    if (d.body.chest.hp <= 0 || d.body.head.hp <= 0) {
      knockDown(a, d, part);
      ko = true;
    }
    return { dodged: false, dmg: dmg, part: part, severed: applied.severed, knockedDown: ko };
  }

  function armsUsableCount(a) {
    return (a.body.armL.hp > 0 ? 1 : 0) + (a.body.armR.hp > 0 ? 1 : 0);
  }

  /* ============================================================
   * 击倒：进入倒地流血状态
   * ============================================================ */
  function knockDown(attacker, d, part) {
    if (d.state === 'down' || d.state === 'dead') return;
    d.state = 'down';
    d.attackTarget = null;
    d.moveTarget = null;
    d.rescueChannel = 0;
    d.rescueTarget = null;
    d.bandageChannel = 0;
    d.fallT = 0;
    d.poolT = 0;

    var O = out();
    O.decal(d.x, d.y, 10 + rng().next() * 6);
    O.dustBurst(d.x, d.y);
    O.dropLoot(d);
    O.clearTargetsOf(d);

    var how = part === 'head' ? '打晕' : '击倒';
    if (d.faction === 'player') {
      if (attacker) O.log(d.name + ' 被 ' + attacker.name + how + '了！快去救助（靠近按 R）', 'bad');
      else O.log(d.name + ' 倒下了！需要救助（靠近按 R）', 'bad');
    } else if (attacker && attacker.faction === 'player') {
      O.log(how + '了 ' + d.name + '（' + (d.tierName || '敌人') + '）', 'gold');
      O.sfx('coin');
    } else if (d.faction === 'beast') {
      O.log('一头' + d.tierName + '被放倒了', 'sys');
    }
    O.sfx('death');

    // 在城镇附近击倒匪徒 → 声望提升
    if (attacker && attacker.faction === 'player' &&
        (d.faction === 'bandit' || d.faction === 'hungry')) {
      O.gainTownRep(attacker, d.x, d.y, 1);
    }
  }

  /* ============================================================
   * 死亡
   * ============================================================ */
  function die(u) {
    if (u.state === 'dead') return;
    u.state = 'dead';
    u.deadT = 0;
    u.fallT = Math.max(u.fallT || 0, 1);

    var O = out();
    O.decal(u.x, u.y, 14 + rng().next() * 8);
    O.dropLoot(u);
    O.clearTargetsOf(u);
    O.removeFromSelection(u);
    if (u.faction === 'player') O.log(u.name + ' 死在了荒原上……', 'bad');
  }

  /* ============================================================
   * T034 攻击管线：每帧对持有目标的单位调用。
   * 射程判定 / 朝向 / 冷却（含双臂可用度修正）/ 挥击触发 /
   * 追击移动 全部收敛于此。hooks 注入宿主能力。
   * ============================================================ */
  function stepAttack(a, tgt, dt, hooks) {
    var dd = hooks.dist(a, tgt);
    var range = a.weapon.reach + a.r * a.scale + tgt.r * tgt.scale;
    if (dd <= range) {
      a.face = Math.atan2(tgt.y - a.y, tgt.x - a.x);
      var au = (a.body.armL.hp > 0 ? 1 : 0) + (a.body.armR.hp > 0 ? 1 : 0);
      a.cool -= dt * (0.55 + 0.225 * au);
      if (a.cool <= 0) {
        a.cool = 1.4 / a.weapon.speed;
        hooks.tryHit(a, tgt);
        return { acted: 'hit' };
      }
      return { acted: 'windup' };
    }
    hooks.moveToward(a, tgt.x, tgt.y, dt);
    return { acted: 'chase' };
  }

  return {
    BALANCE: BALANCE,
    attach: attach,
    pickPart: pickPart,
    dodgeChance: dodgeChance,
    rollRawDamage: rollRawDamage,
    finalDamage: finalDamage,
    tryHit: tryHit,
    knockDown: knockDown,
    die: die,
    stepAttack: stepAttack
  };
});
