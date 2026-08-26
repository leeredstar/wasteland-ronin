/* ============================================================
 * 荒原浪人 data/barks — 敌人台词表（T179，纯表现层）
 * 触发时机由宿主控制：遭遇(encounter)/逃跑(flee)/死亡(death)
 * MOD：直接改写本表即可换台词。
 * 双模式：浏览器挂 WR.Barks；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Barks = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    encounter: [
      '这条路上没人能活着走过去！',
      '把粮食和猫币交出来！',
      '嘿嘿，又送上门一个。',
      '兄弟们，开饭了！',
      '你的刀不错，人也不错——死了都是我的。'
    ],
    flee: [
      '撤！先撤！',
      '打不过打不过……',
      '这单亏大了，跑！',
      '下次再跟你算账！'
    ],
    death: [
      '呃啊……',
      '荒原……收下了我……',
      '母亲……对不起……',
      '值了……哈哈……'
    ]
  };
});
