/* ============================================================
 * 荒原浪人 world/Terrain — M5 世界扩展（T125-T131）
 * 职责（纯逻辑，零 DOM）：
 *  - 8000×8000 世界尺寸常量与城镇坐标（T125）
 *  - 三层分离的数据模型：底色(生物群系)/装饰(decor)/碰撞(rocks)（T126）
 *  - 生物群系：sand/grass/rock 区域噪声分布（T127）
 *  - 各群系调色板（T128）
 *  - 值噪声斑块：同群系内地表色斑（供渲染层分块绘制）（T129）
 *  - 道路：连接两镇的折线（纯视觉引导，未来商队用）（T130）
 *  - 废墟点位：E 键搜索随机资源（带游戏时间冷却）（T131）
 * 确定性：所有随机来自 seed 哈希，不使用 Math.random。
 * 双模式：浏览器挂 WR.Terrain；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory(root.WR = root.WR || {});
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR.Terrain = api; }
})(typeof self !== 'undefined' ? self : this, function (WR) {
  'use strict';

  /* ---------------- T146: 世界常数集中配置 ---------------- */
  var CONFIG = {
    worldW: 8000, worldH: 8000,      /* T125 世界尺寸 */
    townMinSpacing: 52,              /* 城镇最小间距（格网采样单位） */
    biomeScale: 2600,                /* T127 区域群系噪声尺度 */
    biomeJitterScale: 340,           /* 群系边界破碎噪声尺度 */
    patchScale: 190,                 /* T129 地表斑块噪声尺度 */
    decorCount: 900,                 /* 装饰物总量 */
    ruinCount: 12,                   /* 杂物废墟数量 */
    towerCount: 2,                   /* 废墟塔楼数量（T133） */
    campCount: 2,                    /* 游商营地数量（T132） */
    denCount: 3                      /* 狼巢数量（T140） */
  };

  /* ---------------- T125: 世界尺寸与城镇 ---------------- */
  var WORLD_SIZE = { w: CONFIG.worldW, h: CONFIG.worldH };
  var TOWNS = [
    { name: '枢纽镇', x: 2200, y: 4200, r: 300 },
    { name: '世界之角', x: 6200, y: 3000, r: 300 }
  ];

  /* ---------------- T128: 群系调色板 ---------------- */
  var PALETTES = {
    sand: {
      base: '#c8ab74',
      patches: ['#bd9f69', '#d2b57f', '#b3945f'],
      speck: ['rgba(90,70,40,.22)', 'rgba(255,240,200,.20)'],
      decorBias: { rock: 0.40, tree: 0.16, bones: 0.18, grass: 0.26 }
    },
    grass: {
      base: '#93a05e',
      patches: ['#8a9855', '#9fae68', '#7d8c4f'],
      speck: ['rgba(50,70,30,.22)', 'rgba(210,230,150,.18)'],
      decorBias: { rock: 0.14, tree: 0.52, bones: 0.06, grass: 0.28 }
    },
    rock: {
      base: '#9a938a',
      patches: ['#8f887f', '#a49d94', '#847d74'],
      speck: ['rgba(40,36,32,.24)', 'rgba(230,225,215,.16)'],
      decorBias: { rock: 0.62, tree: 0.04, bones: 0.12, grass: 0.22 }
    }
  };

  /* ---------------- 确定性哈希与值噪声 ---------------- */
  function hash2(ix, iy, seed) {
    var h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b9);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function valueNoise(x, y, seed) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = smooth(x - ix), fy = smooth(y - iy);
    var a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
    var c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(x, y, seed, octaves) {
    var v = 0, amp = 0.5, f = 1, tot = 0;
    for (var i = 0; i < octaves; i++) {
      v += valueNoise(x * f, y * f, seed + i * 1013) * amp;
      tot += amp; amp *= 0.5; f *= 2;
    }
    return v / tot;
  }

  /* ---------------- 工厂 ---------------- */
  /**
   * create({seed})
   * 返回 terrain 对象：biomeAt / palette / decor / roads / ruins / scavenge ...
   */
  function create(opts) {
    opts = opts || {};
    var seed = (opts.seed != null ? opts.seed : 1) >>> 0;

    /* ---------- T127: 区域生物群系 ---------- */
    /* 大尺度区域噪声决定 sand/grass/rock；过渡带用中间阈值抖动避免直线边界 */
    function biomeAt(x, y) {
      var n = fbm(x / CONFIG.biomeScale, y / CONFIG.biomeScale, seed ^ 0xB10B1, 3);
      var jitter = (valueNoise(x / CONFIG.biomeJitterScale, y / CONFIG.biomeJitterScale, seed ^ 0x51) - 0.5) * 0.08; /* 边界破碎 */
      var v = n + jitter;
      if (v < 0.44) return 'sand';
      if (v < 0.58) return 'grass';
      return 'rock';
    }

    /* T129: 同群系内的地表斑块索引（渲染层用它挑 patch 颜色） */
    function patchIndex(x, y, paletteLen) {
      var n = fbm(x / CONFIG.patchScale, y / CONFIG.patchScale, seed ^ 0xCAFE, 2);
      var idx = Math.floor(n * paletteLen * 1.999);
      return idx % paletteLen;
    }

    /* ---------- 城镇安全距离 ---------- */
    function farFromTowns(x, y, margin) {
      for (var i = 0; i < TOWNS.length; i++) {
        var dx = x - TOWNS[i].x, dy = y - TOWNS[i].y;
        if (dx * dx + dy * dy < margin * margin) return false;
      }
      return true;
    }

    /* ---------- T130: 道路（两镇连线 + 正弦摆动） ---------- */
    function buildRoads() {
      var roads = [];
      for (var i = 0; i < TOWNS.length - 1; i++) {
        var a = TOWNS[i], b = TOWNS[i + 1];
        var pts = [];
        var STEPS = 24;
        for (var s = 0; s <= STEPS; s++) {
          var t = s / STEPS;
          var bx = a.x + (b.x - a.x) * t;
          var by = a.y + (b.y - a.y) * t;
          /* 垂直方向正弦漂移，模拟荒野土路 */
          var nx = -(b.y - a.y), ny = (b.x - a.x);
          var nl = Math.sqrt(nx * nx + ny * ny) || 1;
          var off = Math.sin(t * Math.PI * 3 + hash2(i, 7, seed) * 6.28) * 180
                  * Math.sin(t * Math.PI); /* 两端收拢到镇中心 */
          pts.push({ x: bx + nx / nl * off, y: by + ny / nl * off });
        }
        roads.push({ from: a.name, to: b.name, pts: pts });
      }
      return roads;
    }
    var roads = buildRoads();

    /* 距道路的近似距离（用于装饰避让）：点到各线段距离最小值 */
    function roadDist(x, y) {
      var best = Infinity;
      for (var r = 0; r < roads.length; r++) {
        var pts = roads[r].pts;
        for (var i = 0; i < pts.length - 1; i++) {
          var d = segDist(x, y, pts[i], pts[i + 1]);
          if (d < best) best = d;
        }
      }
      return best;
    }
    function segDist(px, py, a, b) {
      var dx = b.x - a.x, dy = b.y - a.y;
      var l2 = dx * dx + dy * dy;
      if (l2 === 0) return Math.hypot(px - a.x, py - a.y);
      var t = ((px - a.x) * dx + (py - a.y) * dy) / l2;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
    }

    /* ---------- T126/T128: 确定性装饰生成（按群系偏重分布） ---------- */
    function genDecor(count) {
      count = count || 900;
      var out = [];
      var perBiome = { sand: 0, grass: 0, rock: 0 };
      for (var i = 0; i < count; i++) {
        /* 低差异撒点：格网 + 抖动，保证大世界覆盖均匀 */
        var gx = hash2(i, 1, seed ^ 0xDEC0), gy = hash2(i, 2, seed ^ 0xDEC1);
        var x = 60 + gx * (WORLD_SIZE.w - 120);
        var y = 60 + gy * (WORLD_SIZE.h - 120);
        if (!farFromTowns(x, y, 320)) continue;
        if (roadDist(x, y) < 90) continue;
        var biome = biomeAt(x, y);
        var bias = PALETTES[biome].decorBias;
        /* 按群系权重选类型 */
        var roll = hash2(i, 3, seed ^ 0x7A73);
        var acc = 0, type = 'rock';
        for (var k in bias) { acc += bias[k]; if (roll < acc) { type = k; break; } }
        var big = type === 'rock' && hash2(i, 4, seed ^ 0xB16) > 0.86; /* 大石→碰撞 */
        out.push({
          type: type,
          x: Math.round(x), y: Math.round(y),
          s: big ? 1.9 + hash2(i, 5, seed) * 1.1 : 0.7 + hash2(i, 5, seed) * 0.8,
          rot: hash2(i, 6, seed) * 6.28318,
          biome: biome,
          solid: !!big
        });
        perBiome[biome]++;
      }
      return out;
    }
    var decor = genDecor(CONFIG.decorCount);

    /* ---------- T131/T133: 废墟点位 + 废墟塔楼 ---------- */
    function genRuins(n) {
      n = n || 12;
      var out = [];
      for (var i = 0; out.length < n && i < n * 40; i++) {
        var gx = hash2(i, 11, seed ^ 0x8D11), gy = hash2(i, 12, seed ^ 0x8D12);
        var x = 400 + gx * (WORLD_SIZE.w - 800);
        var y = 400 + gy * (WORLD_SIZE.h - 800);
        if (!farFromTowns(x, y, 700)) continue;      /* 不刷在城边 */
        if (roadDist(x, y) < 260) continue;           /* 不挡路 */
        if (out.some(function (r) { return Math.hypot(r.x - x, r.y - y) < 1100; })) continue;
        out.push({
          id: 'ruin' + i,
          type: 'pile',
          x: Math.round(x), y: Math.round(y),
          r: 90,
          coolUntil: 0,
          cooldown: 90,             /* 游戏秒；搜索冷却 */
          tier: hash2(i, 13, seed) > 0.75 ? 2 : 1
        });
      }
      return out;
    }
    var ruins = genRuins(CONFIG.ruinCount);

    /* T133: 废墟塔楼——高风险高回报（守匪由宿主层生成） */
    function genTowers(n) {
      n = n || 2;
      var out = [];
      for (var i = 0; out.length < n && i < n * 60; i++) {
        var gx = hash2(i, 21, seed ^ 0x7071), gy = hash2(i, 22, seed ^ 0x7072);
        var x = 700 + gx * (WORLD_SIZE.w - 1400);
        var y = 700 + gy * (WORLD_SIZE.h - 1400);
        if (!farFromTowns(x, y, 1000)) continue;
        if (roadDist(x, y) < 420) continue;
        if (ruins.some(function (r) { return Math.hypot(r.x - x, r.y - y) < 1300; })) continue;
        if (out.some(function (r) { return Math.hypot(r.x - x, r.y - y) < 2200; })) continue;
        out.push({
          id: 'tower' + i,
          type: 'tower',
          x: Math.round(x), y: Math.round(y),
          r: 130,
          coolUntil: 0,
          cooldown: 150,
          tier: 3
        });
      }
      return out;
    }
    var towers = genTowers(CONFIG.towerCount);
    for (var ti = 0; ti < towers.length; ti++) ruins.push(towers[ti]); /* 统一搜索接口 */

    /* T132: 荒原游商营地——沿道路两侧布点（旅途中转站） */
    function genMerchantCamps(n) {
      n = n || 2;
      var out = [];
      var road = roads[0];
      if (!road) return out;
      var fracs = [0.33, 0.68];
      for (var i = 0; i < n && i < fracs.length; i++) {
        var t = fracs[i];
        var idx = Math.round(t * (road.pts.length - 1));
        var p = road.pts[idx];
        var nxt = road.pts[Math.min(idx + 1, road.pts.length - 1)];
        var dx = nxt.x - p.x, dy = nxt.y - p.y;
        var l = Math.sqrt(dx * dx + dy * dy) || 1;
        var side = i % 2 === 0 ? 1 : -1;
        var off = 190;
        var cx = p.x - dy / l * off * side;
        var cy = p.y + dx / l * off * side;
        var spot = nearestFree(cx, cy, out);
        out.push({
          id: 'camp' + i,
          x: Math.round(spot.x), y: Math.round(spot.y),
          r: 110
        });
      }
      return out;
    }
    function nearestFree(x, y, taken) {
      /* 简单避让：与已取点位/城镇太近就沿法线后退 */
      var guard = 0;
      while (guard++ < 24) {
        var bad = !farFromTowns(x, y, 500) ||
          taken.some(function (c) { return Math.hypot(c.x - x, c.y - y) < 1500; }) ||
          ruins.some(function (r) { return Math.hypot(r.x - x, r.y - y) < 700; });
        if (!bad) break;
        x -= 240; y -= 240;
      }
      return { x: x, y: y };
    }
    var merchantCamps = genMerchantCamps(CONFIG.campCount);

    /* T140: 狼巢——荒野兽群周期刷新锚点 */
    function genWolfDens(n) {
      n = n || CONFIG.denCount;
      var out = [];
      for (var i = 0; out.length < n && i < n * 60; i++) {
        var gx = hash2(i, 31, seed ^ 0xD301), gy = hash2(i, 32, seed ^ 0xD302);
        var x = 500 + gx * (WORLD_SIZE.w - 1000);
        var y = 500 + gy * (WORLD_SIZE.h - 1000);
        if (!farFromTowns(x, y, 950)) continue;
        if (roadDist(x, y) < 320) continue;
        if (ruins.some(function (r) { return Math.hypot(r.x - x, r.y - y) < 800; })) continue;
        if (merchantCamps.some(function (c) { return Math.hypot(c.x - x, c.y - y) < 900; })) continue;
        if (out.some(function (r) { return Math.hypot(r.x - x, r.y - y) < 1800; })) continue;
        out.push({
          id: 'den' + i,
          x: Math.round(x), y: Math.round(y),
          r: 120,
          coolUntil: 0       /* 清剿后的再刷新冷却（宿主层读写） */
        });
      }
      return out;
    }
    var wolfDens = genWolfDens(CONFIG.denCount);

    /* 最近的可搜索废墟（range 内）；返回废墟或 null */
    function nearestRuin(x, y, range) {
      var best = null, bd = range;
      for (var i = 0; i < ruins.length; i++) {
        var d = Math.hypot(ruins[i].x - x, ruins[i].y - y);
        if (d < bd) { bd = d; best = ruins[i]; }
      }
      return best;
    }

    /* 搜索结算：rng 用 WR.App.rng 注入（保持全局确定性）。返回战利品描述或 null */
    function scavenge(ruin, gameTime, rng) {
      if (!ruin || gameTime < ruin.coolUntil) return null;
      ruin.coolUntil = gameTime + ruin.cooldown;
      rng = rng || Math.random;
      var loot = {};
      var tier = ruin.tier;
      /* 猫币 */
      if (rng() < 0.85) loot.cats = Math.round((8 + rng() * 22) * tier);
      /* 物资表：塔楼(tier3)高风险高回报 */
      var table;
      if (tier >= 3) {
        table = ['food', 'bandage', 'mats', 'mats', 'kits', 'kits'];
        loot.cats = Math.round(40 + rng() * 90);   /* 塔楼必有丰厚猫币 */
        if (rng() < 0.7) loot.kits = (loot.kits || 0) + 1;
      } else {
        table = tier === 2
          ? ['food', 'food', 'bandage', 'mats', 'mats', 'kits']
          : ['food', 'bandage', 'mats'];
      }
      var drops = 1 + (rng() < 0.45 ? 1 : 0) + (tier >= 2 && rng() < 0.35 ? 1 : 0);
      while (drops-- > 0) {
        var it = table[Math.floor(rng() * table.length)];
        loot[it] = (loot[it] || 0) + 1;
      }
      return loot;
    }

    /* ---------- 调试/统计 ---------- */
    function stats() {
      var samples = { sand: 0, grass: 0, rock: 0 };
      var N = 24;
      for (var iy = 0; iy < N; iy++) {
        for (var ix = 0; ix < N; ix++) {
          samples[biomeAt((ix + 0.5) / N * WORLD_SIZE.w, (iy + 0.5) / N * WORLD_SIZE.h)]++;
        }
      }
      var towerN = 0;
      for (var i = 0; i < ruins.length; i++) if (ruins[i].type === 'tower') towerN++;
      return { biomes: samples, decor: decor.length, ruins: ruins.length - towerN,
               towers: towerN, merchants: merchantCamps.length,
               wolfDens: wolfDens.length, roads: roads.length };
    }

    return {
      seed: seed,
      size: WORLD_SIZE,
      config: CONFIG,
      towns: TOWNS,
      palettes: PALETTES,
      biomeAt: biomeAt,
      patchIndex: patchIndex,
      decor: decor,
      roads: roads,
      ruins: ruins,
      towers: towers,
      merchantCamps: merchantCamps,
      wolfDens: wolfDens,
      nearestRuin: nearestRuin,
      scavenge: scavenge,
      farFromTowns: farFromTowns,
      stats: stats
    };
  }

  return {
    create: create,
    WORLD_SIZE: WORLD_SIZE,
    TOWNS: TOWNS,
    PALETTES: PALETTES,
    CONFIG: CONFIG
  };
});
