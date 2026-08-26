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

      /* T162: 视线捷径裁剪（string pulling 简化版） */
      if (opts.smooth !== false) out = smoothPath(out, walkable);
      return out;
    }

    /* T162: 沿线采样可走性，逐步剪掉可直达的中间路径点 */
    function smoothPath(pts, walkFn) {
      if (!pts || pts.length < 3) return pts;
      var res2 = [pts[0]];
      var i = 0;
      while (i < pts.length - 1) {
        var j = pts.length - 1;
        for (; j > i + 1; j--) {
          if (segClear(pts[i], pts[j], walkFn)) break;
        }
        res2.push(pts[j]);
        i = j;
      }
      return res2;
    }
    function segClear(a, b, walkFn) {
      var d = Math.hypot(b.x - a.x, b.y - a.y);
      var steps = Math.max(2, Math.ceil(d / (cell / 2)));
      for (var s2 = 1; s2 <= steps; s2++) {
        var t3 = s2 / steps;
        if (!walkFn(a.x + (b.x - a.x) * t3, a.y + (b.y - a.y) * t3)) return false;
      }
      return true;
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

    /* 可走性查询（平滑用）：默认=所在格未阻挡；宿主可注入更细粒度 */
    var walkable = opts.walkable || function (px, py) {
      return !blocked(Math.floor(px / cell), Math.floor(py / cell));
    };

    return {
      cell: cell,
      cols: cols,
      rows: rows,
      findPath: findPath,
      blocked: blocked,
      smoothPath: smoothPath
    };
  }

  function clampCell(v, m) { return v < 0 ? 0 : (v >= m ? m - 1 : v); }
  function h(x, y, gx, gy) {
    var dx = Math.abs(x - gx), dy = Math.abs(y - gy);
    return (dx > dy ? dx + 0.4142 * dy : dy + 0.4142 * dx); /* octile */
  }

  /* ---------------- T161: 寻路请求节流规划器 ---------------- */
  /**
   * createPlanner({ pf, cooldown=0.5, now=fn(秒) })
   * 同一 key 在冷却期内、起终点近似不变时复用上次路径。
   */
  function createPlanner(opts) {
    opts = opts || {};
    var pf = opts.pf;
    var cd = opts.cooldown != null ? opts.cooldown : 0.5;
    var now = opts.now || function () { return Date.now() / 1000; };
    var last = {};
    return {
      /** 返回 {path, cached}；冷却期内同目的地返回缓存 */
      request: function (key, sx, sy, gx, gy) {
        var t = now();
        var c = last[key];
        if (c && (t - c.t) < cd &&
            Math.abs(c.gx - gx) < 8 && Math.abs(c.gy - gy) < 8 &&
            Math.abs(c.sx - sx) < 24 && Math.abs(c.sy - sy) < 24) {
          return { path: c.path, cached: true };
        }
        var path = pf.findPath(sx, sy, gx, gy);
        last[key] = { t: t, sx: sx, sy: sy, gx: gx, gy: gy, path: path };
        return { path: path, cached: false };
      },
      reset: function () { last = {}; }
    };
  }

  return { create: create, createPlanner: createPlanner };
});
