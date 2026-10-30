# #7806 群运行条原生验收截图

## 结论边界（先读这里）

- 这些截图是 **正式生产组件 + 受控模拟数据（visual mock）** 的原生 UI 场景验收。
- **没有**接真实服务端：群聊快照、停止回执、空闲快照都由 `apps/mobile/src/debug/teammateVisualFixture.ts`
  的 `visual-run-*` 场景在内存里提供。真实远端端到端（真机/真群/真执行）仍是未测项，见最后一节。

## 运行来源

| 项 | 值 |
| --- | --- |
| 组件代码 SHA | `8da15837f6347656f38c10c99784e4de8ce714c7`（#7806 当时的 head；本次提交只在其上加 dev-only 场景数据与这些截图） |
| JS bundle 来源 | 本 worktree 的 Metro（`pnpm mobile:sim:start -- --mock`），端口 8081，`EXPO_PUBLIC_CINDY_MOBILE_VISUAL_MOCK=1` |
| 原生壳 | dev 构建（`com.xd.cindy`），仅替换 JS bundle；原生层未随本次提交变化 |
| 设备 | iOS 模拟器 `8104B97E-9CA2-4736-9DAC-9EFAED103E59`，iPhone 17 Pro，iOS 26.5 |
| 采集时间 | 2026-10-30 17:0x（本地） |

截图内的时间戳（如 17:10）是模拟数据中的消息时间，不是采集时间。

## 场景矩阵

| 文件 | 状态 | 断言要点 |
| --- | --- | --- |
| `single-light.png` / `single-dark.png` | 单执行运行中 | 紧凑运行条显示「Mimi 正在处理…」+ 看过程 / 停止；输入框右侧群级停止键 |
| `multiple-light.png` / `multiple-dark.png` | 多执行运行中 | Abu、Mimi 两条同时运行；**只有最后一条带「停止」**，上一条只有「看过程」 |
| `stop-pending-light.png` / `stop-pending-dark.png` | 停止请求中 | 快照仍为运行中，行内与停止位都显示「正在停止…」；停止入口不可再次触发 |
| `stop-failure-light.png` / `stop-failure-dark.png` | 停止失败 | 原生提示「没能停下这一轮，请再试一次」；运行条与停止入口保留，可重试 |
| `stop-failure-light-retry.png` | 失败后可重试 | 关闭提示后运行条仍在、`botGroup.work.stop` 仍可点（无障碍树核验，非新状态） |
| `stop-idle-light.png` / `stop-idle-dark.png` | 停止后空闲 | 收起发生在**下一份空闲快照**之后：运行条消失、头部从「有伙伴正在忙」回到「2 位成员」、输入框恢复发送键 |

## 未测项（不要读成已验证）

- 真实服务端：真群的 `round` 状态流转、真实 stop 回执与失败码、真实空闲快照时序。
- 真实多端：其他成员同时操作、跨端一致性、重连后的状态恢复。
- 大列表、长过程文本、附件等与运行条组合的布局。
