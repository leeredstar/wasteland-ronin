# Math.random / 随机性审计（T006）

> 目标：全部迁移到 core/RNG.js，支撑确定性回放(M10)与联机同步(M17)。
> 审计对象：js/game.js @ v0.4

## 总量

| 通道 | 调用数 |
|---|---|
| 直接 Math.random | 11 |
| rand() | 88 |
| randi() | 5 |
| pick() | 10 |
| **合计** | **114** |

## 咽喉点（关键发现）

几乎所有随机经由三个封装函数（game.js 第 10/11/15 行定义）。因此迁移只需两步：

1. **阶段A（M10 前置）**：将 rand/randi/pick 内部改调 `worldRng.next()` → 全游戏确定性化；11 处直接调用逐个归类处理。
2. **阶段B（M10 打磨）**：把纯视觉调用点（粒子/血花等）拆到 `fxRng`（非种子）避免污染回放序列。

判定规则：**玩家能感知结果差异 ⇒ 必须走种子实例。**

## 分类统计（按行归类）

| 类别 | 行数 |
|---|---|
| 直接调用 | 11 |
| 待分类(多为特效/生成路径) | 51 |
| 命名 | 6 |
| 初始化 | 2 |
| AI | 4 |
| 战斗 | 1 |
| 特效 | 6 |
| 掉落 | 1 |
| 世界·生成 | 3 |

## 明细（每含调用的行记一条）

| 行号 | 类别 | 代码 |
|---|---|---|
| 10 | 直接调用 | `function rand(a, b) { return a + Math.random() * (b - a); }` |
| 10 | 待分类(多为特效/生成路径) | `(封装) function rand(a, b) { return a + Math.random() * (b - a); }` |
| 11 | 待分类(多为特效/生成路径) | `(封装) function randi(a, b) { return Math.floor(rand(a, b + 1)); }` |
| 15 | 直接调用 | `function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }` |
| 15 | 待分类(多为特效/生成路径) | `(封装) function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }` |
| 51 | 命名 | `(封装) var n = pick(SYL) + pick(SYL);` |
| 52 | 直接调用 | `if (Math.random() < 0.6) n += pick(SUF);` |
| 52 | 命名 | `(封装) if (Math.random() < 0.6) n += pick(SUF);` |
| 196 | 待分类(多为特效/生成路径) | `(封装) vx: rand(-70, 70), vy: rand(-70, 70),` |
| 197 | 待分类(多为特效/生成路径) | `(封装) life: rand(0.3, 0.6), maxLife: 0.6,` |
| 198 | 待分类(多为特效/生成路径) | `(封装) color: '#a3231a', size: rand(1.5, 3)` |
| 207 | 待分类(多为特效/生成路径) | `(封装) vx: rand(-110, 110), vy: rand(-110, 110),` |
| 208 | 待分类(多为特效/生成路径) | `(封装) life: rand(0.1, 0.22), maxLife: 0.22,` |
| 209 | 待分类(多为特效/生成路径) | `(封装) color: '#fff2c0', size: rand(1, 2)` |
| 217 | 待分类(多为特效/生成路径) | `(封装) vx: rand(-40, 40), vy: rand(-80, -30),` |
| 218 | 待分类(多为特效/生成路径) | `(封装) life: rand(0.4, 0.7), maxLife: 0.7,` |
| 219 | 待分类(多为特效/生成路径) | `(封装) color: '#ffd97a', size: rand(1.5, 2.5)` |
| 251 | 初始化 | `(封装) face: rand(0, TAU),` |
| 262 | 初始化 | `(封装) cool: rand(0, 0.4),` |
| 268 | AI | `(封装) wanderT: rand(0, 4),` |
| 269 | 待分类(多为特效/生成路径) | `(封装) thinkT: rand(0, 0.4),` |
| 351 | 直接调用 | `var r = Math.random();` |
| 364 | 直接调用 | `if (Math.random() < dodgeC) {` |
| 371 | 战斗 | `(封装) var raw = a.weapon.dmg * (0.75 + a.skills.str * 0.028) * rand(0.85, 1.15) * (0.6` |
| 386 | 特效 | `(封装) addDecal(d.x, d.y, rand(8, 12));` |
| 422 | 待分类(多为特效/生成路径) | `(封装) x: d.x + rand(-8, 8), y: d.y + rand(-4, 6),` |
| 423 | 待分类(多为特效/生成路径) | `(封装) vx: rand(-30, 30), vy: rand(-30, 10),` |
| 424 | 待分类(多为特效/生成路径) | `(封装) life: rand(0.3, 0.55), maxLife: 0.55,` |
| 425 | 待分类(多为特效/生成路径) | `(封装) color: '#cbb88f', size: rand(1.5, 3)` |
| 428 | 特效 | `(封装) addDecal(d.x, d.y, rand(10, 16));` |
| 460 | 特效 | `(封装) addDecal(u.x, u.y, rand(14, 22));` |
| 473 | 待分类(多为特效/生成路径) | `(封装) x: u.x + rand(-8, 8), y: u.y + rand(-8, 8),` |
| 474 | 掉落 | `(封装) cats: randi(u.lootMin, u.lootMax),` |
| 475 | 直接调用 | `food: (!u.isBeast && Math.random() < 0.3) ? randi(1, 2) : 0,` |
| 475 | 待分类(多为特效/生成路径) | `(封装) food: (!u.isBeast && Math.random() < 0.3) ? randi(1, 2) : 0,` |
| 504 | AI | `(封装) u.moveTarget = { x: master.x + rand(-50, 50), y: master.y + rand(-50, 50) };` |
| 537 | AI | `(封装) u.wanderT -= rand(0.3, 0.5);` |
| 539 | AI | `(封装) u.wanderT = rand(3, 8);` |
| 543 | 待分类(多为特效/生成路径) | `(封装) x: clamp(h.x + rand(-wr, wr), 40, WORLD.w - 40),` |
| 544 | 待分类(多为特效/生成路径) | `(封装) y: clamp(h.y + rand(-wr, wr), 40, WORLD.h - 40)` |
| 566 | 待分类(多为特效/生成路径) | `(封装) x: u.x + rand(-3, 3), y: u.y + rand(0, 5),` |
| 567 | 待分类(多为特效/生成路径) | `(封装) vx: rand(-8, 8), vy: rand(-14, -4),` |
| 569 | 待分类(多为特效/生成路径) | `(封装) color: '#cbb88f', size: rand(1.5, 2.5)` |
| 673 | 特效 | `(封装) addDecal(u.x + rand(-5, 5), u.y + rand(-3, 4), rand(5, 9));` |
| 727 | 待分类(多为特效/生成路径) | `(封装) if (u.thinkT <= 0) { u.thinkT = rand(0.3, 0.5); aiThink(u); }` |
| 809 | 待分类(多为特效/生成路径) | `(封装) var ang = rand(0, TAU);` |
| 810 | 待分类(多为特效/生成路径) | `(封装) var dc = rand(750, 2100);` |
| 826 | 直接调用 | `if (dh > 1800 && Math.random() < 0.45) ti = 2;` |
| 830 | 待分类(多为特效/生成路径) | `(封装) var n = randi(2, 4);` |
| 834 | 待分类(多为特效/生成路径) | `(封装) x: pos.x + rand(-40, 40), y: pos.y + rand(-40, 40),` |
| 838 | 世界·生成 | `(封装) weapon: WEAPONS[pick(tier.weapons)],` |
| 844 | 直接调用 | `armor: (tier.armorChance && Math.random() < tier.armorChance) ? ARMORS.leather : null` |
| 849 | 直接调用 | `if (ti === 2 && Math.random() < 0.22) {` |
| 853 | 待分类(多为特效/生成路径) | `(封装) x: pos.x + rand(-30, 30), y: pos.y + rand(-30, 30),` |
| 870 | 待分类(多为特效/生成路径) | `(封装) var n = randi(2, 3);` |
| 875 | 命名 | `(封装) name: pick(BEAST_NAMES),` |
| 876 | 待分类(多为特效/生成路径) | `(封装) x: pos.x + rand(-36, 36), y: pos.y + rand(-36, 36),` |
| 897 | 待分类(多为特效/生成路径) | `(封装) x: town.x + rand(-90, 90), y: town.y + rand(-90, 90),` |
| 1226 | 待分类(多为特效/生成路径) | `(封装) var ht = pick(HIRE_TYPES);` |
| 1229 | 待分类(多为特效/生成路径) | `(封装) x: shopTown.x + rand(-60, 60), y: shopTown.y + rand(-60, 60),` |
| 1234 | 命名 | `(封装) bodyColor: pick(['#4e6ea8', '#5a7ab8', '#46628f', '#3f5a95']),` |
| 1235 | 命名 | `(封装) hairColor: pick(['#2a201a', '#4a342a', '#151515', '#6b4a2f'])` |
| 1371 | 世界·生成 | `(封装) sl.homePoint = { x: clamp(sl.x + rand(-800, 800), 60, WORLD.w - 60), y: clamp(sl` |
| 1428 | 待分类(多为特效/生成路径) | `(封装) x: src[i].x + rand(-4, 4), y: src[i].y - 3,` |
| 1429 | 待分类(多为特效/生成路径) | `(封装) vx: rand(-8, 8), vy: rand(-55, -28),` |
| 1430 | 待分类(多为特效/生成路径) | `(封装) life: rand(0.35, 0.6), maxLife: 0.6,` |
| 1431 | 命名 | `(封装) color: pick(['#ff9a3c', '#ffce54', '#ff6b35']),` |
| 1432 | 待分类(多为特效/生成路径) | `(封装) size: rand(2, 3.5)` |
| 1841 | 世界·生成 | `(封装) spawnTimer = rand(10, 16);` |
| 1853 | 待分类(多为特效/生成路径) | `(封装) beastTimer = rand(20, 32);` |
| 2055 | 待分类(多为特效/生成路径) | `(封装) g.ellipse(rand(0, 256), rand(0, 256), rand(12, 44), rand(8, 26), rand(0, Math.PI` |
| 2060 | 直接调用 | `g.fillStyle = Math.random() < 0.5 ? 'rgba(90,70,40,.25)' : 'rgba(255,240,200,.25)';` |
| 2061 | 待分类(多为特效/生成路径) | `(封装) g.fillRect(rand(0, 256), rand(0, 256), 2, 2);` |
| 2069 | 待分类(多为特效/生成路径) | `(封装) var x = rand(40, WORLD.w - 40), y = rand(40, WORLD.h - 40);` |
| 2071 | 直接调用 | `var roll = Math.random();` |
| 2075 | 待分类(多为特效/生成路径) | `(封装) s: rand(0.7, 1.5),` |
| 2076 | 待分类(多为特效/生成路径) | `(封装) rot: rand(0, TAU)` |
| 2087 | 待分类(多为特效/生成路径) | `(封装) var rr = town.r * rand(0.45, 0.72);` |
| 2091 | 待分类(多为特效/生成路径) | `(封装) w: rand(48, 72), h: rand(38, 54)` |
| 2112 | 待分类(多为特效/生成路径) | `(封装) x: cam.x + rand(-800, 800),` |
| 2113 | 待分类(多为特效/生成路径) | `(封装) y: cam.y + rand(-500, 500),` |
| 2114 | 待分类(多为特效/生成路径) | `(封装) vx: rand(-6, 16), vy: rand(-3, 3),` |
| 2115 | 待分类(多为特效/生成路径) | `(封装) size: rand(0.8, 2), a: rand(0.08, 0.22)` |
| 2955 | 特效 | `(封装) sx = rand(-1, 1) * shakeT;` |
| 2956 | 特效 | `(封装) sy = rand(-1, 1) * shakeT;` |
