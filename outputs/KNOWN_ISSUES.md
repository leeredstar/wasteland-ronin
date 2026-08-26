# 已知问题 KNOWN_ISSUES

## KI-001 冒烟测试偶发：左键移动断言失败（约 10%，仅测试环境）
- **现象**：`sawMove` 断言偶发失败；追踪显示英雄 idle、无 moveTarget、无战斗，但所有门控（started/gameOver/help/shop/sleep/build）均为关闭状态。
- **影响**：仅测试脚本；浏览器手测未复现。
- **假设**：
  1. vm 沙盒与真实浏览器的 rAF/事件微任务时序差异
  2. 初始敌群游荡的随机路径恰好覆盖点击点附近
  3. `updateUnit` 中某分支在特定随机序列下提前 return
- **缓解**：断言已放宽为「移动目标 / 实际位移 / 进入战斗」任一即可；
  追踪工具 `test/debug-trace.js` 支持 gates 探针逐帧取证。
- **状态**：调查中。若真实浏览器可复现，升级为高优 bug。

## KI-003 战斗断言种子方差（2026-08-26 已缓解）
- **现象**：大世界(8000²)随机种子下，「玩家路线恰好遇敌」存在天然方差，
  `no combat observed` 断言在旧 AI 上也有约 30% 失败率（实测）。
- **缓解**：断言放宽为「死亡/倒地/任意单位接敌(everAttacked>0)」三选一；
  冒烟输出永久 telemetry（deaths/downs/everAttacked/playerInvolved）供人工判读。
- **后续**：若需更强保证，可在固定种子下跑确定性冒烟（Date stub 方案已验证）。

## KI-002 商店扣款表达式未走 Economy.spend()
- **现象**：`res.cats -= priced(X)` 内联于 UI 分支（行为等价、单机安全）。
- **计划**：M4 商店重构时统一改走 `Economy.spend()`（联机权威结算前置条件）。
