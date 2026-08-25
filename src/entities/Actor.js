/* ============================================================
 * 荒原浪人 entities/Actor — 角色工厂（纯数据 + 行为方法集）
 * 设计要点：
 *  - 字段与旧 game.js makeUnit 一一对应，迁移期可无缝互换
 *  - 组合 Body/Skills/Inventory 模块（不再内联构造）
 *  - 武器/护甲对象由 data/items 表提供（M3 前，调用方传引用）
 * 双模式：浏览器挂 WR.Actor；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory(root.WR || {});
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Actor = api; }
})(typeof self !== 'undefined' ? self : this, function (WR) {
  'use strict';

  var BodyMod = WR.Body || (typeof require !== 'undefined' ? require('./Body.js') : null);
  var SkillsMod = WR.Skills || (typeof require !== 'undefined' ? require('./Skills.js') : null);
  var InventoryMod = WR.Inventory || (typeof require !== 'undefined' ? require('./Inventory.js') : null);

  /* 与旧实现一致的默认武器（M3 数据表接管前的兜底） */
  var DEFAULT_WEAPON = { key: 'fists', name: '拳头', dmg: 6, reach: 26, speed: 1.05, power: 0 };

  var FACTION_COLOR = {
    player: '#4e6ea8',
    bandit: '#9a4436',
    hungry: '#8a7a52',
    town:   '#3f7d52',
    beast:  '#8a8a92'
  };

  var _seq = 0;
  /** 重置 id 序列（存档恢复用） */
  function setSeq(v) { _seq = v; }

  /**
   * 创建角色。opts 字段与旧 makeUnit 完全兼容。
   */
  function create(opts) {
    opts = opts || {};
    var u = {
      id: ++_seq,
      name: opts.name || '无名者',
      faction: opts.faction || 'bandit',
      x: opts.x || 0,
      y: opts.y || 0,
      r: opts.r != null ? opts.r : 11,
      scale: opts.scale || 1,
      speed: opts.speed != null ? opts.speed : 82,
      face: opts.face != null ? opts.face : Math.random() * Math.PI * 2,

      body: null,           // 由 Body.makeBody 填充
      limbState: {},        // 四肢状态：undefined|'cut'|'robo'

      hunger: 100,
      state: 'idle',        // idle|move|fight|down|dead
      moving: false,
      walkT: 0,
      fallT: 0,
      poolT: 0,
      stepAcc: 0,

      moveTarget: null,
      attackTarget: null,
      cool: Math.random() * 0.4,
      swingT: 0,
      flashT: 0,
      combatT: 0,
      wakeGrace: 0,
      fearT: 0,
      wanderT: Math.random() * 4,
      thinkT: Math.random() * 0.4,

      rescueChannel: 0, rescueTarget: null,
      bandageChannel: 0,
      captureChannel: 0, captureTarget: null,

      looted: false, deadT: 0,
      hungWarned: false,
      lastAttacker: null,

      skills: null,         // 由 Skills.create 填充
      xp: null,
      inventory: null,      // 由 Inventory.create 填充

      weapon: opts.weapon || DEFAULT_WEAPON,
      armor: opts.armor || null,

      aggro: opts.aggro != null ? opts.aggro : 230,
      homePoint: opts.homePoint || null,
      tierName: opts.tierName || '',
      lootMin: opts.lootMin != null ? opts.lootMin : 8,
      lootMax: opts.lootMax != null ? opts.lootMax : 25,
      isBeast: !!opts.isBeast,
      autoDefendExempt: false,

      bodyColor: opts.bodyColor || FACTION_COLOR[opts.faction] || FACTION_COLOR.bandit,
      headColor: opts.headColor || '#d9b48a',
      hairColor: opts.hairColor || '#2a201a'
    };

    // 组合子模块
    var c = opts.maxHp || 60;
    u.body = BodyMod.makeBody(c);
    var sk = opts.skills || { str: 8, tgh: 8, dodge: 8, melee: 8 };
    u.skillsState = SkillsMod.create(sk);
    // 兼容旧代码的扁平访问（迁移期双轨）
    u.skills = u.skillsState.skills;
    u.xp = u.skillsState.xp;
    u.inventory = InventoryMod.create(8, 10); // 8 格 × 10 叠

    return u;
  }

  return {
    create: create,
    setSeq: setSeq,
    FACTION_COLOR: FACTION_COLOR,
    DEFAULT_WEAPON: DEFAULT_WEAPON
  };
});
