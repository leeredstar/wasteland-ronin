/* ============================================================
 * 荒原浪人 core/Engine — 固定步长主循环（60Hz）
 * 设计要点（kenshi-design-full §六）：
 *  - update 以固定 step 驱动 → 规则确定性，可回放可联机
 *  - render 与逻辑解耦，接收插值系数 alpha ∈ [0,1)
 *  - 无头模式：advanceFrames(n) 直接推进 n 个逻辑帧，
 *    不依赖 requestAnimationFrame —— 供 Node 冒烟/单测使用
 * 双模式：浏览器挂 WR.Engine；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Engine = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function Engine(opts) {
    opts = opts || {};
    this.tickRate = opts.tickRate || 60;            // 逻辑帧率
    this.step = 1 / this.tickRate;                  // 固定步长(秒)
    this.maxFrameTime = opts.maxFrameTime || 0.25;  // 单帧最大补偿(防螺旋死亡)
    this.onUpdate = opts.onUpdate || null;          // fn(step)
    this.onRender = opts.onRender || null;          // fn(alpha)
    this.running = false;
    this.paused = false;
    this.ticks = 0;                                 // 已执行逻辑帧总数
    this._rafId = null;
    this._lastMs = 0;
    this._acc = 0;
  }

  Engine.prototype._now = function () {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  };

  /** 执行一个固定逻辑帧 */
  Engine.prototype.stepOnce = function () {
    if (this.onUpdate) this.onUpdate(this.step);
    this.ticks++;
  };

  /** 无头推进 n 帧（测试/服务器复用） */
  Engine.prototype.advanceFrames = function (n) {
    for (var i = 0; i < n; i++) {
      if (this.paused) break;
      this.stepOnce();
    }
  };

  Engine.prototype._frame = function (nowMs) {
    if (!this.running) return;
    var dt = (nowMs - this._lastMs) / 1000;
    this._lastMs = nowMs;
    if (dt > this.maxFrameTime) dt = this.maxFrameTime;
    if (!this.paused) {
      this._acc += dt;
      var guard = 0;
      while (this._acc >= this.step && guard < 240) {
        this.stepOnce();
        this._acc -= this.step;
        guard++;
      }
    }
    if (this.onRender) this.onRender(this._acc / this.step);
    var self = this;
    this._rafId = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame(function (t) { self._frame(t); })
      : null;
    if (!this._rafId && typeof setTimeout === 'function') {
      this._rafId = setTimeout(function () { self._frame(self._now()); }, 16);
    }
  };

  Engine.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this._lastMs = this._now();
    this._acc = 0;
    var self = this;
    this._rafId = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame(function (t) { self._frame(t); })
      : (typeof setTimeout === 'function'
        ? setTimeout(function () { self._frame(self._now()); }, 16)
        : null);
  };

  Engine.prototype.stop = function () {
    this.running = false;
    if (this._rafId != null) {
      if (typeof cancelAnimationFrame === 'function' && this._rafId.then === undefined && !isNaN(this._rafId)) {
        try { cancelAnimationFrame(this._rafId); } catch (e) {}
      }
      try { clearTimeout(this._rafId); } catch (e) {}
      this._rafId = null;
    }
  };

  return Engine;
});
