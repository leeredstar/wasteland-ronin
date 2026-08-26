# DOM 访问审计（T026）

> 规则：`src/systems|entities|world` 逻辑层**禁止**出现 `document.*`；`js/game.js` 为遗留宿主，其 DOM 引用计入 M8/M12 迁移清单。

## 逻辑层门禁

| 文件 | document 引用 | 门禁 |
|---|---|---|
| src/systems/AI.js | 0 | ✅ 通过 |
| src/systems/AI.js.js | 0 | ✅ 通过 |
| src/systems/Build.js | 0 | ✅ 通过 |
| src/systems/Build.js.js | 0 | ✅ 通过 |
| src/systems/Combat.js | 0 | ✅ 通过 |
| src/systems/Combat.js.js | 0 | ✅ 通过 |
| src/systems/Economy.js | 0 | ✅ 通过 |
| src/systems/Economy.js.js | 0 | ✅ 通过 |
| src/systems/EconomyExt.js | 0 | ✅ 通过 |
| src/systems/Survival.js | 0 | ✅ 通过 |
| src/systems/Survival.js.js | 0 | ✅ 通过 |
| src/entities/Actor.js | 0 | ✅ 通过 |
| src/entities/Actor.js.js | 0 | ✅ 通过 |
| src/entities/Body.js | 0 | ✅ 通过 |
| src/entities/Body.js.js | 0 | ✅ 通过 |
| src/entities/Inventory.js | 0 | ✅ 通过 |
| src/entities/Inventory.js.js | 0 | ✅ 通过 |
| src/entities/Skills.js | 0 | ✅ 通过 |
| src/entities/Skills.js.js | 0 | ✅ 通过 |
| src/world/Map.js.js | 0 | ✅ 通过 |
| src/world/Pathfinding.js | 0 | ✅ 通过 |
| src/world/Spawner.js | 0 | ✅ 通过 |
| src/world/Spawner.js.js | 0 | ✅ 通过 |
| src/world/Terrain.js | 0 | ✅ 通过 |
| src/world/Time.js | 0 | ✅ 通过 |
| src/world/Time.js.js | 0 | ✅ 通过 |
| src/world/World.js | 0 | ✅ 通过 |
| src/world/World.js.js | 0 | ✅ 通过 |

## 遗留宿主（js/game.js）DOM 引用清单

共 **18** 处（迁移至 ui/ 层时清零）：

- L70: `document.getElementById` — var canvas = document.getElementById('game');
- L72: `document.getElementById` — var mmCanvas = document.getElementById('minimap');
- L74: `document.getElementById` — var bodyCanvas = document.getElementById('bodyCanvas');
- L165: `document.getElementById` — var $ = function (id) { return document.getElementById(id); };
- L220: `document.createElement` — var li = document.createElement('li');
- L1306: `document.createElement` — var rowEl = document.createElement('div');
- L1308: `document.createElement` — var left = document.createElement('div');
- L1310: `document.createElement` — var btn = document.createElement('button');
- L2066: `document.getElementById` — var box = document.getElementById('spawnChoices');
- L2078: `document.readyState` — if (document.readyState === 'loading') {
- L2079: `document.addEventListener` — document.addEventListener('DOMContentLoaded', bind);
- L2086: `document.getElementById` — var bar = document.getElementById('errBanner');
- L2088: `document.createElement` — bar = document.createElement('div');
- L2091: `document.body` — document.body.appendChild(bar);
- L2509: `document.createElement` — var c = document.createElement('canvas');
- L2742: `document.createElement` — var c = document.createElement('canvas');
- L2863: `document.createElement` — var c = document.createElement('canvas');
- L3695: `document.createElement` — cv = document.createElement('canvas');

## 结论

- ✅ **门禁通过**：逻辑层零 DOM 引用，满足无头测试与未来服务器复用要求。
