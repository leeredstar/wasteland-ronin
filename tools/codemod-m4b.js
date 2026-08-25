/* M4 补丁：入库调用 + 储物箱碰撞/绘制/幽灵预览 + cycleBuild 消息 */
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

// 1) cycleBuildMode 增加储物箱
repOnce(src.match(/if \(buildMode === 2\) log\('建造模式：篝火[^']*', 'sys'\);/)[0],
`if (buildMode === 2) log('建造模式：篝火 —— 左键放置（1 建材），右键/Esc 退出，B 切换', 'sys');
  else if (buildMode === 3) log('建造模式：储物箱 —— 左键放置（1 建材），奴隶会自动搬运到此', 'sys');`, 'cycle-msg');

// 2) drawStructures: kind===3 储物箱绘制（在围墙分支前插入）
repOnce(src.match(/    if \(so\.kind === 1\) \{\n      \/\* 围墙段：三根尖桩 \*\//)[0],
`    if (so.kind === 3) {
      /* 储物箱 */
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.ellipse(so.x, so.y + 8, 13, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8a6a44';
      ctx.strokeStyle = '#241d15'; ctx.lineWidth = 1.4;
      ctx.fillRect(so.x - 11, so.y - 9, 22, 17);
      ctx.strokeRect(so.x - 11, so.y - 9, 22, 17);
      ctx.strokeStyle = '#5d4525'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(so.x - 11, so.y); ctx.lineTo(so.x + 11, so.y); ctx.stroke();
      ctx.fillStyle = '#c9a44a';
      ctx.fillRect(so.x - 2, so.y - 3, 4, 6);
    }
    if (so.kind === 1) {
      /* 围墙段：三根尖桩 */`, 'storage-draw');

// 3) 幽灵预览标签支持储物箱
repOnce("var label = (buildMode === 1 ? '围墙' : '篝火') + ' 🧱' + res.mats;",
        "var label = (buildMode === 1 ? '围墙' : buildMode === 2 ? '篝火' : '储物箱') + ' \\ud83e\\uddf1' + res.mats;", 'ghost-label');

// 4) update 中调用 depositBags（在 pickups 之后）
repOnce(src.match(/  pickups\(dt\);\n/)[0].replace('\n',''),
`  pickups(dt);
  depositBags(dt);`, 'deposit-call');

fs.writeFileSync(p, src, 'utf8');
console.log('M4 补丁完成，共 ' + edits + ' 处编辑');
