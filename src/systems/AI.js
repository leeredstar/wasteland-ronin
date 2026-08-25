/* ============================================================
 * 荒原浪人 systems/AI — 行为决策（有限状态思想）
 * 设计要点：
 *  - think(u)：纯决策 —— 只写 attackTarget/moveTarget/fearT，
 *    不执行移动与攻击（执行留在宿主 update 循环）
 *  - 决策分支：奴隶跟随/逃跑 · 胆怯单位低血逃离 ·
 *    索敌追击 · 卫兵leash · 游荡 · 玩家自动反击
 *  - 随机经 env.rand() 注入（确定性回放基础）
 * 双模式：浏览器挂 WR.AI；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.AI = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var _env = null;
  /** 注入环境：rand/WORLD/validEnemyFor/dist/chestRatio/findNearestHostile/livingSquad/text */
  function attach(env) { _env = env; }

  function e() {
    if (!_env) throw new Error('[AI] 未 attach 环境');
    return _env;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function pointAway(u, fromX, fromY, dist) {
    var ang = Math.atan2(u.y - fromY, (u.x - fromX) || 0.001);
    return {
      x: clamp(u.x + Math.cos(ang) * dist, 40, e().WORLD.w - 40),
      y: clamp(u.y + Math.sin(ang) * dist, 40, e().WORLD.h - 40)
    };
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

  /**
   * 主决策：每个 think 周期调用一次（宿主控制节流）。
   */
  function think(u) {
    var E = e();
    if (u.state === 'down' || u.state === 'dead') return;
    if (u.rescueChannel > 0 || u.bandageChannel > 0) return;

    /* ---- 奴隶：不主动攻击，跟随主人，遇袭逃跑 ---- */
    if (u.faction === 'slave') {
      var sla = u.lastAttacker;
      if (sla && sla.state !== 'dead' && !(sla.body.chest.hp <= 0 || sla.body.head.hp <= 0) &&
          E.dist(u, sla) < 280) {
        u.moveTarget = pointAway(u, sla.x, sla.y, 300);
        u.attackTarget = null;
        return;
      }
      var master = null, md = 1e9;
      var squad = E.livingSquad();
      for (var mi = 0; mi < squad.length; mi++) {
        var dM = E.dist(u, squad[mi]);
        if (dM < md) { md = dM; master = squad[mi]; }
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
      var src = t || u.homePoint || u;
      u.moveTarget = pointAway(u, src.x, src.y, 340);
      u.attackTarget = null;
      u.fearT = 4;
      return;
    }

    /* ---- 索敌 ---- */
    if (!t) t = E.findNearestHostile(u, u.aggro);

    if (t) {
      u.attackTarget = t;
      u.moveTarget = null;
      return;
    }

    /* ---- 卫兵回到岗位 ---- */
    if (u.faction === 'town' && u.homePoint && E.dist(u, u.homePoint) > 340) {
      u.moveTarget = { x: u.homePoint.x, y: u.homePoint.y };
      return;
    }

    /* ---- 玩家单位：没有命令就原地待命，绝不自主游荡 ----
     * （v0.1 起的历史 bug：玩家指令会被随机游荡目标覆盖，
     *   表现为“点了没反应/走着走着改道”。）*/
    if (u.faction === 'player') return;

    /* ---- 游荡（卫兵巡城范围更小） ---- */
    u.wanderT -= E.rand(0.3, 0.5);
    if (u.wanderT <= 0) {
      u.wanderT = E.rand(3, 8);
      var hp = u.homePoint || u;
      var wr = u.faction === 'town' ? 140 : 260;
      u.moveTarget = {
        x: clamp(hp.x + E.rand(-wr, wr), 40, E.WORLD.w - 40),
        y: clamp(hp.y + E.rand(-wr, wr), 40, E.WORLD.h - 40)
      };
    }
  }

  return {
    attach: attach,
    think: think,
    maybeRetaliate: maybeRetaliate
  };
});
