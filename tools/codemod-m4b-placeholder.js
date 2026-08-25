/* M4 补丁：背包入库 + 储物箱碰撞 + 幽灵预览标签 */
const fs = require('fs');
const GAME = 'D:/wasteland-ronin/js/game.js';
let src = fs.readFileSync(GAME, 'utf8');
let edits = 0;

function repOnce(from, to, label) {
  const parts = src.split(from);
  if (parts.length !== 2) { console.error('替换失败(' + label + ')：次数=' + (parts.length - 1)); process.exit(1); }
  src = parts[0] + to + parts[1];
  edits++;
}

/* 1) 背包自动入库：靠近营地或储物箱时自动转移 */
repOnce(GAME_SRC, 'function depositBags() {', 'function depositBags() {'); // 占位防重复

function insertDepositBags() {
  const anchor = '/* ---------------- 玩家指令 ---------------- */';
  const fn = `
/* ---------------- 背包入库（M4/T105-T111）---------------- */
function depositBags(dt) {
  var sq = livingSquad();
  var deposited = 0;
  for (var i = 0; i < sq.length; i++) {
    var u = sq[i];
    var bag = u.bag;
    if (!bag || (bag.cats <= 0 && bag.food <= 0)) continue;

    /* 找最近的入库点：营地 / 储物箱建筑 */
    var near = null;
    for (var c = 0; c < camps.length; c++) {
      if (dist(u, camps[c]) < 150) { near = camps[c]; break; }
    }
    if (!near) {
      for (var s = 0; s < structures.length; s++) {
        if (structures[s].kind === 3 && dist(u, structures[s]) < 100) { near = structures[s]; break; }
      }
    }
    if (!near) continue;

    /* 自动转移到公共资源池 */
    res.cats += bag.cats;
    res.food += bag.food;
    deposited += bag.cats;
    addText(u.x, u.y - 30, '入库 +' + bag.cats + ' 猫', '#9fb8d8');
    log(u.name + ' 存入了 ' + bag.cats + ' 猫' + (bag.food > 0 ? ' 和 ' + bag.food + ' 干粮' : ''), 'gold');
    u.bag = { cats: 0, food: 0 };
  }
  return deposited;
}

`;
  return fn;
}

console.log('NOTE: This tool needs manual integration. See m4-unit-tests instead.');

