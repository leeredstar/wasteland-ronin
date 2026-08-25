/* T100 价格表导出：outputs/prices.md */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const Items = require(path.join(ROOT, 'src/data/items.js'));

const rows = Object.keys(Items.all).map(function (id) {
  const d = Items.all[id];
  const eff = d.type === 'weapon'
    ? 'dmg ' + d.dmg + ' / reach ' + d.reach + ' / spd ' + d.speed
    : (d.type === 'armor' ? '减伤 ' + d.def
    : (d.use === 'food' ? '饱食 +45'
    : (d.use === 'bandage' ? '包扎伤口'
    : (id === 'campkit' ? '扎营+睡眠'
    : (id === 'mats' ? '建造材料'
    : (id === 'roboLimb' ? '力量+2 永不残废' : '—'))))));
  return { id: id, icon: d.icon || '·', name: d.name, type: d.type, price: d.price, eff: eff };
}).sort(function (a, b) { return b.price - a.price; });

let md = '# 物品价格总表\n\n';
md += '> 自动生成于 ' + new Date().toISOString() + '（tools/export-prices.js）\n';
md += '> 商店实际售价 = 基准价 × 声望折扣（≥25:85折 / ≥12:92折）\n\n';
md += '| 基准价 | 物品 | 类型 | 效果 |\n|---|---|---|---|\n';
rows.forEach(function (r) {
  md += '| ' + r.price + ' | ' + r.icon + ' ' + r.name + ' | ' + r.type + ' | ' + r.eff + ' |\n';
});
fs.writeFileSync(path.join(ROOT, 'outputs/prices.md'), md, 'utf8');
console.log('prices.md 写出（' + rows.length + ' 项）');
