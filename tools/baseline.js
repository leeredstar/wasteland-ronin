/* T028 性能基线：连续运行冒烟测试，记录耗时与通过率 → outputs/perf-baseline.md */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/wasteland-ronin';
const RUNS = 5;

const results = [];
for (let i = 1; i <= RUNS; i++) {
  const t0 = Date.now();
  let out = '';
  try {
    out = execFileSync('node', [path.join(ROOT, 'test-smoke.js')], { encoding: 'utf8' });
  } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
  const ms = Date.now() - t0;
  const pass = /SMOKE PASS/.test(out);
  results.push({ run: i, ms, pass });
  console.log('run ' + i + ': ' + (pass ? 'PASS' : 'FAIL') + ' ' + ms + 'ms');
}

const passed = results.filter(r => r.pass).length;
const avg = Math.round(results.reduce((a, r) => a + r.ms, 0) / results.length);
const min = Math.min(...results.map(r => r.ms));
const max = Math.max(...results.map(r => r.ms));

let md = '# 冒烟基线（T028）\n\n';
md += '> 记录时间：' + new Date().toISOString() + ' ｜ Node ' + process.version + '\n\n';
md += '| 指标 | 值 |\n|---|---|\n';
md += '| 运行次数 | ' + RUNS + ' |\n';
md += '| 通过率 | ' + passed + '/' + RUNS + ' |\n';
md += '| 平均耗时 | ' + avg + 'ms |\n';
md += '| 最快 / 最慢 | ' + min + 'ms / ' + max + 'ms |\n\n';
md += '> 说明：耗时包含 vm 装配 12 个脚本 + 4600 帧模拟（约 77 游戏秒）。\n';
md += '> 后续每次 M0/M10 性能任务后重跑 `node tools/baseline.js` 更新本表，作为回归对照。\n';

fs.writeFileSync(path.join(ROOT, 'outputs/perf-baseline.md'), md, 'utf8');
console.log('baseline written. pass=' + passed + '/' + RUNS + ' avg=' + avg + 'ms');
if (passed !== RUNS) process.exit(1);
