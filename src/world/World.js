/* ============================================================
 * 荒原浪人 world/World — 实体容器 + 空间哈希网格
 * 设计要点（kenshi-design-full §三/§五.5）：
 *  - 统一实体容器：id 自增、增删查 O(1)
 *  - 空间哈希网格（默认 cell=100）：把邻近查询从 O(n²)
 *    降到近似 O(k)，供分离推挤/索敌/AI 视野使用
 *  - 纯逻辑无渲染依赖；坐标约定与现有游戏一致（x,y 世界平面）
 * 双模式：浏览器挂 WR.World；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.World = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function World(opts) {
    opts = opts || {};
    this.cellSize = opts.cellSize || 100;
    this.entities = new Map();   // id -> entity（要求实体有数字 x,y）
    this._grid = new Map();      // "cx,cy" -> Array<entity>
    this._nextId = 1;
  }

  World.prototype._key = function (cx, cy) { return cx + ',' + cy; };

  /* ---------- 增 ---------- */
  /** 加入实体；可指定 id（存档恢复用），否则自增 */
  World.prototype.add = function (e) {
    if (typeof e.x !== 'number' || typeof e.y !== 'number') {
      throw new Error('[World] 实体必须含数字 x,y：' + (e && e.id));
    }
    if (e.id == null) {
      while (this.entities.has(this._nextId)) this._nextId++;
      e.id = this._nextId++;
    } else {
      if (this.entities.has(e.id)) throw new Error('[World] id 已存在: ' + e.id);
      if (e.id >= this._nextId) this._nextId = e.id + 1;
    }
    this.entities.set(e.id, e);
    this._gridInsert(e);
    return e;
  };

  World.prototype._gridInsert = function (e) {
    var cs = this.cellSize;
    var key = this._key(Math.floor(e.x / cs), Math.floor(e.y / cs));
    e._wcell = key;
    var arr = this._grid.get(key);
    if (!arr) { arr = []; this._grid.set(key, arr); }
    arr.push(e);
  };

  World.prototype._gridRemove = function (e) {
    if (!e._wcell) return;
    var arr = this._grid.get(e._wcell);
    if (arr) {
      var i = arr.indexOf(e);
      if (i >= 0) arr.splice(i, 1);
      if (arr.length === 0) this._grid.delete(e._wcell);
    }
    e._wcell = null;
  };

  /* ---------- 删 / 查 ---------- */
  World.prototype.remove = function (e) {
    if (!e || !this.entities.has(e.id)) return false;
    this._gridRemove(e);
    this.entities.delete(e.id);
    return true;
  };

  World.prototype.get = function (id) { return this.entities.get(id); };

  World.prototype.count = function () { return this.entities.size; };

  /* ---------- 移动后同步网格归属（每帧对移动过的实体调用一次） ---------- */
  World.prototype.syncPosition = function (e) {
    var cs = this.cellSize;
    var nk = this._key(Math.floor(e.x / cs), Math.floor(e.y / cs));
    if (e._wcell !== nk) {
      this._gridRemove(e);
      this._gridInsert(e);
    }
  };

  /* ---------- 邻近查询 ---------- */
  /**
   * 圆形查询：返回所有与圆 (x,y,r) 相交格内、且实际距离 ≤ r 的实体。
   * out 可选复用数组（热路径零分配友好）。
   */
  World.prototype.queryCircle = function (x, y, r, out) {
    out = out || [];
    var cs = this.cellSize;
    var x0 = Math.floor((x - r) / cs), x1 = Math.floor((x + r) / cs);
    var y0 = Math.floor((y - r) / cs), y1 = Math.floor((y + r) / cs);
    var r2 = r * r;
    for (var cy = y0; cy <= y1; cy++) {
      for (var cx = x0; cx <= x1; cx++) {
        var arr = this._grid.get(this._key(cx, cy));
        if (!arr) continue;
        for (var i = 0; i < arr.length; i++) {
          var e = arr[i];
          var dx = e.x - x, dy = e.y - y;
          if (dx * dx + dy * dy <= r2) out.push(e);
        }
      }
    }
    return out;
  };

  /** 矩形查询：[x,y]~[x+w,y+h]，含边界 */
  World.prototype.queryRect = function (x, y, w, h, out) {
    out = out || [];
    var cs = this.cellSize;
    var x0 = Math.floor(x / cs), x1 = Math.floor((x + w) / cs);
    var y0 = Math.floor(y / cs), y1 = Math.floor((y + h) / cs);
    for (var cy = y0; cy <= y1; cy++) {
      for (var cx = x0; cx <= x1; cx++) {
        var arr = this._grid.get(this._key(cx, cy));
        if (!arr) continue;
        for (var i = 0; i < arr.length; i++) {
          var e = arr[i];
          if (e.x >= x && e.x <= x + w && e.y >= y && e.y <= y + h) out.push(e);
        }
      }
    }
    return out;
  };

  World.prototype.clear = function () {
    this.entities.clear();
    this._grid.clear();
    this._nextId = 1;
  };

  return World;
});
