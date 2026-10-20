# #5684 自动回归证据（2026-10-20）

macOS 26.5.1（25F80），Global 隔离开发版，提交 85bcc56d54048e0912b9afe5422db199830e9a55，包含已合并修复 #6521。本次未新增应用代码改动。

验证入口：插件 → 技能 → 本地技能；设置 → 插件 → 技能 → 本地技能。均为实际运行的应用组件与本地技能数据。

中文组词和选字通过操作系统前台按键驱动真实输入法；DOM 监听只采集事件，不注入 composition 事件。普通英文与部分基线文字用自动化直接填入。截图为应用内容，不包含操作系统原生候选窗；候选窗证据沿用原评论中的用户实测截图。

早期脚本因候选状态中断、页面定位、列表未切换完成出现失败尝试，未将这些尝试列入通过证据。最终结果按实际路由、输入框、焦点和匹配列表检查；粘贴对照额外确认本地标签及 insertFromPaste。系统拼音测试后恢复微信拼音。

## 当前验收清单

- [x] macOS 微信拼音：管理页和设置内嵌页的组词、选字、取消；微信拼音 wei 选字后仅保留「味」。
- [x] macOS 系统简体拼音：两处入口的组词、选字、取消和中文命中。wei 的首选为「为」，按实际候选验收，没有强行声称选中了「味」。
- [x] 输入 Cindywei 后按 Esc，保留已提交的 Cindy 和输入焦点；设置页保持打开。
- [x] 英文 reddit 搜索、中英混输 Cindy味、删除中文后重输、清空恢复列表。
- [x] 实际输入「创建」命中 cindy-skill-creator 和 cindy-plugin-creator。
- [x] 两处入口用系统剪贴板和 Cmd+V 粘贴「味」「创建」；文本与筛选结果符合输入法选字结果，观察到真实 insertFromPaste 事件。测试后恢复原剪贴板。
- [x] 3 个定向测试文件共 59 项通过；本次 30 个界面检查点通过，分别留存截图。
- [ ] Windows 上的原生中文输入法：当前只有 macOS 环境。
- [ ] 搜狗及其他未列出的输入法：本机未安装搜狗。
- [ ] 原报告设备及其实际「＋」菜单入口：本次验证的是两处现有技能管理搜索框。
- [ ] 已发布安装包：本次使用包含 #6521 的隔离开发版。
- [ ] 公开 SkillHub 在线检索及深色模式目检：本次验收仅限本地技能、浅色模式。

## 定向测试

命令：`pnpm --filter desktop exec vitest run src/renderer/features/skillhub/__tests__/SkillhubHomeNavigation.test.tsx src/renderer/features/plugin/__tests__/PluginManagementLayout.test.tsx src/renderer/components/settings/__tests__/useSettingsEscape.test.tsx`

结果：SkillhubHomeNavigation 27、PluginManagementLayout 16、useSettingsEscape 16，共 59/59 通过。未新增代码，所以未追加整仓测试或类型检查。

## 逐项截图

| 检查点 | 入口 | 实际输入框值 | 结果 |
| --- | --- | --- | --- |
| [01-native-committed](01-native-committed.png) | 技能管理页 | 味 | 通过 |
| [02-direct-text-equivalence](02-direct-text-equivalence.png) | 技能管理页 | 味 | 通过 |
| [03-mixed-composition](03-mixed-composition.png) | 技能管理页 | Cindywei | 通过 |
| [04-native-cancel-prefix](04-native-cancel-prefix.png) | 技能管理页 | Cindy | 通过 |
| [05-mixed-commit](05-mixed-commit.png) | 技能管理页 | Cindy味 | 通过 |
| [06-delete-chinese](06-delete-chinese.png) | 技能管理页 | Cindy | 通过 |
| [07-retype-chinese](07-retype-chinese.png) | 技能管理页 | Cindy味 | 通过 |
| [08-chinese-matching](08-chinese-matching.png) | 技能管理页 | 创建 | 通过 |
| [09-english-matching](09-english-matching.png) | 技能管理页 | reddit | 通过 |
| [10-clear-restores](10-clear-restores.png) | 技能管理页 | 空 | 通过 |
| [11-settings-composition](11-settings-composition.png) | 设置内嵌页 | wei | 通过 |
| [12-settings-commit](12-settings-commit.png) | 设置内嵌页 | 味 | 通过 |
| [13-settings-prefix-composition](13-settings-prefix-composition.png) | 设置内嵌页 | Cindywei | 通过 |
| [14-settings-cancel](14-settings-cancel.png) | 设置内嵌页 | Cindy | 通过 |
| [15-settings-native-matching](15-settings-native-matching.png) | 设置内嵌页 | 创建 | 通过 |
| [16-settings-direct-equivalence](16-settings-direct-equivalence.png) | 设置内嵌页 | 创建 | 通过 |
| [17-settings-english](17-settings-english.png) | 设置内嵌页 | reddit | 通过 |
| [18-settings-clear](18-settings-clear.png) | 设置内嵌页 | 空 | 通过 |
| [19-apple-settings-composition](19-apple-settings-composition.png) | 设置内嵌页 | wei | 通过 |
| [19-apple-settings-commit](19-apple-settings-commit.png) | 设置内嵌页 | 为 | 通过 |
| [19-apple-settings-cancel-prefix](19-apple-settings-cancel-prefix.png) | 设置内嵌页 | Cindy | 通过 |
| [19-apple-settings-matching](19-apple-settings-matching.png) | 设置内嵌页 | 创建 | 通过 |
| [20-apple-management-composition](20-apple-management-composition.png) | 技能管理页 | wei | 通过 |
| [20-apple-management-commit](20-apple-management-commit.png) | 技能管理页 | 为 | 通过 |
| [20-apple-management-cancel-prefix](20-apple-management-cancel-prefix.png) | 技能管理页 | Cindy | 通过 |
| [20-apple-management-matching](20-apple-management-matching.png) | 技能管理页 | 创建 | 通过 |
| [21-management-native-paste-match](21-management-native-paste-match.png) | 技能管理页 | 创建 | 通过 |
| [21-management-native-paste-wei](21-management-native-paste-wei.png) | 技能管理页 | 味 | 通过 |
| [22-settings-native-paste-match](22-settings-native-paste-match.png) | 设置内嵌页 | 创建 | 通过 |
| [22-settings-native-paste-wei](22-settings-native-paste-wei.png) | 设置内嵌页 | 味 | 通过 |

## 结论与下一步

本机上述范围未复现字母累积，支持现有 #6521 修复。没有新增应用代码提交。建议由原报告者在包含修复的 Windows 构建中确认实际入口并执行 wei 选字、创建命中、Esc 取消，再验证正式安装包。尚不据此关闭 issue。
