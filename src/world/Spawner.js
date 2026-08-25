/* ============================================================
 * 荒原浪人 world/Spawner — 敌人生成（tier 表 + 距离梯度 + 头目）
 * 设计要点：
 *  - 全部随机走注入的 rng（确定性回放基础）
 *  - 单位构造经 makeUnit 注入（迁移期指向 legacy 工厂）
 *  - tierForDistance / findSpawnPos 可独立单测
 * 双模式：浏览器挂 WR.Spawner；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.Spawner = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var TIERS = [
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
    armors: null
  };

  function attach(opts) {
    S.rng = opts.rng;
    S.makeUnit = opts.makeUnit;
    S.weapons = opts.weapons;
    S.armors = opts.armors;
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
   * 返回 {x,y} 或 null
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

  /**
   * 生成一队匪徒（远地带概率出现头目）。
   * ctx 同 findSpawnPos，另需 units 数组接收。
   * 返回生成数量。
   */
  function spawnGroup(ctx) {
    var pos = findSpawnPos(ctx);
    if (!pos) return 0;

    var dxh = pos.x - ctx.hubX, dyh = pos.y - ctx.hubY;
    var dh = Math.sqrt(dxh * dxh + dyh * dyh);
    var ti = 0;
    if (dh > 1800 && S.rng() < 0.45) ti = 2;
    else if (dh > 950) ti = 1;

    var tier = TIERS[ti];
    var n = 2 + Math.floor(S.rng() * 3); // randi(2,4)
    for (var i = 0; i < n; i++) {
      ctx.units.push(S.makeUnit({
        faction: tier.faction,
        x: pos.x + (S.rng() * 80 - 40), y: pos.y + (S.rng() * 80 - 40),
        maxHp: tier.hp,
        speed: tier.speed,
        aggro: tier.aggro,
        weapon: S.weapons[pick(tier.weapons)],
        tierName: tier.name,
        lootMin: tier.loot[0], lootMax: tier.loot[1],
        bodyColor: FACTION_COLOR_SAFE[tier.faction],
        homePoint: { x: pos.x, y: pos.y },
        skills: { str: tier.str, tgh: tier.tgh, dodge: tier.dodge, melee: tier.melee },
        armor: (tier.armorChance && S.rng() < tier.armorChance) ? S.armors.leather : null
      }));
    }

    /* 强盗头目：远地带低概率出现 */
    if (ti === 2 && S.rng() < 0.22) {
      ctx.units.push(S.makeUnit({
        faction: 'bandit',
        x: pos.x + (S.rng() * 60 - 30), y: pos.y + (S.rng() * 60 - 30),
        maxHp: 160, speed: 88, aggro: 300, scale: 1.18, r: 13,
        weapon: S.weapons.katana,
        armor: S.armors.chain,
        tierName: '强盗头目',
        lootMin: 150, lootMax: 320,
        bodyColor: '#702828',
        hairColor: '#151515',
        homePoint: { x: pos.x, y: pos.y },
        skills: { str: 19, tgh: 18, dodge: 15, melee: 21 }
      }));
      n++;
    }
    return n;
  }

  /** 狼群（2~3 只） */
  function spawnBeastPack(ctx) {
    var pos = findSpawnPos(ctx);
    if (!pos) return 0;
    var n = 2 + Math.floor(S.rng() * 2);
    for (var i = 0; i < n; i++) {
      ctx.units.push(S.makeUnit({
        faction: 'beast',
        isBeast: true,
        name: BEAST_NAMES[Math.floor(S.rng() * BEAST_NAMES.length)],
        x: pos.x + (S.rng() * 72 - 36), y: pos.y + (S.rng() * 72 - 36),
        maxHp: 44, speed: 118, aggro: 290,
        weapon: S.weapons.bite,
        tierName: '荒原狼',
        lootMin: 5, lootMax: 16,
        bodyColor: '#8a8a92',
        headColor: '#9a9aa2',
        homePoint: { x: pos.x, y: pos.y },
        skills: { str: 10, tgh: 8, dodge: 12, melee: 10 }
      }));
    }
    return n;
  }

  function pick(arr) { return arr[Math.floor(S.rng() * arr.length)]; }

  /* 颜色兜底表（避免依赖 legacy 内部常量） */
  var FACTION_COLOR_SAFE = {
    hungry: '#8a7a52',
    bandit: '#9a4436'
  };

  return {
    TIERS: TIERS,
    BEAST_NAMES: BEAST_NAMES,
    attach: attach,
    tierForDistance: tierForDistance,
    findSpawnPos: findSpawnPos,
    spawnGroup: spawnGroup,
    spawnBeastPack: spawnBeastPack
  };
});
