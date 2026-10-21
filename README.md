# #6568 修复与证据交付

代码提交：f5ffcd4398b70978d03866d9707c74df40563de2
代码：https://github.com/Liuliuuu0710/cindy/commit/f5ffcd4398b70978d03866d9707c74df40563de2
目标 PR：https://github.com/makecindy/cindy/pull/5678

当前账号没有 PR 源仓库 lengjingxu/cindy 或上游的写权限。因此代码仅推送到自己的 fork，PR #5678 的代码尚未更新；未新建替代 PR、合并或发布应用。

下载并打开 issue-6568-report.html 可阅读离线图文报告（19 张嵌入图片）。
issue-6568.patch 是带 DCO 签名的 git-format-patch 补丁；source/ 是同版本 14 个改动文件快照。
source-manifest.json 包含每个源文件 SHA-256；代码与此前实机验证版本一致。

基线 f25a95f3b289d74b6aa4f18c78f8e2693b1ba4c6；不是旧 PR 的基线。
接入旧 PR 的预检存在 6 个文件冲突，详见 publication.json。请先同步 PR 基线，保留已有 discard / leaveForClose 行为，再适配校验和错误状态。未验证合并后的组合行为，不能直接覆盖目标分支。

已完成验证：相关测试 132/132、Desktop 类型检查、定向 ESLint、i18n/glossary、运行器自检 4/4、通用 UI 178/178（17 页、双主题）。保留 100 条非阻断告警；5 个伙伴设置生产文件未获通用单页场景覆盖，改用真实 Desktop 验收。五语言×双主题截图均为独立开发实例。

HTML 已复验 1100 浅色、320 浅色、390 深色：19 图全部加载，未发现横向溢出或 JS 错误，原图放大可用。
原失败日志与成功日志均保留；evidence/ui-check-run/ 为完整通用 UI 原始产物。

公开附件已完成敏感内容核验；失败日志的两处机器临时根路径已脱敏，详见 SENSITIVE-CONTENT-AUDIT.md 与 redactions.json。截图及源码原文未改动。
