/* T101 敌人强度曲线导出：outputs/curve.md */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let md = '# 敌人强度-距离曲线（M3/T101）\n\n';
md += '> 距离基准：枢纽镇中心。tier 由 Spawner.tierForDistance 决定。\n\n';
md += '| 距离带 | 原型 | HP | 近战 | 闪避 | 掉落(猫) |\n';
md += '|---|---|---|---|---|---|\n';
md += '| 0~950 | tier0 饥饿强盗 | 46 | 6 | 6 | 8-25 |\n';
md += '| 950~1800 | tier1 强盗 | 78 | 13 | 11 | 20-60 |\n';
md += '| 1800+ | tier2 荒原剑客 | 118 | 19 | 16 | 80-160 |\n';
md += '\n特殊单位：\n\n';
md += '- **强盗头目**（160HP/近战21/锁子甲/野太刀）：tier2 区域 22% 概率随队，掉 150-320 猫\n';
md += '- **荒原狼**（44HP/速度118/獠牙）：全图狼巢刷新，低血逃跑，掉 5-16 猫\n';
md += '- **城镇卫兵**（130HP/近战18/铁刀+皮甲）：城镇固定巡逻，袭击后翻脸 90 秒\n';

fs.writeFileSync(path.join(ROOT, 'outputs/curve.md'), md, 'utf8');
console.log('curve.md 写出');
