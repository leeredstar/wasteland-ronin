/* ============================================================
 * 荒原浪人 core/EventBus — 轻量事件总线
 * 系统间解耦：逻辑系统发事件，UI/音频/网络订阅。
 * 双模式：浏览器挂 WR.EventBus 工厂；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.EventBus = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function EventBus() {
    this._map = Object.create(null); // event -> Array<fn>
    this._once = Object.create(null); // event -> Set<fn>(弱标记)
  }

  /** 订阅；返回取消订阅函数 */
  EventBus.prototype.on = function (event, fn) {
    if (!this._map[event]) this._map[event] = [];
    var list = this._map[event];
    list.push(fn);
    var self = this;
    return function off() { self.off(event, fn); };
  };

  /** 一次性订阅 */
  EventBus.prototype.once = function (event, fn) {
    var off = this.on(event, function wrapper(payload) {
      off();
      fn(payload);
    });
    return off;
  };

  /** 取消订阅 */
  EventBus.prototype.off = function (event, fn) {
    var list = this._map[event];
    if (!list) return;
    var i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
    if (list.length === 0) delete this._map[event];
  };

  /** 发布：依次同步调用所有订阅者；监听器异常不阻断其他监听器 */
  EventBus.prototype.emit = function (event, payload) {
    var list = this._map[event];
    if (!list) return 0;
    var snapshot = list.slice(); // 防止遍历中增删
    for (var i = 0; i < snapshot.length; i++) {
      try { snapshot[i](payload); }
      catch (err) {
        if (typeof console !== 'undefined') console.error('[EventBus]', event, err);
      }
    }
    return snapshot.length;
  };

  /** 清空全部（测试用） */
  EventBus.prototype.clear = function () { this._map = Object.create(null); };

  return EventBus;
});
