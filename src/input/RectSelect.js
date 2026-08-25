/* ============================================================
 * 荒原浪人 input/RectSelect — 框选纯函数
 * 双模式：浏览器挂 WR.RectSelect；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.RectSelect = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * 从 units 中筛选位于规范化矩形内的实体（世界坐标）。
   * 返回新数组；不修改输入。
   */
  function collect(units, x1, y1, x2, y2) {
    var minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    var minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    var out = [];
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      if (u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY) out.push(u);
    }
    return out;
  }

  return { collect: collect };
});
