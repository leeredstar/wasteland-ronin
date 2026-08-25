/* T105-T114 codemod：背包双轨制 + 掉落合并 + 钱袋分级 + 招募递增 */
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

/* 1) makeUnit 默认携带背包容器 */
repOnce(`    hairColor: '#2a201a'
  };`,
`    hairColor: '#2a201a',
    bag: { cats: 0, food: 0 }
  };`, 'makeUnit-bag');

/* 2) pickups：玩家进个人背包，奴隶直入公共仓库 */
repOnce(`      if (dist(u, l) < 24) {
        res.cats += l.cats;
        if (l.food) res.food += l.food;
        var bySlave = u.faction === 'slave';
        addText(l.x, l.y - 16, '+' + l.cats + ' 猫', bySlave ? '#9fb8d8' : '#ffd97a');
        if (bySlave) addText(l.x, l.y - 32, '奴隶搬运', '#8fa8c8');
        if (l.food) addText(l.x, l.y - 32, '+' + l.food + ' 干粮', '#e8b45a');
        log((bySlave ? '奴隶搬运战利品：' : '拾取战利品：') + l.cats + ' 猫' + (l.food ? ' 和 ' + l.food + ' 干粮' : ''), bySlave ? 'sys' : 'gold');`,
`      if (dist(u, l) < 24) {
        var bySlave = u.faction === 'slave';
        if (bySlave) {
          res.cats += l.cats;
          if (l.food) res.food += l.food;
        } else {
          u.bag = u.bag || { cats: 0, food: 0 };
          u.bag.cats += l.cats;
          u.bag.food += l.food;
        }
        addText(l.x, l.y - 16, '+' + l.cats + ' 猫', bySlave ? '#9fb8d8' : '#ffd97a');
        if (l.food) addText(l.x, l.y - 32, '+' + l.food + ' 干粮', '#e8b45a');
        log((bySlave ? '奴隶搬运战利品：' : '拾取战利品：') + l.cats + ' 猫' + (l.food ? ' 和 ' + l.food + ' 干粮' : ''), bySlave ? 'sys' : 'gold');`, 'pickups-bag');

/* 3) dropLoot：同类邻近合并，防止满地钱袋 */
repOnce(`function dropLoot(u) {
  if (u.looted) return;
  u.looted = true;
  loot.push({`,
`function dropLoot(u) {
  if (u.looted) return;
  u.looted = true;
  /* T113：附近已有同类钱袋则合并 */
  for (var mi = 0; mi < loot.length; mi++) {
    var ex = loot[mi];
    if (Math.abs(ex.x - u.x) < 26 && Math.abs(ex.y - u.y) < 26) {
      ex.cats += randi(u.lootMin, u.lootMax);
      if (!u.isBeast && Math.random() < 0.3) ex.food = (ex.food || 0) + randi(1, 2);
      return;
    }
  }
  loot.push({`, 'droploot-merge');

/* 4) 钱袋分级外观（drawLootBags 半径/色阶） */
repOnce(`    ctx.globalAlpha = l.life < LIFE.LOOT_FADE_AT ? l.life / LIFE.LOOT_FADE_AT : 1;
    ctx.fillStyle = '#8a6a3c';`,
`    ctx.globalAlpha = l.life < LIFE.LOOT_FADE_AT ? l.life / LIFE.LOOT_FADE_AT : 1;
    var tier = l.cats >= 60 ? 3 : (l.cats >= 25 ? 2 : 1);
    var bagR = 6 + tier * 1.6;
    ctx.fillStyle = tier === 3 ? '#c9a44a' : (tier === 2 ? '#a3853f' : '#8a6a3c');`, 'bag-tier-color');

/* 5) 建造模式加入储物箱（cycleBuildMode 三段循环） */
repOnce(`function cycleBuildMode() {
  buildMode = (buildMode + 1) % 3;`,
`function cycleBuildMode() {
  buildMode = (buildMode + 1) % 4;`, 'cycle-4');

repOnce(`  if (buildMode === 1) log('建造模式：围墙 —— 左键放置（1 建材），右键/Esc 退出，B 切换', 'sys');
  else if (buildMode === 2) log('建造模式：篝火 —— 左键放置（1 建材），右键/Esc 退出，B 切换', 'sys');`,
`  if (buildMode === 1) log('建造模式：围墙 —— 左键放置（1 建材），右键/Esc 退出，B 切换', 'sys');
  else if (buildMode === 2) log('建造模式：篝火 —— 左键放置（1 建材），右键/Esc 退出，B 切换', 'sys');
  else if (buildMode === 3) log('建造模式：储物箱 —— 左键放置（1 建材），右键/Esc 退出，B 切换', 'sys');`, 'cycle-msg');

/* 6) drawStructures 增加储物箱绘制 */
repOnce(`  /* 玩家建筑 */
  for (var w = 0; w < structures.length; w++) {`,
`  /* 玩家建筑 */
  for (var w = 0; w < structures.length; w++) {`);
// ↑ 无变化占位：储物箱绘制在 drawStructures 的 kind 分支中追加
repOnce(`    if (so.kind === 1) {
      /* 围墙段：三根尖桩 */`,
`    if (so.kind === 3) {
      /* 储物箱：木箱+金属扣 */
      if (!inView(so.x, so.y, 40)) continue;
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.ellipse(so.x, so.y + 8, 12, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8a6a44';
      ctx.strokeStyle = '#241d15'; ctx.lineWidth = 1.4;
      ctx.fillRect(so.x - 10, so.y - 8, 20, 16);
      ctx.strokeRect(so.x - 10, so.y - 8, 20, 16);
      ctx.strokeStyle = '#5d4525'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(so.x - 10, so.y); ctx.lineTo(so.x + 10, so.y); ctx.stroke();
    }
    if (so.kind === 1) {
      /* 围墙段：三根尖桩 */`, 'storage-draw');

console.log('codemod T105-T114 完成，共 ' + edits + ' 处编辑');
