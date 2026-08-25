/* 恢复被 codemod 误删的移动函数 */
const fs = require('fs');
const p = 'D:/wasteland-ronin/js/game.js';
let src = fs.readFileSync(p, 'utf8');
const MARK = '/* ---------------- 单位更新 ----------------';
if (!src.includes(MARK)) { console.error('marker missing'); process.exit(1); }
if (src.includes('function moveToward')) { console.log('already restored'); process.exit(0); }

const restore = [
'/* ---------------- 移动 ---------------- */',
'function moveToward(u, tx, ty, dt) {',
'  var dx = tx - u.x, dy = ty - u.y;',
'  var d = Math.sqrt(dx * dx + dy * dy);',
'  if (d < 0.01) return;',
'  var step = Math.min(d, moveSpeedOf(u) * dt);',
'  u.x += dx / d * step;',
'  u.y += dy / d * step;',
'  u.face = Math.atan2(dy, dx);',
'  u.walkT += step / 24;',
'  u.moving = true;',
'  /* 跑动扬起脚下尘土 */',
'  u.stepAcc = (u.stepAcc || 0) + step;',
'  if (u.stepAcc > 30 && particles.length < 280) {',
'    u.stepAcc = 0;',
'    particles.push({',
'      x: u.x + rand(-3, 3), y: u.y + rand(0, 5),',
'      vx: rand(-8, 8), vy: rand(-14, -4),',
'      life: 0.45, maxLife: 0.45,',
"      color: '#cbb88f', size: rand(1.5, 2.5)",
'    });',
'  }',
'}',
'',
'function collideObstacles(u) {',
'  for (var i = 0; i < obstacles.length; i++) {',
'    var o = obstacles[i];',
'    var dx = u.x - o.x, dy = u.y - o.y;',
'    var d = Math.sqrt(dx * dx + dy * dy);',
'    var minD = o.r + u.r - 2;',
'    if (d < minD && d > 0.01) {',
'      u.x = o.x + dx / d * minD;',
'      u.y = o.y + dy / d * minD;',
'    }',
'  }',
'  /* 玩家建造的建筑也是实体 */',
'  for (var s = 0; s < structures.length; s++) {',
'    var so = structures[s];',
"    var rrx = so.kind === 1 ? 13 : 7;",
'    var dx2 = u.x - so.x, dy2 = u.y - so.y;',
'    var d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);',
'    var minD2 = rrx + u.r - 2;',
'    if (d2 < minD2 && d2 > 0.01) {',
'      u.x = so.x + dx2 / d2 * minD2;',
'      u.y = so.y + dy2 / d2 * minD2;',
'    }',
'  }',
'}',
''
].join('\n');

src = src.replace(MARK, restore + '\n' + MARK);
fs.writeFileSync(p, src, 'utf8');
console.log('restored moveToward + collideObstacles');
