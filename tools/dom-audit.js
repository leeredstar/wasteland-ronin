/* T026 DOM 访问审计：逻辑层必须零 document 引用 */
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/wasteland-ronin';

// 纯逻辑层：这些目录出现 document 引用即为违规（gate 失败）
const LOGIC_DIRS = [
  'src/systems',
  'src/entities',
  'src/world'
];

// 表现层：允许使用 DOM，但统计引用数量供迁移参考
const UI_FILES = ['js/game.js'];

function scan(file) {
  const src = fs.readFileSync(file, 'utf8').split('\n');
  const hits = [];
  src.forEach((ln, i) => {
    let m;
    const re = /document\.[a-zA-Z]+/g;
    while ((m = re.exec(ln)) !== null) hits.push({ line: i + 1, ref: m[0], text: ln.trim().slice(0, 70) });
  });
  return hits;
}

let gateFail = false;
let md = '# DOM 访问审计（T026）\n\n';
md += '> 规则：`src/systems|entities|world` 逻辑层**禁止**出现 `document.*`；' +
      '`js/game.js` 为遗留宿主，其 DOM 引用计入 M8/M12 迁移清单。\n\n';

md += '## 逻辑层门禁\n\n| 文件 | document 引用 | 门禁 |\n|---|---|---|\n';
for (const dir of LOGIC_DIRS) {
  const full = path.join(ROOT, dir);
  for (const f of fs.readdirSync(full)) {
    if (!f.endsWith('.js')) continue;
    const rel = dir + '/' + f;
    const hits = scan(path.join(full, f));
    const ok = hits.length === 0;
    if (!ok) gateFail = true;
    md += '| ' + rel + ' | ' + hits.length + ' | ' + (ok ? '✅ 通过' : '❌ 违规') + ' |\n';
    hits.forEach(h => { md += '|   ↳ L' + h.line + ' `' + h.ref + '` | | |\n'; });
  }
}

md += '\n## 遗留宿主（js/game.js）DOM 引用清单\n\n';
const legacyHits = scan(path.join(ROOT, 'js/game.js'));
md += '共 **' + legacyHits.length + '** 处（迁移至 ui/ 层时清零）：\n\n';
legacyHits.forEach(h => { md += '- L' + h.line + ': `' + h.ref + '` — ' + h.text + '\n'; });

md += '\n## 结论\n\n';
md += gateFail
  ? '- ❌ **门禁失败**：逻辑层存在 DOM 引用，需迁移后方可继续后续系统拆分。\n'
  : '- ✅ **门禁通过**：逻辑层零 DOM 引用，满足无头测试与未来服务器复用要求。\n';

fs.writeFileSync(path.join(ROOT, 'outputs/dom-audit.md'), md, 'utf8');
console.log('DOM 审计完成 → outputs/dom-audit.md | 门禁: ' + (gateFail ? 'FAIL' : 'PASS') + ' | legacy 引用 ' + legacyHits.length + ' 处');
