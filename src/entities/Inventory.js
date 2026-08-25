/* ============================================================
 * 荒原浪人 entities/Inventory — 背包与装备
 * 设计要点：
 *  - 物品格子按 itemId 堆叠（stackMax 可配）
 *  - 装备槽独立于背包：weapon / armor / bag 容量
 *  - 纯容器逻辑；价格/效果读取交给 data/items 表（M3）
 * 双模式：浏览器挂 WR.Inventory；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Inventory = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EQUIP_SLOTS = ['weapon', 'armor'];

  /** 创建背包。slots=格位数，stackMax=每格最大堆叠 */
  function create(slots, stackMax) {
    return {
      slots: slots || 12,
      stackMax: stackMax || 10,
      items: [],            // [{id:'food', qty:n}]
      equipped: {}          // slotName -> itemRef/id
    };
  }

  function count(inv, itemId) {
    var n = 0;
    for (var i = 0; i < inv.items.length; i++) {
      if (inv.items[i].id === itemId) n += inv.items[i].qty;
    }
    return n;
  }

  function has(inv, itemId, qty) {
    return count(inv, itemId) >= (qty || 1);
  }

  /**
   * 添加物品。返回实际放入数量（背包满时剩余放不下）。
   */
  function add(inv, itemId, qty) {
    qty = qty || 1;
    var left = qty;
    // 先填已有堆
    for (var i = 0; i < inv.items.length && left > 0; i++) {
      var it = inv.items[i];
      if (it.id === itemId && it.qty < inv.stackMax) {
        var take = Math.min(inv.stackMax - it.qty, left);
        it.qty += take; left -= take;
      }
    }
    // 再开新格
    while (left > 0 && inv.items.length < inv.slots) {
      var put = Math.min(inv.stackMax, left);
      inv.items.push({ id: itemId, qty: put });
      left -= put;
    }
    return qty - left;
  }

  /**
   * 移除物品。返回实际移除数量（不足时移除全部持有）。
   */
  function remove(inv, itemId, qty) {
    qty = qty || 1;
    var left = Math.min(qty, count(inv, itemId));
    var removed = left;
    for (var i = inv.items.length - 1; i >= 0 && left > 0; i--) {
      var it = inv.items[i];
      if (it.id !== itemId) continue;
      var take = Math.min(it.qty, left);
      it.qty -= take; left -= take;
      if (it.qty <= 0) inv.items.splice(i, 1);
    }
    return removed;
  }

  /** 装备到槽位；返回被替换下来的旧装备（无则 null） */
  function equip(inv, slot, itemRef) {
    if (EQUIP_SLOTS.indexOf(slot) < 0) throw new Error('[Inventory] 未知槽位: ' + slot);
    var old = inv.equipped[slot] || null;
    inv.equipped[slot] = itemRef;
    return old;
  }

  function unequip(inv, slot) {
    var old = inv.equipped[slot] || null;
    inv.equipped[slot] = null;
    return old;
  }

  function isFull(inv) { return inv.items.length >= inv.slots; }

  return {
    EQUIP_SLOTS: EQUIP_SLOTS,
    create: create,
    count: count,
    has: has,
    add: add,
    remove: remove,
    equip: equip,
    unequip: unequip,
    isFull: isFull
  };
});
