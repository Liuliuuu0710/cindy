# 真实读取验证（仅当前任务）

2026-10-26。在本任务现有授权内只读，无数据库变更，无跨任务发送，无私人记录扫描。以下是人工整理的最小回执字段，不保存原始正文或 agentMeta。

| 步骤 | 实际调用 | 实际结果 |
| --- | --- | --- |
| 1 | `get_task_digest(session_id=<来源消息里的委派 id>)` | `NOT_FOUND`；该 id 不是 business Session id，不据此判断没有历史 |
| 2 | `get_current_session_id({})` | `ok:true`；当前 Session `2dc94b2d-dd4a-4ddb-87b5-3327866fd714`，`agent_kind:codex` |
| 3 | `get_task_digest(session_id="2dc94b2d-dd4a-4ddb-87b5-3327866fd714")` | `ok:true`，标题「#6963｜接手任务时的背景与证据交接」，`phase:running`；最近用户要求与助手回复均非空，`sessionUrl` 缺失 |
| 4 | `get_chat_history(session_ids=["2dc94b2d-dd4a-4ddb-87b5-3327866fd714"], limit=1, order="asc")` | `ok:true`；返回首条 user 消息 `p58x2tyyyifjifm9wytvxvya`、时间 `2026-10-26T03:59:47.797Z`；正文与本任务接收的授权请求一致；`hasMore:true`，历史元数据没有 `sessionUrl` |

这证明：在当前普通执行任务中，B 可采用的摘要／原文读取原语确实有真实回执；可以用消息 id 与时间引用依据；需要分页时宿主明确回传 `hasMore`。本次只取验证入口所需的一条，不声称覆盖全部历史。

这没有证明：B 的伙伴私聊可读取 A 创建的普通任务、群成员／共享访客边界、跨设备读取、自动摘要正确性、任务链接可点击、责任变更或续办执行。上述仍需使用明确授权的 A／B 测试任务验证。

本地 main 已有 `sessionUrl` 实现，但当前运行宿主没有返回该字段；不手工拼 Cindy 深链，不用本地源码代替线上能力证据。原型中的 `sample.json` 链接仅用于打开合成原记录。
