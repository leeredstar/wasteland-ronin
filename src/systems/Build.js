/* ============================================================
 * 荒原浪人 systems/Build — 建造系统（合法性判定）
 * 设计要点：几何/规则校验为纯函数；数组与资源的实际增删
 * 由宿主执行（保持单一写入点）。
 * 规则：
 *  - 上限 40 座
 *  - 与既有建筑间距 ≥30、与营地 ≥46
 *  - 城镇内部（60% 半径）禁止建造
 * 双模式：浏览器挂 WR.Build；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Build = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CAP = 40;

  function dist2(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  /**
   * 校验放置。返回 null 表示合法，否则返回拒绝原因字符串。
   * structures/camps 为只读传入数组；townZones 提供 {x,y,r}，
   * r 为绝对禁建半径（由宿主按旧规则换算传入）。
   */
  function validate(structures, camps, townZones, x, y) {
    if (structures.length >= CAP) return '建筑数量达到上限（40）';
    for (var t = 0; t < townZones.length; t++) {
      var tz = townZones[t];
      if (dist2(x, y, tz.x, tz.y) < tz.r * tz.r) return '离城镇太近，守卫不允许你在这里建造';
    }
    for (var s = 0; s < structures.length; s++) {
      if (dist2(x, y, structures[s].x, structures[s].y) < 30 * 30) return '离其他建筑太近';
    }
    for (var c = 0; c < camps.length; c++) {
      if (dist2(x, y, camps[c].x, camps[c].y) < 46 * 46) return '离营地太近';
    }
    return null;
  }

  /** 网格吸附（10px） */
  function snap(v) { return Math.round(v / 10) * 10; }

  return {
    CAP: CAP,
    validate: validate,
    snap: snap
  };
});
