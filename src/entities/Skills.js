/* ============================================================
 * 荒原浪人 entities/Skills — 技能成长（随用随涨）
 * 设计要点：使用即训练。经验阈值 = 当前等级 × K（默认 12）。
 * 支持修正器（义肢力量+2 等走 bonus，不污染基础值）。
 * 双模式：浏览器挂 WR.Skills；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Skills = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEYS = ['str', 'tgh', 'dodge', 'melee'];
  var LABELS = { str: '力量', tgh: '韧性', dodge: '闪避', melee: '近战' };
  var XP_FACTOR_DEFAULT = 12; // need = level * K

  /** 创建技能状态：base={str,tgh,dodge,melee} */
  function create(base) {
    base = base || {};
    var s = {
      skills: {},
      xp: {},
      bonus: {},          // 修正器：义肢等永久加成
      xpFactor: XP_FACTOR_DEFAULT,
      maxLevel: Infinity
    };
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      s.skills[k] = base[k] != null ? base[k] : 1;
      s.xp[k] = 0;
    }
    return s;
  }

  function need(skills, key, factor) {
    return Math.max(1, skills[key]) * (factor || XP_FACTOR_DEFAULT);
  }

  /** 含修正器的有效值 */
  function effective(state, key) {
    return state.skills[key] + (state.bonus[key] || 0);
  }

  /**
   * 增加经验。返回：
   * { leveled:bool, key:key, level:newLevel } —— leveled 时 level 为新等级
   * 注意：一次调用最多升一级（amt 超额部分保留继续累积）
   */
  function gain(state, key, amount, onLevelUp) {
    state.xp[key] += amount;
    var needV = need(state.skills, key, state.xpFactor);
    if (state.xp[key] >= needV && state.skills[key] < state.maxLevel) {
      state.xp[key] -= needV;
      state.skills[key]++;
      if (onLevelUp) onLevelUp(key, state.skills[key]);
      return { leveled: true, key: key, level: state.skills[key] };
    }
    return { leveled: false, key: key, level: state.skills[key] };
  }

  /** 永久修正器（如机械义肢 str+2） */
  function addBonus(state, key, amt) { state.bonus[key] = (state.bonus[key] || 0) + amt; }

  return { KEYS: KEYS, LABELS: LABELS, create: create, need: need, effective: effective, gain: gain, addBonus: addBonus };
});
