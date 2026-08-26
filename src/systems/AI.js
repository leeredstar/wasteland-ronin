/* ============================================================
 * 荒原浪人 systems/AI — 决策核心（M6/T153-T156 状态机标注化）
 * 设计要点：
 *  - 行为算法与 legacy v0.4 think() 逐字等价（迁移零行为差），
 *    在每个决策出口标注 STATES 枚举，形成可观测状态机（T153）
 *  - T154: BALANCE.AI.DEBUG 开启时，每次状态切换经 env.trace 记录
 *  - T155: visionMul(bright) 统一昼夜视野系数（宿主索敌调用）
 *  - T156: 唯一行为增量——追击者远离地盘(homePoint)超过
 *    CHASE_GIVE_UP 时放弃目标回家；其余分支与旧行为一致
 *  - 随机经 env.rand() 注入（确定性回放基础）
 * 双模式：浏览器挂 WR.AI；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory(root.WR = root.WR || {});
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR.AI = api; }
})(typeof self !== 'undefined' ? self : this, function (WR) {
  'use strict';

  /* ---------------- 状态枚举（T153） ---------------- */
  var STATES = {
    IDLE: 'idle',       // 待命/无输出（玩家无命令、决策间隙）
    WANDER: 'wander',   // 游荡：设置漫游目标点
    CHASE: 'chase',     // 锁定目标交战
    FLEE: 'flee',       // 低血/遇袭逃跑
    LEASH: 'leash',     // 回岗（卫兵离岗 / T156 远离地盘放弃追击）
    FOLLOW: 'follow',   // 奴隶跟随主人
    CARRY: 'carry',     // T164 奴隶搬运：走向附近掉落物
    STAY: 'stay'        // T165 奴隶驻守：留守营地篝火
  };

  /* ---------------- 环境 ---------------- */
  var _env = null;
  /** 注入环境：
   *  rand/WORLD/validEnemyFor/dist/chestRatio/findNearestHostile/
   *  livingSquad/text/brightness(0..1)/balance(BALANCE.AI)/trace(fn) */
  function attach(env) { _env = env; }
  function e() {
    if (!_env) throw new Error('[AI] 未 attach 环境');
    return _env;
  }
  function aiCfg() {
    return (e().balance) || {
      CHASE_GIVE_UP: 620, GUARD_LEASH: 340, NIGHT_VISION_MIN: 0.6,
      WANDER_TOWN_R: 140, WANDER_WILD_R: 260, DEBUG: false
    };
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function pointAway(u, fromX, fromY, dist) {
    var ang = Math.atan2(u.y - fromY, (u.x - fromX) || 0.001);
    return {
      x: clamp(u.x + Math.cos(ang) * dist, 40, e().WORLD.w - 40),
      y: clamp(u.y + Math.sin(ang) * dist, 40, e().WORLD.h - 40)
    };
  }

  /* ---------------- T155: 昼夜视野系数 ---------------- */
  function visionMul(bright) {
    var min = aiCfg().NIGHT_VISION_MIN;
    if (typeof bright !== 'number' || isNaN(bright)) bright = 1;
    return min + (1 - min) * clamp(bright, 0, 1);
  }

  /* ---------------- T154: 迁移追踪 ---------------- */
  function setState(u, st) {
    if (u._aiState !== st) {
      var cfg = aiCfg();
      if (cfg.DEBUG && e().trace) e().trace({ name: u.name, faction: u.faction, from: u._aiState || '-', to: st });
      u._aiState = st;
    }
  }

  /**
   * 主决策（T153）：行为与 legacy 逐字等价；每个出口标注状态。
   * 宿主每决策周期调用一次。
   */
  function think(u) {
    var E = e(), cfg = aiCfg();
    if (u.state === 'down' || u.state === 'dead') { setState(u, STATES.IDLE); return; }
    if (u.rescueChannel > 0 || u.bandageChannel > 0) return;

    /* ---- 奴隶：不主动攻击，跟随主人，遇袭逃跑 ---- */
    if (u.faction === 'slave') {
      var sla = u.lastAttacker;
      if (sla && sla.state !== 'dead' &&
          !(sla.body.chest.hp <= 0 || sla.body.head.hp <= 0) &&
          E.dist(u, sla) < 280) {
        setState(u, STATES.FLEE);
        u.moveTarget = pointAway(u, sla.x, sla.y, 300);
        u.attackTarget = null;
        return;
      }

      /* T165 驻守态：被指派留守营地的奴隶原地看守 */
      if (u.stayAt) {
        setState(u, STATES.STAY);
        if (E.dist(u, u.stayAt) > 42) {
          u.moveTarget = { x: u.stayAt.x + E.rand(-14, 14), y: u.stayAt.y + E.rand(-14, 14) };
        } else {
          u.moveTarget = null;
        }
        return;
      }

      setState(u, STATES.FOLLOW);
      var master = null, md = 1e9;
      var squad = E.livingSquad();
      for (var mi = 0; mi < squad.length; mi++) {
        var dM = E.dist(u, squad[mi]);
        if (dM < md) { md = dM; master = squad[mi]; }
      }
      /* T164 搬运态：附近有掉落物时优先去捡（拾取由宿主 pickups 统一结算） */
      if (E.nearestLoot) {
        var lt = E.nearestLoot(u);
        if (lt) {
          setState(u, STATES.CARRY);
          u.moveTarget = { x: lt.x, y: lt.y };
          return;
        }
      }
      if (master && md > 170) {
        u.moveTarget = { x: master.x + E.rand(-50, 50), y: master.y + E.rand(-50, 50) };
      }
      return;
    }

    /* ---- 目标有效性校验 ---- */
    var t = u.attackTarget;
    if (t && !E.validEnemyFor(u, t)) { t = null; u.attackTarget = null; }

    /* ---- 低血量逃跑：饥饿强盗与野兽 ---- */
    var coward = (u.faction === 'hungry' || u.faction === 'beast');
    if (coward && u.fearT <= 0 && E.chestRatio(u) < 0.28) {
      setState(u, STATES.FLEE);
      if (!u._barkFled) {
        u._barkFled = true;
        if (E.bark && u.faction === 'hungry') E.bark(u, 'flee');
      }
      var src = t || u.homePoint || u;
      u.moveTarget = pointAway(u, src.x, src.y, 340);
      u.attackTarget = null;
      u.fearT = 4;
      return;
    }

    /* ---- 索敌 ---- */
    if (!t) t = E.findNearestHostile(u, u.aggro);

    if (t) {
      /* T156 唯一行为增量：远离地盘则放弃追击 */
      if (u.homePoint && E.dist(u.homePoint, u) > cfg.CHASE_GIVE_UP) {
        setState(u, STATES.LEASH);
        u.attackTarget = null;
        u.moveTarget = { x: u.homePoint.x, y: u.homePoint.y };
        return;
      }
      setState(u, STATES.CHASE);
      u.attackTarget = t;
      u.moveTarget = null;
      /* T179 遭遇台词：每次接敌最多喊一次 */
      if (!u._barkEngage && E.bark && (u.faction === 'bandit' || u.faction === 'hungry')) {
        u._barkEngage = true;
        if (E.rand() < 0.6) E.bark(u, 'encounter');
      }
      return;
    }

    /* 脱战/无目标：重置台词标记 */
    u._barkEngage = false;
    if (u.fearT <= 0) u._barkFled = false;

    /* ---- 卫兵回到岗位 ---- */
    if (u.faction === 'town' && u.homePoint && E.dist(u, u.homePoint) > cfg.GUARD_LEASH) {
      setState(u, STATES.LEASH);
      u.moveTarget = { x: u.homePoint.x, y: u.homePoint.y };
      return;
    }

    /* ---- 玩家单位：没有命令就原地待命，绝不自主游荡 ---- */
    if (u.faction === 'player') { setState(u, STATES.IDLE); return; }

    /* ---- 游荡（卫兵巡城范围更小） ---- */
    u.wanderT -= E.rand(0.3, 0.5);
    if (u.wanderT <= 0) {
      setState(u, STATES.WANDER);
      u.wanderT = E.rand(3, 8);
      var hp = u.homePoint || u;
      var wr = u.faction === 'town' ? cfg.WANDER_TOWN_R : cfg.WANDER_WILD_R;
      u.moveTarget = {
        x: clamp(hp.x + E.rand(-wr, wr), 40, E.WORLD.w - 40),
        y: clamp(hp.y + E.rand(-wr, wr), 40, E.WORLD.h - 40)
      };
    } else {
      setState(u, STATES.IDLE);
    }
  }

  /**
   * 自动反击：玩家单位空闲且被打时，锁定攻击者。
   * 返回是否触发。
   */
  function maybeRetaliate(u, autoDefendEnabled) {
    if (!autoDefendEnabled) return false;
    if (u.faction !== 'player') return false;
    if (u.state === 'down' || u.state === 'dead') return false;
    if (u.attackTarget || u.moveTarget) return false;
    var la = u.lastAttacker;
    if (!la) return false;
    var E = e();
    if (!E.validEnemyFor(u, la)) return false;
    if (E.dist(u, la) >= 340) return false;
    u.attackTarget = la;
    if (E.text) E.text(u.x, u.y - 30, '反击!', '#ffd0a0');
    return true;
  }

  return {
    STATES: STATES,
    attach: attach,
    think: think,
    maybeRetaliate: maybeRetaliate,
    visionMul: visionMul,
    /* T175 诱饵选择（纯函数，便于单测）：范围内最近肉块或 null */
    pickBait: function (u, baits, range, distFn) {
      var dfn = distFn || e().dist;
      var best = null, bd = range;
      for (var i = 0; i < baits.length; i++) {
        var d = dfn(u, baits[i]);
        if (d < bd) { bd = d; best = baits[i]; }
      }
      return best;
    },
    config: aiCfg       /* 单测用：当前配置视图 */
  };
});
