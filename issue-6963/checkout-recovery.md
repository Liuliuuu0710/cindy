# Checkout 恢复与复验

2026-10-26，按用户请求恢复；#6963 代码修复留到 2026-10-27 再看，未创建自动提醒或定时运行。

## 恢复范围

本轮宿主 cwd 已指向主仓库 `feat/advice-answer-cards`，不是上一轮隔离工作区。通过现有 worktree 登记定位 `.cindy-worktrees/swift-mirzakhani`，复用 `cindy/swift-mirzakhani`，HEAD 保持 `af1e36d3ada8d73737d6a2f7f4eb3e2c611a1c53`，未切分支或新建 worktree。

恢复前：索引只有 AGENTS.md、CLAUDE.md 两条；其余 17,078 项为暂存删除。磁盘已有 600 个受跟踪文件全部与 HEAD 内容一致，16,480 个缺失；本任务成果目录仍在。

恢复时先将索引恢复到 HEAD，再用不带 force 的 checkout-index 补缺失文件，保留已有内容。Git 索引锁位于受保护的共享 `.git`，经宿主提权后写入成功。post-checkout 与 LFS filter 因 PATH 缺少 git-lfs 报错；索引实际已恢复，按实况继续，没有删 hook 或改永久 Git 配置。

普通文件使用仅本次命令生效的空 LFS filter 补齐；5 个 sqlite-vec LFS 资源随后从共享 Git LFS 本地缓存读取，每个先核对指针记录的 SHA-256 和 size，再恢复到本隔离工作区。不下载、不改缓存，不把指针文件冒充可运行二进制。

## 实际验证

- 17,080 个受跟踪文件全部存在。普通文件 Git blob 哈希、可执行位与 HEAD 一致。
- 5 个 LFS 二进制的 SHA-256、字节数与 HEAD 指针一致；无内容或权限差异。
- `git diff --cached --shortstat` 为空；17,078 个暂存删除已清除。
- 主仓库前后均为 `22 files changed, 436 insertions(+), 94 deletions(-)`，没有在主仓库执行写操作。
- `python3 issue-6963/prototype.py --verify` 再次退出 0，10 项合成流程检查通过。保留的原型和报告均未删除。

## 仍未验证

当前命令环境没有 Node、pnpm、git-lfs；未安装依赖、运行 Desktop、业务单测或 typecheck。文件恢复以逐文件内容及可执行位校验为准，不宣称缺少 git-lfs 的常规 Git filter 工具链已经可用。

真实伙伴 B 读取 A 的普通任务、链接支持、模型摘要质量、群／访客权限与跨设备验收仍未完成；本轮没有产品代码修改、写入用户数据库、跨任务发送、提交或推送。后续继续时应在此 worktree 准备正确的工具链，再按 README 的验收流程处理，不混入主仓库改动。
