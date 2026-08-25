/* ============================================================
 * 荒原浪人 data/factions — 阵营关系表（数据驱动，可 MOD）
 * 设计要点：
 *  - 友好对清单（排序键）之外的任意组合默认敌对
 *  - 跨阵营语义集中于此，改关系只需编辑本表
 * 双模式：浏览器挂 WR.Factions；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Factions = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FACTIONS = ['player', 'bandit', 'hungry', 'beast', 'town', 'slave'];

  function key(a, b) { return [a, b].sort().join('|'); }

  /* 友好对：同阵营 + 显式跨阵营同盟 */
  var FRIENDLY_PAIR_LIST = [
    ['player', 'player'], ['town', 'town'], ['bandit', 'bandit'],
    ['hungry', 'hungry'], ['beast', 'beast'], ['slave', 'slave'],
    ['player', 'town'],     // 卫兵平时保护玩家（袭击后由动态规则翻脸）
    ['player', 'slave'],    // 奴隶归属玩家
    ['town', 'slave'],      // 城镇容忍奴隶
    ['bandit', 'hungry']    // 匪徒之间互不相残
  ];

  var FRIENDLY = new Set(FRIENDLY_PAIR_LIST.map(function (p) { return key(p[0], p[1]); }));

  /** 静态判定：是否属于"天然友好"对 */
  function isFriendlyPair(a, b) { return FRIENDLY.has(key(a, b)); }

  return {
    FACTIONS: FACTIONS,
    FRIENDLY_PAIR_LIST: FRIENDLY_PAIR_LIST,
    FRIENDLY: FRIENDLY,
    isFriendlyPair: isFriendlyPair,
    pairKey: key
  };
});
