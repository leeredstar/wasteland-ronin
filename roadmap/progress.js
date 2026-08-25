/* 路线图进度管理
 * 用法:
 *   node roadmap/progress.js done   T001 T002 ...   标记完成
 *   node roadmap/progress.js undo   T001            回退为待办
 *   node roadmap/progress.js status                 显示进度摘要与下一批任务
 * 说明: tasks.json 是状态唯一事实源；ROADMAP.md 由本脚本同步再生成。
 */
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const jsonPath = path.join(dir, 'tasks.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

function regenerateMd(d) {
  const doneIds = new Set(d.tasks.filter(t => t.status === 'done').map(t => t.id));
  let md = '# 荒原浪人 · 500 任务路线图\n\n';
  md += '> 目标：做成 Kenshi 那样的游戏 —— **唯一不同：支持多人在线**。\n';
  md += '> 依据：`outputs/kenshi-design-full.html`(2D逻辑全量) + `outputs/kenshi-design-3d.html`(3D方案) + 多人扩展。\n';
  md += '> 状态由 `roadmap/progress.js` 同步维护（tasks.json 为唯一事实源）。\n\n';
  const pct = (doneIds.size / d.total * 100).toFixed(1);
  md += '**进度：' + doneIds.size + ' / ' + d.total + '（' + pct + '%）**\n';
  // 各阶段完成度条
  for (const ph of d.phases) {
    const list = d.tasks.filter(t => t.phase === ph.id);
    const dn = list.filter(t => t.status === 'done').length;
    const bar = Math.round(dn / list.length * 20);
    md += '\n- ' + ph.id + ' ' + ph.name + '：' + dn + '/' + list.length + ' [' + '█'.repeat(bar) + '░'.repeat(20 - bar) + ']';
  }
  md += '\n';
  let cur = '';
  for (const t of d.tasks) {
    if (t.phase !== cur) {
      cur = t.phase;
      const ph = d.phases.find(p => p.id === cur);
      md += '\n## ' + cur + ' · ' + ph.name + '\n\n';
    }
    const mark = t.status === 'done' ? '[x]' : '[ ]';
    md += '- ' + mark + ' ' + t.id + ' ' + t.title + (t.status === 'done' ? ' ✅' : '') + '\n';
  }
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), md, 'utf8');
}

const cmd = process.argv[2] || 'status';
const ids = process.argv.slice(3);

if (cmd === 'done' || cmd === 'undo') {
  if (!ids.length) { console.error('缺少任务ID，例如: node progress.js done T001'); process.exit(1); }
  const now = new Date().toISOString();
  let hit = 0;
  for (const id of ids) {
    const t = data.tasks.find(t => t.id === id);
    if (!t) { console.error('未找到任务:', id); continue; }
    if (cmd === 'done' && t.status !== 'done') { t.status = 'done'; t.doneAt = now; hit++; }
    else if (cmd === 'undo' && t.status !== 'todo') { t.status = 'todo'; t.doneAt = null; hit++; }
  }
  data.done = data.tasks.filter(t => t.status === 'done').length;
  data.updatedAt = now;
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 1), 'utf8');
  regenerateMd(data);
  console.log((cmd === 'done' ? '已完成标记:' : '已回退:') + ' ' + hit + ' 项 | 总进度 ' + data.done + '/' + data.total);
} else {
  // status
  data.done = data.tasks.filter(t => t.status === 'done').length;
  regenerateMd(data);
  console.log('总进度: ' + data.done + '/' + data.total);
  const next = data.tasks.filter(t => t.status !== 'done').slice(0, 8);
  console.log('下一批任务:');
  for (const t of next) console.log('  ' + t.id + ' [' + t.phase + '] ' + t.title);
}
