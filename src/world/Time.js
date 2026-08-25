/* ============================================================
 * 荒原浪人 world/Time — 昼夜循环与存活天数
 * 设计要点：
 *  - tod ∈ [0,1)，0 = 午夜；brightness 由余弦曲线给出
 *  - 与现有游戏数值完全一致：DAY_LEN=150s，初始 tod=0.3
 *  - 睡眠时间跳跃 = skipToMorning()
 * 双模式：浏览器挂 WR.Time；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Time = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TAU = Math.PI * 2;

  function create(opts) {
    opts = opts || {};
    return {
      dayLength: opts.dayLength || 150,   // 一天的现实秒数
      tod: opts.startTod != null ? opts.startTod : 0.3,
      day: opts.day || 1
    };
  }

  /** 推进时间。返回 { wrapped } —— wrapped=true 表示跨天（day 已+1） */
  function advance(state, dt) {
    var nt = state.tod + dt / state.dayLength;
    var wrapped = false;
    if (nt >= 1) { nt %= 1; state.day++; wrapped = true; }
    state.tod = nt;
    return { wrapped: wrapped };
  }

  /** 亮度 [0,1]：0 午夜 / 1 正午（与游戏公式一致） */
  function brightness(tod) {
    return 0.5 - 0.5 * Math.cos((tod % 1) * TAU);
  }

  /** 时段：day / dusk / night（阈值与游戏一致） */
  function phase(b) {
    return b > 0.68 ? 'day' : (b > 0.32 ? 'dusk' : 'night');
  }

  /** 夜幕遮罩 alpha：夜晚最深 0.5 */
  function nightAlpha(b) { return (1 - b) * 0.5; }

  /** 黄昏橙色叠加强度（在 b∈(0.3,0.72) 区间呈正弦峰） */
  function duskStrength(b) {
    if (b <= 0.3 || b >= 0.72) return 0;
    return Math.sin(((b - 0.3) / 0.42) * Math.PI) * 0.13;
  }

  /** 睡到天亮：跳到上午 0.30 并跨一天 */
  function skipToMorning(state) {
    state.tod = 0.30;
    state.day++;
    return state;
  }

  return {
    create: create,
    advance: advance,
    brightness: brightness,
    phase: phase,
    nightAlpha: nightAlpha,
    duskStrength: duskStrength,
    skipToMorning: skipToMorning,
    TAU: TAU
  };
});
