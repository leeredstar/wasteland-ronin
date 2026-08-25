/* ============================================================
 * 荒原浪人 systems/Economy — 经济系统扩展（M4）
 * 新增：招募递增定价 / 供需浮动 / 卖出结算
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.EconomyExt = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** 招募费用：基础 250，每多一人 +25%（四舍五入到十位） */
  function recruitCost(currentSquad) {
    var base = 250;
    var cost = Math.round(base * (1 + 0.25 * Math.max(0, currentSquad - 1)));
    return Math.round(cost / 10) * 10;
  }

  /**
   * 供需浮动：销量计数影响 ±15%。
   * salesCount: 该物品累计购买次数；base: 物品基准价。
   * 公式: base * (1 + min(0.15, salesCount * 0.01))
   */
  function supplyPrice(base, salesCount) {
    return Math.max(1, Math.round(base * (1 + Math.min(0.15, (salesCount || 0) * 0.01))));
  }

  /**
   * 卖出结算：战利品/多余装备以半价回收。
   * 返回 { ok, cats } —— ok=false 表示无法卖出。
   */
  function sellItem(res, itemId, qty, priceMap) {
    var def = priceMap && priceMap[itemId];
    if (!def || def.price <= 0) return { ok: false, cats: 0 };
    var cats = Math.max(1, Math.round(def.price * 0.5)) * (qty || 1);
    res.cats += cats;
    return { ok: true, cats: cats };
  }

  return {
    recruitCost: recruitCost,
    supplyPrice: supplyPrice,
    sellItem: sellItem
  };
});
