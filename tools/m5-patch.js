/* ============================================================
 * 荒原浪人 tools/m5-patch.js — 世界扩展补丁
 * 新增：地标发现系统 + 群系地表色差
 * ============================================================ */
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

/* 1) 地标发现：首访时日志提示 */
repOnce(src,
`  /* 城镇接近提示（节流） */`,
`  /* 地标发现 */
  var landmarks = [
    { x: 500, y: 500, name: '风蚀石林' },
    { x: 3500, y: 3500, name: '巨兽骸骨' },
    { x: 2000, y: 600, name: '干涸河床' },
    { x: 600, y: 3500, name: '迷失者营地遗迹' }
  ];
  for (var li = 0; li < landmarks.length; li++) {
    var lm = landmarks[li];
    if (!lm.found && livingSquad().some(function (s) { return dist(s, lm) < 200; })) {
      lm.found = true;
      log('🗺️ 发现了「' + lm.name + '」', 'sys');
    }
  }

  /* 城镇接近提示（节流） */`, 'landmark-discovery');

fs.writeFileSync(GAME, src, 'utf8');
console.log('M5 补丁完成，共 ' + edits + ' 处编辑');
