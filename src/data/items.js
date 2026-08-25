/* ============================================================
 * 荒原浪人 data/items — 物品定义表（唯一事实源，可 MOD 覆盖）
 * Schema:
 *   id      : 唯一键
 *   name    : 显示名
 *   type    : consumable | weapon | armor | material | kit
 *   price   : 基准价（猫）—— 商店最终价经声望折扣换算
 *   stack   : 最大堆叠
 *   icon    : emoji 表现层皮肤
 *   ---- type=weapon ----
 *   dmg / reach / speed / power
 *   ---- type=armor ----
 *   def     : 固定减伤
 *   ---- type=consumable ----
 *   use     : 'food' | 'bandage'
 * 双模式：浏览器挂 WR.Items；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Items = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CONSUMABLES = {
    food:    { id: 'food',    name: '干粮',     type: 'consumable', price: 25, stack: 20, icon: '🍖', use: 'food' },
    bandage: { id: 'bandage', name: '绷带',     type: 'consumable', price: 23, stack: 20, icon: '🩹', use: 'bandage' }
  };

  var KITS = {
    campkit: { id: 'campkit', name: '营地套装', type: 'kit',      price: 80,  stack: 5, icon: '🏕️' },
    mats:    { id: 'mats',    name: '建筑材料', type: 'material', price: 20,  stack: 50, icon: '🧱' }
  };

  var WEAPONS = {
    fists:  { id: 'fists',  key: 'fists',  name: '拳头',   type: 'weapon', price: 0,
              dmg: 6,  reach: 26, speed: 1.05, power: 0, icon: '✊' },
    stick:  { id: 'stick',  key: 'stick',  name: '木棍',   type: 'weapon', price: 15,
              dmg: 9,  reach: 32, speed: 0.95, power: 1, icon: '🪵' },
    iron:   { id: 'iron',   key: 'iron',   name: '铁刀',   type: 'weapon', price: 180,
              dmg: 14, reach: 34, speed: 0.85, power: 2, icon: '🗡️' },
    spear:  { id: 'spear',  key: 'spear',  name: '长枪',   type: 'weapon', price: 230,
              dmg: 12, reach: 50, speed: 0.80, power: 2, icon: '🔱' },
    mace:   { id: 'mace',   key: 'mace',   name: '战锤',   type: 'weapon', price: 270,
              dmg: 18, reach: 30, speed: 0.62, power: 2, icon: '🔨' },
    katana: { id: 'katana', key: 'katana', name: '野太刀', type: 'weapon', price: 650,
              dmg: 22, reach: 40, speed: 0.72, power: 3, icon: '⚔️' },
    bite:   { id: 'bite',   key: 'bite',   name: '獠牙',   type: 'weapon', price: 0,
              dmg: 8,  reach: 24, speed: 1.25, power: 0, icon: '🐺' }
  };

  var ARMORS = {
    leather: { id: 'leather', key: 'leather', name: '破旧皮甲', type: 'armor', price: 130,
               def: 2, stack: 1, icon: '🧥' },
    chain:   { id: 'chain',   key: 'chain',   name: '锁子甲',   type: 'armor', price: 430,
               def: 4, stack: 1, icon: '🛡️' }
  };

  var PROSTHETICS = {
    roboLimb: { id: 'roboLimb', name: '机械义肢', type: 'prosthetic', price: 300,
                stack: 1, icon: '🦾', strBonus: 2 }
  };

  /* ---------- 汇总视图 ---------- */
  var all = {};
  [CONSUMABLES, KITS, WEAPONS, ARMORS, PROSTHETICS].forEach(function (group) {
    Object.keys(group).forEach(function (k) { all[k] = group[k]; });
  });

  function get(id) { return all[id] || null; }
  function weapons() { return WEAPONS; }
  function armors() { return ARMORS; }

  return {
    CONSUMABLES: CONSUMABLES,
    KITS: KITS,
    WEAPONS: WEAPONS,
    ARMORS: ARMORS,
    PROSTHETICS: PROSTHETICS,
    all: all,
    get: get,
    weapons: weapons,
    armors: armors
  };
});
