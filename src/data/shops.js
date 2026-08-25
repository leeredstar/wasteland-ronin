/* ============================================================
 * 荒原浪人 data/shops — 城镇货单（T092 数据驱动）
 * stock 数组按展示顺序引用 src/data/items.js 的物品 id；
 * 特殊条目：'hire'=招募同伴。
 * 新增商品流程：在 items.js 加定义 → 在对应城镇 stock 加 id。完事。
 * 双模式：浏览器挂 WR.Shops；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Shops = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    '枢纽镇': {
      desc: '新手友好的贸易站',
      stock: ['food', 'bandage', 'campkit', 'mats',
              'stick', 'iron', 'spear', 'leather', 'roboLimb', 'hire']
    },
    '世界之角': {
      desc: '边境军火商聚集地',
      stock: ['food', 'bandage', 'mats',
              'iron', 'mace', 'katana', 'chain', 'hire']
    },
    '荒原游商': {
      desc: '荒原流动商队，什么都有一点',
      stock: ['food', 'bandage', 'campkit', 'stick', 'leather', 'hire']
    }
  };
});
