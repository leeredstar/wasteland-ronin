# 渲染契约 · 部位/状态 → 表现映射（v0.4，M2/T078）

> 目的：约定逻辑层字段如何驱动 Canvas2D（未来 Three.js）表现，
> 保证换渲染后端时视觉语义一致。逻辑层只提供数据，不做表现决定。

## 一、limbState → 四肢绘制

| limbState 值 | 含义 | 2D 表现 | 未来 3D 表现 |
|---|---|---|---|
| undefined | 正常肢体 | 布裤色/肤色线条 | 蒙皮骨骼段 |
| 'cut' | 截断 | 整段隐藏 + 断口圆盘 | 隐藏 mesh + 截面 |
| 'robo' | 机械义肢 | 金属色 `#a7adb6` + 微光 | 金属材质 + emissive |

来源：`Body.applyDamage()` 写入 `u.limbState[part]`；
渲染层只读，不反推。

## 二、body 部位血量 → 颜色梯度

| ratio (=hp/max) | 状态(state) | 色 |
|---|---|---|
| ≥0.7 | 完好 ok | 绿 #6fbf5a |
| 0.4~0.7 | 轻伤 hurt | 黄 #e0c050 |
| 0~0.4 | 重伤 bad | 红 #e0604c |
| ≤0（四肢）| 残废 gone | 暗灰 #3a3530 |
| robo 特殊 | 机械 | 蓝 #8fb8d8 |

接口：`Body.snapshot(u.body, u.limbState)` →
`{head:{ratio,state}, chest:{...}, ...}` 供 HUD 身体图与 3D 材质染色。

## 三、状态机 → 姿态

| state / 字段 | 表现 |
|---|---|
| idle/move/fight | 直立；move 时行走摆动（walkT 相位）|
| down 且 chest>0 | 躺姿 + “Zz”昏迷标记 |
| down 且 chest≤0 | 躺姿 + 红十字流血标记 + 地面血泊渐大（poolT）|
| dead | 躺姿灰化 + 45s 渐隐（LIFE.DEAD_TTL）|

## 四、其他约定

- 强盗头目：体型 scale≈1.18 + 红头巾/红缨。
- 义肢穿戴者：胸口金属覆层（护甲）+ 对应肢体金属色。
- 所有阈值来自 `data/balance.js`，渲染层不得硬编码数值。
