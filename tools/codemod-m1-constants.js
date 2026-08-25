/* T038/T040/T044-T048 codemod：常量入 balance + 反击事件化 */
const fs = require('fs');
const p = 'D:/wasteland-ronin/js/game.js';
let src = fs.readFileSync(p, 'utf8');
let edits = 0;

function repOnce(from, to, label) {
  const parts = src.split(from);
  if (parts.length !== 2) { console.error('替换失败(' + label + ')：次数=' + (parts.length - 1)); process.exit(1); }
  src = parts[0] + to + parts[1];
  edits++;
}
function repAll(from, to, label, min) {
  const parts = src.split(from);
  if (parts.length - 1 < min) { console.error('替换失败(' + label + ')：次数=' + (parts.length - 1)); process.exit(1); }
  src = parts.join(to);
  edits++;
}

// ---- T040 反击事件化 ----
repOnce(`    case 'KeyT':
      autoDefend = !autoDefend;
      log(autoDefend ? '小队自动反击：开（被攻击时自动还手）' : '小队自动反击：关（完全手动指挥）', 'sys');
      break;`,
`    case 'KeyT':
      /* T040 经总线广播（main.js 桥接执行） */
      uiBus().emit('combat/toggleAutoDefend');
      break;`, 'KeyT');

repOnce(`  toggleCamFollow: function () {
    camFollow = !camFollow;
    log(camFollow ? '镜头跟随：开' : '镜头跟随：关（WASD 移动镜头，G 重新跟随）', 'sys');
  }`,
`  toggleCamFollow: function () {
    camFollow = !camFollow;
    log(camFollow ? '镜头跟随：开' : '镜头跟随：关（WASD 移动镜头，G 重新跟随）', 'sys');
  },
  toggleAutoDefend: function () {
    autoDefend = !autoDefend;
    log(autoDefend ? '小队自动反击：开（被攻击时自动还手）' : '小队自动反击：关（完全手动指挥）', 'sys');
  }`, 'legacy-toggle');

// ---- 常量别名定义 ----
repOnce('function tryHit(a, d) { return CombatSys.tryHit(a, d); }',
`/* ---- 表现/生命周期常量（T044-T047，源自 data/balance.js）---- */
var LIFE = (WR.BALANCE && WR.BALANCE.WORLD_LIFE) || { DEAD_TTL: 45, LOOT_TTL: 90, LOOT_FADE_AT: 10 };
var FXC = (WR.BALANCE && WR.BALANCE.FX) || { PARTICLE_SOFT_CAP: 280, PARTICLE_HARD_CAP: 300, DECAL_CAP: 350, BLOOD_N: 7, SPARK_N: 4, COIN_N: 6, DUST_STEP_GAP: 30 };
var HUD_MS = (WR.BALANCE && WR.BALANCE.HUD_INTERVAL_MS) || 180;

function tryHit(a, d) { return CombatSys.tryHit(a, d); }`, 'consts');

// ---- T047 血迹上限 ----
repOnce('if (decals.length > 350) decals.shift();',
        'if (decals.length > FXC.DECAL_CAP) decals.shift();', 'decal-cap');

// ---- T046 粒子 ----
repOnce("for (var i = 0; i < 7; i++) {\n    particles.push({\n      x: u.x, y: u.y,\n      vx: rand(-70, 70), vy: rand(-70, 70),",
        "for (var i = 0; i < FXC.BLOOD_N; i++) {\n    particles.push({\n      x: u.x, y: u.y,\n      vx: rand(-70, 70), vy: rand(-70, 70),", 'blood-n');
repAll('if (particles.length > 300) particles.splice(0, particles.length - 300);',
       'if (particles.length > FXC.PARTICLE_HARD_CAP) particles.splice(0, particles.length - FXC.PARTICLE_HARD_CAP);', 'particle-cap', 2);
repOnce("for (var i = 0; i < 4; i++) {\n    particles.push({\n      x: x, y: y,\n      vx: rand(-110, 110), vy: rand(-110, 110),",
        "for (var i = 0; i < FXC.SPARK_N; i++) {\n    particles.push({\n      x: x, y: y,\n      vx: rand(-110, 110), vy: rand(-110, 110),", 'spark-n');
repOnce("for (var i = 0; i < 6; i++) {\n    particles.push({\n      x: x, y: y,\n      vx: rand(-40, 40), vy: rand(-80, -30),",
        "for (var i = 0; i < FXC.COIN_N; i++) {\n    particles.push({\n      x: x, y: y,\n      vx: rand(-40, 40), vy: rand(-80, -30),", 'coin-n');
repOnce('if (u.stepAcc > 30 && particles.length < 280) {',
        'if (u.stepAcc > FXC.DUST_STEP_GAP && particles.length < FXC.PARTICLE_SOFT_CAP) {', 'dust-step');

// ---- T045 尸体/战利品生命周期 ----
repOnce("return !(x.state === 'dead' && x.deadT > 45);",
        "return !(x.state === 'dead' && x.deadT > LIFE.DEAD_TTL);", 'dead-ttl');
repOnce('    life: 90\n  });',
        '    life: LIFE.LOOT_TTL\n  });', 'loot-ttl');
repOnce('ctx.globalAlpha = l.life < 10 ? l.life / 10 : 1;',
        'ctx.globalAlpha = l.life < LIFE.LOOT_FADE_AT ? l.life / LIFE.LOOT_FADE_AT : 1;', 'loot-fade');

// ---- T048 HUD 节拍 ----
repOnce('if (now - lastChipTime < 180) return;', 'if (now - lastChipTime < HUD_MS) return;', 'hud-throttle');

fs.writeFileSync(p, src, 'utf8');
console.log('codemod 完成，共 ' + edits + ' 处编辑');
