/* ============================================================
 * 荒原浪人 input/Input — 输入意图队列
 * 设计要点：
 *  - 平台事件只负责「翻译」为意图(intent)入队；
 *    游戏逻辑每帧 consumeIntents() 后统一处理。
 *  - 好处：输入与逻辑解耦 → 联机时指令可直接走网络，
 *    回放系统只需录制意图序列（M10/M17 的地基）。
 * 意图类型：
 *  select      {point,shift}        点选（左键短按）
 *  boxSelect   {x0,y0,x1,y1,shift}   拖拽框选
 *  command     {screen:{x,y},right}  右键=移动/攻击；左键空地移动(由逻辑层区分)
 *  key         {code}                功能键意图
 *  zoom        {mx,my,factor}
 * 双模式：浏览器挂 WR.Input；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Input = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** 拖拽判定阈值：位移² > 64 视为框选而非点选 */
  var DRAG_SQ = 64;

  function InputState() {
    this.queue = [];
    this.keys = Object.create(null);
    this.mouse = { x: 0, y: 0 };
    this._down = null;      // 左键按下起点 {x,y}
    this.dragging = false;
  }

  function push(st, intent) { st.queue.push(intent); }

  /** 键盘按下：持续键记入 keys 表，功能键翻译为一次性意图 */
  InputState.prototype.keyDown = function (code) {
    this.keys[code] = true;
    switch (code) {
      case 'Space': push(this, { type: 'stop' }); break;
      case 'Tab': push(this, { type: 'selectAll' }); break;
      case 'KeyE': push(this, { type: 'key', code: code }); break;
      case 'KeyF': push(this, { type: 'key', code: code }); break;
      case 'KeyR': push(this, { type: 'key', code: code }); break;
      case 'KeyC': push(this, { type: 'key', code: code }); break;
      case 'KeyV': push(this, { type: 'key', code: code }); break;
      case 'KeyZ': push(this, { type: 'key', code: code }); break;
      case 'KeyX': push(this, { type: 'key', code: code }); break;
      case 'KeyB': push(this, { type: 'key', code: code }); break;
      case 'KeyT': push(this, { type: 'key', code: code }); break;
      case 'KeyG': push(this, { type: 'key', code: code }); break;
      case 'KeyH': push(this, { type: 'key', code: code }); break;
      case 'KeyM': push(this, { type: 'key', code: code }); break;
      case 'Escape': push(this, { type: 'escape' }); break;
      default:
        if (/^Digit[1-5]$/.test(code)) push(this, { type: 'selectSlot', slot: +code.slice(5) });
        /* WASD/方向键不平推意图：按住状态由 keys 表供相机每帧读取 */
    }
  };

  InputState.prototype.keyUp = function (code) { this.keys[code] = false; };

  InputState.prototype.mouseMove = function (x, y) { this.mouse.x = x; this.mouse.y = y; };

  InputState.prototype.mouseDown = function (button, x, y) {
    this.mouse.x = x; this.mouse.y = y;
    if (button === 0) { this._down = { x: x, y: y }; this.dragging = true; }
    else if (button === 2) {
      push(this, { type: 'command', screen: { x: x, y: y }, right: true });
    }
  };

  InputState.prototype.mouseUp = function (button, x, y, shift) {
    this.mouse.x = x; this.mouse.y = y;
    if (button !== 0 || !this.dragging) return;
    this.dragging = false;
    var d0 = this._down;
    this._down = null;
    if (!d0) return;
    var dx = x - d0.x, dy = y - d0.y;
    if (dx * dx + dy * dy > DRAG_SQ) {
      push(this, { type: 'boxSelect', x0: d0.x, y0: d0.y, x1: x, y1: y, shift: !!shift });
    } else {
      /* 左键点选：点中队员→选择；点空地→同样发出 command(right:false)
       * 由逻辑层决定「选中 or 移动」，与 v0.3.1 行为一致 */
      push(this, { type: 'command', screen: { x: x, y: y }, right: false });
    }
  };

  InputState.prototype.wheel = function (deltaY, x, y) {
    push(this, { type: 'zoom', mx: x, my: y, factor: deltaY < 0 ? 1.12 : 0.89 });
  };

  /** 取出并清空本帧全部意图 */
  InputState.prototype.consumeIntents = function () {
    var q = this.queue;
    this.queue = [];
    return q;
  };

  InputState.prototype.clearKeys = function () { this.keys = Object.create(null); };

  return {
    create: function () { return new InputState(); },
    DRAG_SQ: DRAG_SQ
  };
});
