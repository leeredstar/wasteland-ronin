/* T006 随机性审计生成器：扫描 game.js 的随机调用面，输出迁移清单 */
const fs = require('fs');
const srcPath = 'D:/wasteland-ronin/js/game.js';
const outPath = 'D:/wasteland-ronin/outputs/random-audit.md';

const src = fs.readFileSync(srcPath, 'utf8').split('\n');

function cat(line) {
  if (/spawn|tier|homePoint|findSpawnPos/.test(line)) return '世界·生成';
  if (/dmg|dodge|pickPart|swing|hit/i.test(line)) return '战斗';
  if (/particle|blood|spark|flame|dust|mote|shake|decal|bob|pulse/i.test(line)) return '特效';
  if (/decor|terrain|sand|building|motes|pattern/i.test(line)) return '世界·静态';
  if (/SYL|SUF|BEAST|randName|pick\(\[/.test(line)) return '命名';
  if (/loot|cats.*randi/.test(line)) return '掉落';
  if (/wander|moveTarget|fear/i.test(line)) return 'AI';
  if (/cool|init|face:/.test(line)) return '初始化';
  return '待分类(多为特效/生成路径)';
}

let direct = 0, rand = 0, randi = 0, pickc = 0;
const rows = [];
src.forEach((ln, idx) => {
  const n = (ln.match(/Math\.random/g) || []).length;
  if (n) { direct += n; rows.push({ line: idx + 1, text: ln.trim().slice(0, 88), cat: '直接调用' }); }
  const r1 = (ln.match(/\brand\(/g) || []).length;
  const r2 = (ln.match(/\brandi\(/g) || []).length;
  const r3 = (ln.match(/\bpick\(/g) || []).length;
  if (r1 + r2 + r3) {
    rand += r1; randi += r2; pickc += r3;
    rows.push({ line: idx + 1, text: '(封装) ' + ln.trim().slice(0, 80), cat: cat(ln) });
  }
});
const byCat = {};
rows.forEach(r => { byCat[r.cat] = (byCat[r.cat] || 0) + 1; });

let md = '# Math.random / 随机性审计（T006）\n\n';
md += '> 目标：全部迁移到 core/RNG.js，支撑确定性回放(M10)与联机同步(M17)。\n';
md += '> 审计对象：js/game.js @ v0.4\n\n';
md += '## 总量\n\n| 通道 | 调用数 |\n|---|---|\n';
md += '| 直接 Math.random | ' + direct + ' |\n';
md += '| rand() | ' + rand + ' |\n';
md += '| randi() | ' + randi + ' |\n';
md += '| pick() | ' + pickc + ' |\n';
md += '| **合计** | **' + (direct + rand + randi + pickc) + '** |\n\n';
md += '## 咽喉点（关键发现）\n\n';
md += '几乎所有随机经由三个封装函数（game.js 第 10/11/15 行定义）。因此迁移只需两步：\n\n';
md += '1. **阶段A（M10 前置）**：将 rand/randi/pick 内部改调 `worldRng.next()` → 全游戏确定性化；11 处直接调用逐个归类处理。\n';
md += '2. **阶段B（M10 打磨）**：把纯视觉调用点（粒子/血花等）拆到 `fxRng`（非种子）避免污染回放序列。\n\n';
md += '判定规则：**玩家能感知结果差异 ⇒ 必须走种子实例。**\n\n';
md += '## 分类统计（按行归类）\n\n| 类别 | 行数 |\n|---|---|\n';
Object.keys(byCat).forEach(k => { md += '| ' + k + ' | ' + byCat[k] + ' |\n'; });
md += '\n## 明细（每含调用的行记一条）\n\n| 行号 | 类别 | 代码 |\n|---|---|---|\n';
rows.forEach(r => {
  const safeText = r.text.split('|').join('\\|');
  md += '| ' + r.line + ' | ' + r.cat + ' | `' + safeText + '` |\n';
});
fs.writeFileSync(outPath, md, 'utf8');
console.log('审计报告已更新:', outPath);
console.log('直接=' + direct, 'rand()=' + rand, 'randi()=' + randi, 'pick()=' + pickc, '| 总计', direct + rand + randi + pickc);
