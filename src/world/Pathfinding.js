/* ============================================================
 * 荒原浪人 world/Pathfinding — 网格 A* 寻路（T160）
 * 设计要点：
 *  - 均匀网格：世界按 cell 划分；isBlocked(cx,cy) 注入判定
 *    （建筑/围墙/大石等碰撞源由宿主映射成格子阻挡）
 *  - 8 方向 + 对角防穿角；开放列表用二叉堆
 *  - 返回像素坐标路径点数组（含终点），失败返回 null
 *  - 纯逻辑零 DOM；确定性（无随机）
 * 双模式：浏览器挂 WR.Pathfinding；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Pathfinding = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------- 二叉堆 ---------------- */
  function Heap() { this.a = []; }
  Heap.prototype.push = function (n) {
    var a = this.a; a.push(n);
    var i = a.length - 1;
    while (i > 0) {
      var p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      var tmp = a[p]; a[p] = a[i]; a[i] = tmp;
      i = p;
    }
  };
  Heap.prototype.pop = function () {
    var a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      var i = 0;
      for (;;) {
        var l = i * 2 + 1, r = l + 1, m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        var t2 = a[m]; a[m] = a[i]; a[i] = t2;
        i = m;
      }
    }
    return top;
  };
  Object.defineProperty(Heap.prototype, 'size', { get: function () { return this.a.length; } });

  /* ---------------- 工厂 ---------------- */
  /**
   * create({ worldW, worldH, cell=40, isBlocked(cx,cy)->bool })
   * isBlocked 接收格索引；宿主负责把建筑/围墙等映射为阻挡。
   */
  function create(opts) {
    opts = opts || {};
    var cell = opts.cell || 40;
    var cols = Math.ceil((opts.worldW || 4000) / cell);
    var rows = Math.ceil((opts.worldH || 4000) / cell);
    var blockedFn = opts.isBlocked || function () { return false; };

    /* 阻挡缓存：惰性计算一次，后续查询 O(1) */
    var blockedGrid = new Array(cols * rows);
    function blocked(cx, cy) {
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return true;
      var k = cy * cols + cx;
      if (blockedGrid[k] === undefined) blockedGrid[k] = blockedFn(cx, cy) ? 1 : 0;
      return blockedGrid[k] === 1;
    }

    /**
     * A* 查路。入参为世界像素坐标；返回 [{x,y}(像素,格中心)] 或 null。
     */
    function findPath(sx, sy, gx, gy, maxIter) {
      maxIter = maxIter || 20000;
      var scx = clampCell(Math.floor(sx / cell), cols);
      var scy = clampCell(Math.floor(sy / cell), rows);
      var gcx = clampCell(Math.floor(gx / cell), cols);
      var gcy = clampCell(Math.floor(gy / cell), rows);

      if (blocked(gcx, gcy)) {
        /* 目标格被挡：螺旋找最近开放格（半径8） */
        var alt = nearestOpen(gcx, gcy, 8);
        if (!alt) return null;
        gcx = alt.cx; gcy = alt.cy;
      }
      if (blocked(scx, scy)) {
        var sAlt = nearestOpen(scx, scy, 8);
        if (!sAlt) return null;
        scx = sAlt.cx; scy = sAlt.cy;
      }

      var open = new Heap();
      var gScore = {}, came = {}, closed = {};
      var sk = scy * cols + scx, gk = gcy * cols + gcx;
      gScore[sk] = 0;
      open.push({ x: scx, y: scy, f: h(scx, scy, gcx, gcy) });

      var DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
                  [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
      var iter = 0, found = false;

      while (open.size && iter++ < maxIter) {
        var cur = open.pop();
        var ck = cur.y * cols + cur.x;
        if (closed[ck]) continue;
        closed[ck] = true;
        if (cur.x === gcx && cur.y === gcy) { found = true; break; }

        for (var d = 0; d < 8; d++) {
          var dx = DIRS[d][0], dy = DIRS[d][1], cost = DIRS[d][2];
          var nx = cur.x + dx, ny = cur.y + dy;
          if (blocked(nx, ny)) continue;
          /* 防穿角：斜向要求两个正交邻格开放 */
          if (dx !== 0 && dy !== 0 &&
              (blocked(cur.x + dx, cur.y) || blocked(cur.x, cur.y + dy))) continue;
          var nk = ny * cols + nx;
          if (closed[nk]) continue;
          var ng = gScore[ck] + cost;
          if (gScore[nk] !== undefined && gScore[nk] <= ng) continue;
          gScore[nk] = ng;
          came[nk] = ck;
          open.push({ x: nx, y: ny, f: ng + h(nx, ny, gcx, gcy) });
        }
      }
      if (!found) return null;

      /* 回溯 → 像素中心点 */
      var out = [];
      var k2 = gk;
      while (k2 !== sk && k2 !== undefined) {
        var cy2 = Math.floor(k2 / cols), cx2 = k2 % cols;
        out.push({ x: cx2 * cell + cell / 2, y: cy2 * cell + cell / 2 });
        k2 = came[k2];
      }
      out.reverse();
      out.push({ x: gx, y: gy });   /* 精确终点 */
      return out;
    }

    function nearestOpen(cx, cy, radius) {
      for (var r = 0; r <= radius; r++) {
        for (var dy = -r; dy <= r; dy++) {
          for (var dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            if (!blocked(cx + dx, cy + dy)) return { cx: cx + dx, cy: cy + dy };
          }
        }
      }
      return null;
    }

    return {
      cell: cell,
      cols: cols,
      rows: rows,
      findPath: findPath,
      blocked: blocked
    };
  }

  function clampCell(v, m) { return v < 0 ? 0 : (v >= m ? m - 1 : v); }
  function h(x, y, gx, gy) {
    var dx = Math.abs(x - gx), dy = Math.abs(y - gy);
    return (dx > dy ? dx + 0.4142 * dy : dy + 0.4142 * dx); /* octile */
  }

  return { create: create };
});
