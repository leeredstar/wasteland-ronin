/* ============================================================
 * 荒原浪人 data/validate — 数据表校验器（T096）
 * 纯函数：返回错误字符串数组（空数组 = 通过）。
 * 双模式：浏览器挂 WR.Validate；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Validate = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TYPES = ['consumable', 'weapon', 'armor', 'material', 'kit', 'prosthetic'];

  function validateItem(def) {
    var errs = [];
    if (!def) return ['定义为空'];
    if (!def.id) errs.push('缺少 id');
    if (!def.name) errs.push('缺少 name');
    if (TYPES.indexOf(def.type) < 0) errs.push('未知 type: ' + def.type);
    if (!(typeof def.price === 'number' && def.price >= 0)) errs.push('price 必须为非负数字');
    if (def.type === 'weapon') {
      if (!(def.dmg > 0)) errs.push('武器 dmg 必须 > 0');
      if (!(def.reach > 0)) errs.push('武器 reach 必须 > 0');
      if (!(def.speed > 0)) errs.push('武器 speed 必须 > 0');
      if (typeof def.power !== 'number') errs.push('武器缺少 power');
    }
    if (def.type === 'armor' && !(typeof def.def === 'number' && def.def >= 0)) {
      errs.push('护甲 def 必须为非负数字');
    }
    return errs;
  }

  /** 校验整张物品表：重复 id / 单项错误聚合 */
  function validateItems(itemsMap) {
    var errs = [];
    var seen = {};
    Object.keys(itemsMap).forEach(function (k) {
      var d = itemsMap[k];
      if (seen[d.id]) errs.push('重复 id: ' + d.id);
      seen[d.id] = true;
      validateItem(d).forEach(function (e2) { errs.push('[' + k + '] ' + e2); });
    });
    return errs;
  }

  /** 敌人原型校验 */
  function validateEnemy(e) {
    var errs = [];
    if (!e) return ['定义为空'];
    if (!(e.hp > 0)) errs.push('hp 必须 > 0');
    if (!(e.speed > 0)) errs.push('speed 必须 > 0');
    if (!e.skills || !(e.skills.melee >= 0)) errs.push('缺少 skills');
    if (!e.weapons || !e.weapons.length) errs.push('缺少武器列表');
    if (!(e.loot && e.loot.length === 2 && e.loot[0] <= e.loot[1])) errs.push('loot 区间非法');
    return errs;
  }

  function validateEnemies(map) {
    var errs = [];
    Object.keys(map).forEach(function (k) {
      validateEnemy(map[k]).forEach(function (e2) { errs.push('[' + k + '] ' + e2); });
    });
    return errs;
  }

  return {
    TYPES: TYPES,
    validateItem: validateItem,
    validateItems: validateItems,
    validateEnemy: validateEnemy,
    validateEnemies: validateEnemies
  };
});
