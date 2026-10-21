## #6568 输入校验修复：提交与验收材料（待接入本 PR）

**本条是待接入交付，PR #5678 的代码尚未更新。** 当前账号对源仓库 `lengjingxu/cindy` 及上游都没有 push 权限。已有退出/放弃逻辑保持由本 PR 处理；没有新建替代 PR。

- 已签名并推送的修复：[f5ffcd4398](https://github.com/Liuliuuu0710/cindy/commit/f5ffcd4398b70978d03866d9707c74df40563de2)
- [HTML 图文报告（下载后离线打开）](https://github.com/Liuliuuu0710/cindy/blob/pr-assets/issue-6568-20261021/issue-6568-report.html)
- [脱敏证据包 ZIP](https://github.com/Liuliuuu0710/cindy/blob/pr-assets/issue-6568-20261021/issue-6568-delivery.zip)
- [DCO 补丁](https://github.com/Liuliuuu0710/cindy/blob/pr-assets/issue-6568-20261021/issue-6568.patch) · [SHA-256 校验值](https://github.com/Liuliuuu0710/cindy/blob/pr-assets/issue-6568-20261021/SHA256SUMS)

## 这次改了什么

### 摘要

在独立 Desktop 中复现：性格文本 trim().length=12868，宿主报 `[INVALID_PARAMS] identitySource 超过长度上限 12000`。界面原先只提示保存失败，重试仍失败，关闭和 Esc 被阻止，输入保留。

本提交在真实保存入口增加校验，显示字段上限和超出量；完整保留输入，修正后自动保存。匹配宿主 trimmed UTF-16 长度语义（名字 200、自我介绍/性格 12000），安全映射 IPC 错误，不展示原始异常；确定性拒绝不显示无效重试。恢复已保存值后清除旧失败。文本框有高度上限，错误提示保持可见。

另外修复通用 UI 构建器的 `?url` 资源解析与扫描：worklet 作为独立资源，不执行为页面代码；保留普通导入身份、资源指纹与 compare 旧资源恢复。

### 变更类型 / 范围

- `fix`：Issue #6568，14 个文件；未修改服务端、持久化 schema、退出/放弃契约。
- 没有 breaking change；未更新正式应用。
- 代码基线 `f25a95f3b2`；旧 PR head `03d053b0d6`。直接接入预检有 6 个文件冲突：UI build/selftest、BotBasicProfileFields、BotsHomeView、botSettings 测试、useBotSettingsAutosave。旧 PR 未含 UI 脚本；需先同步基线，保留 discard/leaveForClose，再适配校验和错误状态。**未验证组合后的代码，不能直接覆盖目标分支。**

### UI 变化

引用的设计规范：`docs/design-rules/DESIGN.md` 的 DS-6 form usage（FormField label/hint/error、预留反馈、无效字段焦点）及 §10 Light / Dark Dual-Mode Delivery Gate。复用语义 token 和 FormField，五语提示自然换行，真实 Desktop 浅深色均已检查。

## 怎么验证的

### 自动验证

- 四个相关文件的 Vitest：132/132（botSettings 79、autosave 25、drawer 12、chatSurface 16）；总耗时 31.77 秒。
- `pnpm --filter desktop run typecheck`：通过。
- 生产文件定向 ESLint：通过；i18n 13283 keys 一致，glossary 无新增违规。
- `pnpm ui:check:selftest`：4/4，14.56 秒；新增资源用例在旧代码失败、修复后通过。
- `pnpm ui:check --changed --theme all`：178/178，17 页，114.7 秒；runtimeClosed / scratchRemoved 均为 true。
- `pnpm check:dco`：1 commit signed off；完整 diff 已自审、diff check 通过。

测试价值：`botSettings.test.tsx` 从真实设置组件进入文本框与 IPC 边界，最小失败输入为 limit+1；覆盖输入保留、200/12000 边界、首尾空白和 emoji、错误类型、修正保存及卸载。`botSettingsAutosave.test.ts` 覆盖提交未完成时恢复基线、随后迟到拒绝的竞态；旧测试没有这条恢复路径。`runner.selftest.mjs` 从真实 build/scan 入口验证 `audio processor.js?url`，覆盖发出的文件原文、URL、资源指纹和 compare 已删除资源；既有 CLI 测试没有资源导入。运行器属于构建集成测试，完整文件耗时包含 Electron 进程验收。业务文件本次同批实测为 15.017 秒与 0.050 秒（非独立文件运行；较慢的组件文件含 79 项及环境资源竞争）。

### 手工验证

macOS 26.5.1 arm64，源码开发版 0.0.0，Chromium 148.0.7778.280，独立 Global 开发实例、本地跳过登录。路径：测试伙伴 → 设置 → 性格与说话习惯 → 输入超长文本 → 等待自动保存 → 重试 → 关闭/Esc → 修正 → 重新打开确认持久化。11999/12000 可保存，12001 阻止；五语言×浅深色均检查，测试伙伴原文已恢复。所有截图对应本提交的相同文件哈希，提交行为未改变源文件。

### 未执行的验证

Windows、Mobile、远程伙伴、生产账号和正式安装包未验证；完整 test:all 及目标 PR CI 尚未执行。通用 UI 的 100 条非阻断告警原样保留；5 个伙伴设置生产文件仍无注册单页夹具，依赖前述真实 Desktop 与相关测试，不能将通用检查通过当成它们获得单页覆盖。与本 PR 退出逻辑合并后的运行验收尚未进行。

## 风险

### 风险分类 / 影响与回滚

影响本地伙伴设置输入反馈及通用 UI 检查构建。无数据库、协议、权限、插件或原生指纹变更。回滚本提交可撤销本次修复。当前主要接入风险是旧 PR 基线与关闭/丢弃状态机冲突；尚未完成合并验收。

### 提交前检查

- [x] 已 review 完整 diff；DCO 已通过。
- [x] 设计规范与双模式证据已注明。
- [x] 未提交凭证/授权文件；原工作区无关改动未改动。
- [x] 已核对验证与缺项；产品运行规则未改变。

## 公开附件核验

原包 683 个文件已核验；442 张去重截图全部完成本机离线 OCR，结合夹具源码和实机图复核。失败日志中两处机器临时目录根路径已脱敏，未发现实际凭证或私人会话；截图与源码快照保持原样。[核验记录](https://github.com/Liuliuuu0710/cindy/blob/pr-assets/issue-6568-20261021/SENSITIVE-CONTENT-AUDIT.md)。

## 截图证据

真实 Desktop 截图来自独立测试实例。前后主要场景 1280×800，五语言场景 960×720；截图显示开发基线加修复，与提交文件哈希一致。通用 UI 场景使用宿主夹具，不代表真实群聊发送验收。完整原图默认展开。

### 修复前：笼统错误及无效重试

![修复前：笼统错误及无效重试](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/before-error.png)

### 修复前：关闭仍被阻止

![修复前：关闭仍被阻止](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/before-close-blocked.png)

### 修复后：超限反馈，浅色

![修复后：超限反馈，浅色](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/after-limit-light.png)

### 修复后：超限反馈，深色

![修复后：超限反馈，深色](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/after-limit-dark.png)

### 名字与自我介绍上限，深色

![名字与自我介绍上限，深色](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/after-profile-dark.png)

### 修正后保存成功

![修正后保存成功](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/after-saved-light.png)

### 重新打开后读取已保存值

![重新打开后读取已保存值](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/after-reopened-light.png)

### zh-CN · light · 960×720

![zh-CN · light · 960×720](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/locale-zh-CN-light.png)

### zh-CN · dark · 960×720

![zh-CN · dark · 960×720](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/locale-zh-CN-dark.png)

### en · light · 960×720

![en · light · 960×720](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/locale-en-light.png)

### en · dark · 960×720

![en · dark · 960×720](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/locale-en-dark.png)

### zh-TW · light · 960×720

![zh-TW · light · 960×720](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/locale-zh-TW-light.png)

### zh-TW · dark · 960×720

![zh-TW · dark · 960×720](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/locale-zh-TW-dark.png)

### ja · light · 960×720

![ja · light · 960×720](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/locale-ja-light.png)

### ja · dark · 960×720

![ja · dark · 960×720](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/locale-ja-dark.png)

### ko · light · 960×720

![ko · light · 960×720](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/locale-ko-light.png)

### ko · dark · 960×720

![ko · dark · 960×720](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/locale-ko-dark.png)

### 通用 UI 夹具：group-chat · 浅色

![通用 UI 夹具：group-chat · 浅色](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/ui-group-light.png)

### 通用 UI 夹具：group-chat · 深色

![通用 UI 夹具：group-chat · 深色](https://raw.githubusercontent.com/Liuliuuu0710/cindy/pr-assets/issue-6568-20261021/ui-group-dark.png)
