/* ============================================================
 * 荒原浪人 input/Camera — 相机（跟随/平移/缩放/边界钳制/坐标换算）
 * 数值语义与现有游戏完全一致（zoom 默认 1.15，范围 0.6~1.8）。
 * 双模式：浏览器挂 WR.Camera；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Camera = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function create(opts) {
    opts = opts || {};
    return {
      x: opts.x || 0,
      y: opts.y || 0,
      zoom: opts.zoom != null ? opts.zoom : 1.15,
      minZoom: opts.minZoom != null ? opts.minZoom : 0.6,
      maxZoom: opts.maxZoom != null ? opts.maxZoom : 1.8,
      world: opts.world || { w: 4000, h: 4000 },
      vw: opts.viewportW || 1280,   // 视口宽(CSS px)
      vh: opts.viewportH || 800
    };
  }

  function setViewport(cam, w, h) { cam.vw = w; cam.vh = h; }

  /** 边界钳制：世界小于视口时居中不钳 */
  function clampCam(cam) {
    var hw = cam.vw / (2 * cam.zoom), hh = cam.vh / (2 * cam.zoom);
    if (hw * 2 < cam.world.w) cam.x = clamp(cam.x, hw, cam.world.w - hw);
    if (hh * 2 < cam.world.h) cam.y = clamp(cam.y, hh, cam.world.h - hh);
  }

  /** 平移（像素单位，已含缩放补偿由调用方决定；此处按世界坐标平移） */
  function panBy(cam, dx, dy) {
    cam.x += dx; cam.y += dy;
    clampCam(cam);
  }

  /**
   * 跟随目标点：指数趋近（k=min(1, dt*strength)），与游戏一致 strength=3
   * 返回是否发生了移动
   */
  function follow(cam, tx, ty, dt, strength) {
    var k = Math.min(1, (dt || 0) * (strength || 3));
    var nx = cam.x + (tx - cam.x) * k;
    var ny = cam.y + (ty - cam.y) * k;
    var moved = Math.abs(nx - cam.x) > 1e-9 || Math.abs(ny - cam.y) > 1e-9;
    cam.x = nx; cam.y = ny;
    clampCam(cam);
    return moved;
  }

  /** 屏幕坐标 → 世界坐标 */
  function screenToWorld(cam, mx, my) {
    return {
      x: cam.x + (mx - cam.vw / 2) / cam.zoom,
      y: cam.y + (my - cam.vh / 2) / cam.zoom
    };
  }

  /** 世界坐标 → 屏幕坐标 */
  function worldToScreen(cam, wx, wy) {
    return {
      x: (wx - cam.x) * cam.zoom + cam.vw / 2,
      y: (wy - cam.y) * cam.zoom + cam.vh / 2
    };
  }

  /**
   * 光标锚定缩放：保持光标下的世界点不动（与游戏滚轮行为一致）
   * factor>1 放大，<1 缩小
   */
  function zoomAt(cam, mx, my, factor) {
    var nz = clamp(cam.zoom * factor, cam.minZoom, cam.maxZoom);
    var before = screenToWorld(cam, mx, my);
    cam.zoom = nz;
    var after = screenToWorld(cam, mx, my);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
    clampCam(cam);
  }

  /** 视口世界尺寸（渲染裁剪用） */
  function viewSize(cam) {
    return { w: cam.vw / cam.zoom, h: cam.vh / cam.zoom };
  }

  return {
    create: create,
    setViewport: setViewport,
    clampCam: clampCam,
    panBy: panBy,
    follow: follow,
    screenToWorld: screenToWorld,
    worldToScreen: worldToScreen,
    zoomAt: zoomAt,
    viewSize: viewSize
  };
});
