/* ============================================================
 * 荒原浪人 data/mod — 数据覆盖包加载（T095，MOD 基础）
 * 用法一（控制台/调试）：localStorage.setItem('wr_data_overrides',
 *   JSON.stringify({ items: { WEAPONS: { stick: { dmg: 99 } } } }))
 * 用法二（模组脚本）：在 main.js 之前定义 window.WR_DATA_OVERRIDES = {...}
 * 合并规则：深合并；数组与原始值直接替换。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.DataMod = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isPlainObj(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  /** 深合并 src → dst（dst 被修改并返回） */
  function deepMerge(dst, src) {
    Object.keys(src).forEach(function (k) {
      if (isPlainObj(src[k]) && isPlainObj(dst[k])) deepMerge(dst[k], src[k]);
      else dst[k] = src[k];
    });
    return dst;
  }

  /**
   * 把覆盖包应用到各数据表。
   * 返回应用的 section 数。
   */
  function applyOverrides(WR, ov) {
    if (!ov || typeof ov !== 'object') return 0;
    var n = 0;
    if (ov.items && WR.Items) {
      ['CONSUMABLES', 'KITS', 'WEAPONS', 'ARMORS', 'PROSTHETICS'].forEach(function (g) {
        if (ov.items[g]) deepMerge(WR.Items[g], ov.items[g]);
      });
      if (ov.items.all) deepMerge(WR.Items.all, ov.items.all);
      n++;
    }
    if (ov.enemies && WR.Enemies) {
      deepMerge(WR.Enemies.ENEMIES, ov.enemies.ENEMIES || {});
      if (ov.enemies.GUARD) deepMerge(WR.Enemies.GUARD, ov.enemies.GUARD);
      n++;
    }
    if (ov.skills && WR.SkillConfig) { deepMerge(WR.SkillConfig, ov.skills); n++; }
    if (ov.balance && WR.BALANCE) { deepMerge(WR.BALANCE, ov.balance); n++; }
    return n;
  }

  /** 从 localStorage 读取覆盖包（浏览器用） */
  function loadFromStorage() {
    try {
      if (typeof localStorage === 'undefined') return null;
      var raw = localStorage.getItem('wr_data_overrides');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  return {
    isPlainObj: isPlainObj,
    deepMerge: deepMerge,
    applyOverrides: applyOverrides,
    loadFromStorage: loadFromStorage
  };
});
