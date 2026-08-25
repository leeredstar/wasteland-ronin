# 荒原浪人 · Wasteland Ronin

> 仿 **Kenshi** 的网页沙盒生存游戏 —— 唯一目标差异：**支持多人在线**。
> 无任务 · 小队制 · 六部位伤害 · 技能越用越强 · 建造据点 · 联机协作

---

## 🎮 玩法速览

| 操作 | 效果 |
|---|---|
| 左键点队员 / 点空地 | 选择 / 移动 |
| 右键点地面 / 敌人 | 移动 / 攻击 |
| Tab · 数字1-5 | 全队选择 · 单选 |
| E / F | 商店 · 进食 |
| R / C | 救助倒地队友 · 绷带包扎 |
| V / Z | 扎营 · 睡到天亮 |
| X / B | 俘虏奴隶 · 建造模式 |

核心规则：每人有 **头/胸/双臂/双腿** 六个部位。胸归零→倒地流血（需队友救助），
头归零→昏迷，手臂伤→攻击变弱，腿伤→跑不动。技能**越用越强**。

## 🚀 运行

- **游玩**：双击 `index.html`（纯本地，无需服务器）
- **冒烟测试**：`npm run smoke`（无头模拟 4600 帧 + 完整交互序列）
- **进度查看**：`npm run progress`

## 📂 目录结构（设计文档 §三）

```
src/
├─ core/     Engine(固定步长) RNG(种子随机) EventBus
├─ world/    World(实体+空间哈希) Map Spawner Time
├─ entities/ Actor Body(六部位) Skills Inventory
├─ systems/  Combat AI Survival Economy Build   ← 纯逻辑，零 DOM
├─ ui/       HUD Minimap Overlays               ← 只读状态渲染
├─ input/    Input(意图队列) Camera
├─ data/     items enemies skills balance        ← 数据驱动(M3)
└─ save/     Save                                ← M9
js/game.js   遗留宿主（迁移期承载玩法；逐步瘦身）
test/        debug-trace.js 偶发bug逐帧追踪器
roadmap/     500任务清单(tasks.json) + progress.js
tools/       dom-audit / random-audit / baseline
outputs/     生成的报告与文档
```

### 架构铁律
1. **逻辑层零 DOM**：`src/systems|entities|world` 禁止 document/window 引用
   （`npm run audit:dom` 门禁检查）
2. **确定性**：游戏结果随机一律走 `WR.App.rng`（种子可保存→回放/联机同步）
3. **固定步长 60Hz**：update 与 render 解耦，渲染吃插值系数
4. **数据驱动**：新内容优先改 `src/data/*` 表，不改代码

## 🗺️ 演进路线（500 任务）

`roadmap/ROADMAP.md` — 22 个里程碑：

M0 重构基础 → M1 核心循环 → M2 部位伤害 → M3 数据管线 → M4 经济 →
M5 世界地图 → M6 AI → M7 据点 → M8 UI → M9 存档 → M10 性能 →
M11 测试体系 → **M12-M15 Three.js 3D 化** → **M16-M19 多人在线** →
M20 音频打磨 → M21 v1.0 发布

常用命令：

```bash
npm test          # （M11 后）全部单元测试
npm run smoke     # 冒烟回归
npm run progress  # 查看 500 任务进度与下一批
node tools/baseline.js            # 性能基线
node tools/dom-audit.js           # 逻辑层纯净度门禁
node test/debug-trace.js 40       # 偶发 bug 逐帧取证
```

## 🧪 工作方式

每完成一批任务：
1. `node --check` 所有改动文件
2. `npm run smoke` 必须全绿
3. `roadmap/progress.js done Txxx` 标记完成
4. 提交信息引用任务号

## 📄 授权与致敬

玩法灵感致敬 [Kenshi](https://lofigames.com/)（Lo-Fi Games）。
本项目为其**原创致敬实现**：不包含 Kenshi 的任何代码、素材或文本。
