/* ============================================================
 * 荒原浪人 data/enemies — 敌人原型表（数据驱动生成）
 * 字段与 Spawner/Actor 对齐：
 *   hp(体格基准) / speed / aggro / weapons[] / loot[min,max] /
 *   faction / armorChance / skills{str,tgh,dodge,melee} /
 *   scale(体型) / isBeast
 * 双模式：浏览器挂 WR.Enemies；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Enemies = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ENEMIES = {
    hungry: {
      key: 'hungry', name: '饥饿强盗', faction: 'hungry',
      hp: 46, speed: 78, aggro: 200,
      weapons: ['fists', 'stick'], loot: [8, 25], lootFoodChance: 0.35,
      armorChance: 0, armor: null,
      skills: { str: 7, tgh: 7, dodge: 6, melee: 6 },
      packSize: [2, 4], fleeAt: 0.28
    },
    bandit: {
      key: 'bandit', name: '强盗', faction: 'bandit',
      hp: 78, speed: 84, aggro: 240,
      weapons: ['stick', 'iron', 'mace'], loot: [20, 60], lootFoodChance: 0.25,
      armorChance: 0.15, armor: 'leather',
      skills: { str: 13, tgh: 12, dodge: 11, melee: 13 },
      packSize: [2, 4], fleeAt: null
    },
    swordmaster: {
      key: 'swordmaster', name: '荒原剑客', faction: 'bandit',
      hp: 118, speed: 90, aggro: 280,
      weapons: ['iron', 'katana', 'spear'], loot: [80, 160],
      armorChance: 0.5, armor: 'leather',
      skills: { str: 17, tgh: 16, dodge: 16, melee: 19 },
      packSize: [2, 4], fleeAt: null
    },
    boss: {
      key: 'boss', name: '强盗头目', faction: 'bandit',
      hp: 160, speed: 88, aggro: 300, scale: 1.18, r: 13,
      weapons: ['katana'], loot: [150, 320], lootFoodChance: 0.4,
      armorChance: 1, armor: 'chain',
      skills: { str: 19, tgh: 18, dodge: 15, melee: 21 },
      packSize: [1, 1], fleeAt: null
    },
    wolf: {
      key: 'wolf', name: '荒原狼', faction: 'beast', isBeast: true,
      hp: 44, speed: 118, aggro: 290,
      weapons: ['bite'], loot: [5, 16], lootFoodChance: 0,
      armorChance: 0, armor: null,
      skills: { str: 10, tgh: 8, dodge: 12, melee: 10 },
      packSize: [2, 3], fleeAt: 0.25
    }
  };

  var GUARD = {
    key: 'guard', name: '城镇卫兵', faction: 'town', tierName: '城镇卫兵',
    hp: 130, speed: 86, aggro: 260,
    weapons: ['iron'], armor: 'leather',
    loot: [30, 70],
    skills: { str: 16, tgh: 15, dodge: 14, melee: 18 }
  };

  /* T141: 区域难度梯度（距枢纽镇距离 → 危险层级断点）
   * 8000×8000 大世界：核心区(<1500)新手友好，中环(<3400)标准，
   * 外环与边缘纵深(≥3400)高危高回报。 */
  var ZONES = [
    { d: 1500, ti: 0 },
    { d: 3400, ti: 1 },
    { d: Infinity, ti: 2 }
  ];

  return { ENEMIES: ENEMIES, GUARD: GUARD, ZONES: ZONES };
});
