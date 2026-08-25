/* T100 价格表导出 + T101 敌人强度曲线导出 */
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/wasteland-ronin';
const Items = require(path.join(ROOT, 'src/data/items.js'));
const Enemies = require(path.join(ROOT, 'src/data/enemies.js'));

/* ---- 价格表 ---- */
const rows = Object.keys(Items.all).map(function (id) {
  const d = Items.all[id];
  const eff = d.type === 'weapon' ? ('dmg' + d.dmg + '/reach' + d.reach + '/spd' + d.speed) :
              (d.type === 'armor' ? ('def' + d.def) :
              (d.use === 'food' ? '饱食+45' : (d.use === 'bandage' ? '包扎' :
              (id === 'campkit' ? '扎营' : (id === 'mats' ? '建造×1' :
              (id === 'roboLimb' ? '力量+2' : '-'))))));
  return { id: id, name: d.icon + ' ' + d.name, type: d.type, price: d.price, eff: eff };
}).sort(function (a, b) { return b.price - a.price; });

let md = '# 物品价格总表（M3/T100 自动生成）\n\n';
md += '> 生成时间：' + new Date().toISOString() + '\n';
md += '> 商店实际售价 = 基准价 × 声望折扣（≥25:85折 / ≥12:92折）\n\n';
md += '| 价格 | 物品 | 类型 | 类别 | 效果 |\n|---|---|---|---|---|\n';
rows.forEach(function (r) {
  md += '| ' + r.price + ' | ' + r.name + ' | ' + r.type + ' | ' + r.eff + ' |\n';
});
fs.writeFileSync(path.join(ROOT, 'outputs/prices.md'), md, 'utf8');
console.log('prices.md 写出（' + rows.length + ' 项）');

/* ---- 强度曲线 ---- */
const tiers = [
  ['tier0 饥饿强盗', 46, 6, 13, '0 ~ 950'],
  ['tier1 强盗', 78, 13, 24, '950 ~ 1800'],
  ['tier2 荒原剑客', 118, 19, 28, '1800+'],
];
let cm = '# 敌人强度-距离曲线（M3/T101）\n\n';
cm += '> 距离基准：枢纽镇中心。tier 由 Spawner.tierForDistance 决定。\n\n';
cm += '| 距离带 | 原型 | HP | 近战 | 闪避 |\n|---|---|---|---|---|\n';
tiers.forEach(function (t) {
  cm += '| ' + t[4] + ' | ' + t[0] + ' | ' + t[1] + ' | ' + t[3] + ' | ' + t[2] + ' |\n';
});
cm += '\n特殊：\n- 强盗头目（160HP/近战21/锁子甲）：tier2 区域 22% 概率随队出现\n';
cm += '- 荒原狼（44HP/速度118）：全图狼巢周期刷新，低血逃跑\n';
cm += '- 城镇卫兵（130HP/近战18/皮甲）：城镇固定巡逻\n';
fs.writeFileSync(path.join(ROOT, 'outputs/curve.md'), cm, 'utf8');
console.log('curve.md 写出');
