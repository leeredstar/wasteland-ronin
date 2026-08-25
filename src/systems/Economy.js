/* ============================================================
 * 荒原浪人 systems/Economy — 经济（定价/声望折扣/购买结算）
 * 设计要点：
 *  - 折扣由城镇声望驱动：≥25 → 85折，≥12 → 92折
 *  - spend() 是唯一扣款入口：余额校验 + 原子扣除
 *    （联机后此函数即服务器权威结算点）
 * 双模式：浏览器挂 WR.Economy；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Economy = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function discountFor(rep) {
    return rep >= 25 ? 0.85 : (rep >= 12 ? 0.92 : 1);
  }

  /** 由声望与基准价计算最终价 */
  function price(rep, base) {
    return Math.max(1, Math.round(base * discountFor(rep)));
  }

  /**
   * 扣款结算。res = {cats,...}（可读写引用）。
   * 返回 { ok:bool, cost } —— 失败时不做任何修改。
   */
  function spend(res, cost) {
    if (res.cats < cost) return { ok: false, cost: cost };
    res.cats -= cost;
    return { ok: true, cost: cost };
  }

  /* ---------- 义肢安装（T077）----------
   * 找到第一个缺失/截断的四肢（臂优先），标记 robo 并把血量抬到下限。
   * 力量加成由宿主经 Skills 修正器追加（本模块不依赖 Skills）。
   * 返回安装的部位 key，无可用部位返回 null。
   */
  function installProsthetic(u) {
    var slots = ['armL', 'armR', 'legL', 'legR'];
    for (var i = 0; i < slots.length; i++) {
      var sp = slots[i];
      var p = u.body && u.body[sp];
      if (!p) continue;
      var broken = u.limbState[sp] === 'cut' ||
                   (u.limbState[sp] !== 'robo' && p.hp <= 0);
      if (!broken) continue;
      u.limbState[sp] = 'robo';
      p.hp = Math.max(p.hp, Math.round(p.max * 0.75));
      return sp;
    }
    return null;
  }

  return {
    discountFor: discountFor,
    price: price,
    spend: spend,
    installProsthetic: installProsthetic
  };
});
