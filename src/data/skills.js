/* ============================================================
 * 荒原浪人 data/skills — 技能成长参数（数据驱动）
 * 双模式：浏览器挂 WR.SkillConfig；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.SkillConfig = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    XP_FACTOR_DEFAULT: 12,          // need = 当前等级 × 该系数
    MAX_LEVEL: 99,
    LABELS: { str: '力量', tgh: '韧性', dodge: '闪避', melee: '近战' },
    DEFAULTS: { str: 8, tgh: 8, dodge: 8, melee: 8 },
    /* 每次有效行为提供的经验 */
    GAIN: {
      HIT_MELEE: 4, HIT_STR: 2, BEEN_HIT_TGH: 3,
      DODGE_SUCCESS: 3, ATTACKER_ON_DODGE: 1
    }
  };
});
