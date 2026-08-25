/* T150 性能目标：首次世界生成 <300ms（Terrain 全量生成 = 最重路径） */
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* 直接 require 逻辑模块（零 DOM，Node 可跑） */
const Terrain = require(path.join(ROOT, 'src/world/Terrain.js'));

function bench(name, fn) {
  const t0 = process.hrtime.bigint();
  const out = fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`${name}: ${ms.toFixed(1)} ms`);
  return { ms, out };
}

let ok = true;

/* 1) 地形全量生成（含装饰900/废墟/塔楼/游商/狼巢/道路） */
const r1 = bench('Terrain.create(全量世界生成)', () => Terrain.create({ seed: 12345 }));
if (r1.ms > 300) { ok = false; console.log('  ✗ 超出 300ms 目标'); }

/* 2) 群系采样吞吐（渲染层每块 64 格采样 ×2 帧 ≈ 热路径参考） */
const t = r1.out;
const r2 = bench('biomeAt ×10000', () => {
  let s = 0;
  for (let i = 0; i < 10000; i++) s += t.biomeAt(i * 7.3 % 8000, i * 13.7 % 8000).length;
  return s;
});
console.log(`  (${(r2.ms * 100).toFixed(1)} ns/次)`);

/* 3) 二次生成同种子耗时一致性（缓存预热后的稳态） */
const r3 = bench('Terrain.create 同种子二次', () => Terrain.create({ seed: 12345 }));

const md = `# 世界生成性能报告\n\n> ${new Date().toISOString()}\n\n| 项目 | 耗时 | 目标 |\n|---|---|---|\n| Terrain.create 全量 | ${r1.ms.toFixed(1)}ms | <300ms |\n| biomeAt 单次 | ${(r2.ms * 100).toFixed(0)}ns | 参考值 |\n| 同种子二次生成 | ${r3.ms.toFixed(1)}ms | - |\n\n## 结论\n\n${ok ? '✅ **达标。** 首次世界生成在 300ms 内。' : '❌ 未达标，需要优化。'}\n`;
require('fs').writeFileSync(path.join(ROOT, 'outputs/perf-worldgen.md'), md, 'utf8');
console.log(ok ? 'PERF PASS' : 'PERF FAIL');
process.exit(ok ? 0 : 1);
