/* 在 IIFE 内部正确位置插入调试钩子 */
const fs = require('fs');
const p = 'D:/wasteland-ronin/js/game.js';
let s = fs.readFileSync(p, 'utf8');

// 移除 IIFE 外的错误钩子
s = s.replace(/\n\/\* 调试钩子[^\0]*/, '\n');

// 在 IIEF 关闭前插入正确的调试钩子
if (!s.includes('__ronin')) {
  const hook = `
/* 调试 / 自动化测试钩子 */
window.__ronin = {
  unitsList: function () { return units; },
  resources: function () { return res; },
  state: function () { return { started: started, day: day, time: gameTime }; },
  world: function () { return { camps: camps, structures: structures }; },
  selectionList: function () { return selection; },
  getCam: function () { return { x: cam.x, y: cam.y, z: zoom }; },
  gates: function () { return { started: started, gameOver: gameOver }; }
};
`;
  // 在最后一个 })(); 前插入
  const lastClose = s.lastIndexOf('})();');
  if (lastClose < 0) { console.error('no IIFE close found'); process.exit(1); }
  s = s.slice(0, lastClose) + hook + s.slice(lastClose);
}

fs.writeFileSync(p, s, 'utf8');
console.log('debug hook fixed. File size:', s.length);
