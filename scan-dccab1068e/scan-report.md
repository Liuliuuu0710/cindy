# PR #7853：最新 main 合并后的关联页面扫描

- 命令：`pnpm ui:check --changed --theme all`
- 70 个页面、1,184 个场景：925 通过，259 失败；退出码 1，不能视为全量通过。
- 耗时约 23 分 39 秒；建议卡片自身 4/4 通过。
- 扫描在工作树已合入 `d7c0e894fa`、尚未创建 merge commit 时启动，因此原始 summary 标记 `aacedad939+dirty`。该 Desktop 源码随后提交为 `9d48d2f885`；最终 head `dccab1068e` 仅再改手机图标的等值 Token 引用，Desktop 源码未再变化。
- 仅 `apps/desktop/src/renderer/vite-env.d.ts` 显示 UNCOVERED；声明文件不渲染界面，Desktop 类型检查已通过。

## 失败分类

| 分类 | 场景数 |
| --- | ---: |
| 窗口尺寸不匹配 | 234 |
| 场景超时 | 6 |
| 邮件沙箱 console | 12 |
| `v1.0.0` 被识别为未翻译 key | 2 |
| ResizeObserver / Target.createTarget | 5 |

## 独立复跑与 main 对照

- relay-service 默认场景：独立启动后 Light/Dark 均通过；支持窗口尺寸失败中存在跨场景状态串扰的判断，未据此宣称原 234 个尺寸失败全部通过。
- mail-reading 默认场景：独立启动后 Light/Dark 均通过；未据此消除其他邮件窄窗口、多邮件场景的失败。
- chat-video 菜单场景、region-capture 视频场景：在 PR 与 `origin/main` 对照中，Light/Dark 均重现 20 秒超时。
- local-plugin-sharing interactive：独立启动仍报 `untranslated keys rendered: v1.0.0`。main 对照的通用审计不会计入 errors，不能据 before captured 推断主干无此问题，也尚未据此认定为 PR 回归。
- 保留其他验证缺口；没有放宽安全设置、删除或弱化断言，也没有把其他页面或扫描器的独立问题扩入本 PR。

完整失败场景见同目录 `scan-failures.json`。原生手机截图仍需匹配的开发包和 CocoaPods。
