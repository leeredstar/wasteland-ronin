/* ============================================================
 * 荒原浪人 world/Spawner — 敌人生成（数据驱动：src/data/enemies.js）
 * 设计要点：
 *  - 敌人原型表经 attach(opts.tiers/boss/wolf) 注入；
 *    内置 fallback 保证独立可运行
 *  - 全部随机走注入的 rng（确定性回放基础）
 *  - 单位构造经 makeUnit 注入（迁移期指向 legacy 工厂）
 * 双模式：浏览器挂 WR.Spawner；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Spawner = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* fallback：未注入 tiers 时使用（与 data/enemies.js 保持一致） */
  var TIERS_FALLBACK = [
    { name: '饥饿强盗', hp: 46,  melee: 6,  dodge: 6,  str: 7,  tgh: 7,  aggro: 200, speed: 78,
      weapons: ['fists', 'stick'],          loot: [8, 25],   faction: 'hungry', armorChance: 0 },
    { name: '强盗',     hp: 78,  melee: 13, dodge: 11, str: 13, tgh: 12, aggro: 240, speed: 84,
      weapons: ['stick', 'iron', 'mace'],   loot: [20, 60],  faction: 'bandit', armorChance: 0.15 },
    { name: '荒原剑客', hp: 118, melee: 19, dodge: 16, str: 17, tgh: 16, aggro: 280, speed: 90,
      weapons: ['iron', 'katana', 'spear'], loot: [80, 160], faction: 'bandit', armorChance: 0.5 }
  ];

  var BEAST_NAMES = ['灰牙', '夜嚎', '快爪', '荒脊', '白斑', '断耳'];

  var S = {
    rng: function () { return Math.random(); },
    makeUnit: null,
    weapons: null,
    armors: null,
    tiers: null,     // [{name,hp,melee,dodge,str,tgh,aggro,speed,weapons,loot,faction,armorChance}]
    boss: null,      // {name,faction,hp,speed,aggro,scale,r,weaponKey,armorKey,loot,skills...}
    wolf: null       // {name,faction,hp,speed,aggro,weaponKey,loot,skills...}
  };

  function attach(opts) {
    S.rng = opts.rng || S.rng;
    S.makeUnit = opts.makeUnit || S.makeUnit;
    S.weapons = opts.weapons || S.weapons;
    S.armors = opts.armors || S.armors;
    S.tiers = opts.tiers || S.tiers;
    S.boss = opts.boss || S.boss;
    S.wolf = opts.wolf || S.wolf;
  }

  /** 距 hub 距离 → tier 索引 */
  function tierForDistance(dh) {
    if (dh > 1800 && S.rng() < 0.45) return 2;
    if (dh > 950) return 1;
    return 0;
  }

  /**
   * 计算出生点。ctx = {hubX,hubY, playerX,playerY,
   *   minPlayerDist, worldW, worldH, farFromTowns(x,y,m)}
   */
  function findSpawnPos(ctx) {
    for (var tries = 0; tries < 16; tries++) {
      var ang = S.rng() * Math.PI * 2;
      var dc = 750 + S.rng() * 1350;
      var x = clamp(ctx.hubX + Math.cos(ang) * dc, 60, ctx.worldW - 60);
      var y = clamp(ctx.hubY + Math.sin(ang) * dc, 60, ctx.worldH - 60);
      if (!ctx.farFromTowns(x, y, 120)) continue;
      var dxp = x - ctx.playerX, dyp = y - ctx.playerY;
      if (Math.sqrt(dxp * dxp + dyp * dyp) < ctx.minPlayerDist) continue;
      return { x: x, y: y };
    }
    return null;
  }

  /** 生成一队匪徒；返回生成数量 */
  function spawnGroup(ctx) {
    var pos = findSpawnPos(ctx);
    if (!pos) return 0;

    var dxh = pos.x - ctx.hubX, dyh = pos.y - ctx.hubY;
    var dh = Math.sqrt(dxh * dxh + dyh * dyh);
    var ti = tierForDistance.call(this, dh);

    var list = S.tiers || TIERS_FALLBACK;
    var tier = list[ti];
    var n = 2 + Math.floor(S.rng() * 3);
    for (var i = 0; i < n; i++) {
      ctx.units.push(S.makeUnit({
        faction: tier.faction,
        x: pos.x + (S.rng() * 80 - 40), y: pos.y + (S.rng() * 80 - 40),
        maxHp: tier.hp,
        speed: tier.speed,
        aggro: tier.aggro,
        weapon: S.weapons[tier.weapons[Math.floor(S.rng() * tier.weapons.length)]],
        tierName: tier.name,
        lootMin: tier.loot[0], lootMax: tier.loot[1],
        lootFoodC: tier.lootFoodChance != null ? tier.lootFoodChance : 0.3,
        bodyColor: tier.faction === 'bandit' ? '#9a4436' : '#8a7a52',
        homePoint: { x: pos.x, y: pos.y },
        skills: { str: tier.str, tgh: tier.tgh, dodge: tier.dodge, melee: tier.melee },
        armor: (tier.armorChance && S.rng() < tier.armorChance && S.armors) ? S.armors.leather : null
      }));
    }

    /* 强盗头目：远地带概率出现 */
    if (ti === 2 && S.rng() < 0.22) {
      var boss = S.boss || {
        name: '强盗头目', hp: 160, speed: 88, aggro: 300, scale: 1.18, r: 13,
        weaponKey: 'katana', lootMin: 150, lootMax: 320,
        skills: { str: 19, tgh: 18, dodge: 15, melee: 21 }
      };
      ctx.units.push(S.makeUnit({
        faction: 'bandit',
        name: boss.name || '强盗头目',
        x: pos.x + (S.rng() * 60 - 30), y: pos.y + (S.rng() * 60 - 30),
        maxHp: boss.hp, speed: boss.speed, aggro: boss.aggro,
        scale: boss.scale || 1.18, r: boss.r || 13,
        weapon: S.weapons[boss.weaponKey || 'katana'],
        armor: S.armors ? S.armors.chain : null,
        tierName: boss.name || '强盗头目',
        lootMin: boss.lootMin != null ? boss.lootMin : 150,
        lootMax: boss.lootMax != null ? boss.lootMax : 320,
        lootFoodC: boss.lootFoodChance != null ? boss.lootFoodChance : 0.4,
        bodyColor: '#702828',
        hairColor: '#151515',
        homePoint: { x: pos.x, y: pos.y },
        skills: boss.skills || { str: 19, tgh: 18, dodge: 15, melee: 21 }
      }));
      n++;
    }
    return n;
  }

  /** 狼群（2~3 只）；wolfCfg 来自 data/enemies.js 的 wolf 段 */
  function spawnBeastPack(ctx) {
    var w = S.wolf || {
      name: '荒原狼', faction: 'beast', isBeast: true,
      hp: 44, speed: 118, aggro: 290, weapons: ['bite'],
      lootMin: 5, lootMax: 16,
      skills: { str: 10, tgh: 8, dodge: 12, melee: 10 }
    };
    var pos = findSpawnPos(ctx);
    if (!pos) return 0;
    var n = 2 + Math.floor(S.rng() * 2);
    for (var i = 0; i < n; i++) {
      ctx.units.push(S.makeUnit({
        faction: w.faction || 'beast',
        isBeast: true,
        name: BEAST_NAMES[Math.floor(S.rng() * BEAST_NAMES.length)],
        x: pos.x + (S.rng() * 72 - 36), y: pos.y + (S.rng() * 72 - 36),
        maxHp: w.hp, speed: w.speed, aggro: w.aggro,
        weapon: S.weapons[w.weapons ? w.weapons[0] : 'bite'],
        tierName: w.name,
        lootMin: w.lootMin != null ? w.lootMin : 5,
        lootMax: w.lootMax != null ? w.lootMax : 16,
        lootFoodC: w.lootFoodChance != null ? w.lootFoodChance : 0,
        bodyColor: '#8a8a92',
        headColor: '#9a9aa2',
        homePoint: { x: pos.x, y: pos.y },
        skills: w.skills
      }));
    }
    return n;
  }

  return {
    TIERS_FALLBACK: TIERS_FALLBACK,
    BEAST_NAMES: BEAST_NAMES,
    attach: attach,
    tierForDistance: tierForDistance,
    findSpawnPos: findSpawnPos,
    spawnGroup: spawnGroup,
    spawnBeastPack: spawnBeastPack
  };
});
