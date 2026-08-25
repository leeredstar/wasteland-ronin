/* ============================================================
 * 荒原浪人 core/RNG — 可种子化随机数（mulberry32）
 * 设计要点：确定性。同种子 → 同序列；状态可保存/恢复，
 * 为 M10 回放复现与联机 RNG 同步打基础。
 * 双模式：浏览器挂 WR.RNG；Node 环境可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.RNG = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function RNG(seed) {
    this.setSeed(seed == null ? 1 : seed);
  }

  /* mulberry32：内部状态就是一个 uint32（this._a），可直接存取 */
  RNG.prototype.setSeed = function (seed) {
    this._a = ((seed === undefined || seed === null) ? 1 : seed) >>> 0;
    if (this._a === 0) this._a = 1;
  };

  /** [0,1) 均匀分布 */
  RNG.prototype.next = function () {
    this._a = (this._a + 0x6D2B79F5) | 0;
    var t = this._a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
  };

  /** [min,max) 浮点区间 */
  RNG.prototype.range = function (min, max) {
    return min + this.next() * (max - min);
  };

  /** [min,max] 整数（含两端） */
  RNG.prototype.int = function (min, max) {
    return Math.min(max, Math.floor(this.range(min, max + 1)));
  };

  /** 数组均匀取样 */
  RNG.prototype.pick = function (arr) {
    return arr[Math.floor(this.next() * arr.length)];
  };

  /** 加权取样：weights=[w1,w2,...] 返回命中的索引 */
  RNG.prototype.weighted = function (weights) {
    var total = 0, i;
    for (i = 0; i < weights.length; i++) total += weights[i];
    var r = this.next() * total;
    for (i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
    return weights.length - 1;
  };

  /** 保存当前内部状态（uint32 数值） */
  RNG.prototype.getState = function () { return this._a >>> 0; };

  /** 恢复到历史状态点（继续产出相同后续序列） */
  RNG.prototype.setState = function (s) {
    this._a = (s >>> 0) || 1;
  };

  return RNG;
});
