# PR #5678 文档冲突修复

已在本地分支 `fix/5678-doc-conflict` 完成，提交 `01e3c51f73da5caf0c81eeff7cd59793cba3a6ad`，带 DCO 签名。

## 保留的规则
- main：支持独立 Todo 的手机宿主可提供待办入口；例行任务不设独立图标。
- PR：保存失败且仍有草稿时询问是否放弃；确认恢复已保存资料并离开，取消留在当前页。

另修复两个测试文件的旧模拟配置，未删减断言，未手动改动自动合并后的产品代码。

## 验证
- 5 文件、128 项单测通过。
- 文档检查 10/10，通过 Desktop 类型检查、diff 格式检查及 DCO。
- Lint 有既有 `_id` 未使用错误，未修改 main 同样复现（main 第 28 行，本轮第 29 行）。
- 日志含 React act 提示。未重新实机验收、未跑 Windows 或完整 CI。

## 接入
`pr-5678-doc-and-test-compat.patch` 相对 PR head `03d053b0d6bb20540009dfc83f2597b142238818`，已通过 apply 检查。它只改 1 个文档与 2 个测试文件；是普通 unified diff，不是 git-format-patch。维护者在该 PR 分支保存现有工作后可先执行：

```sh
git apply --check pr-5678-doc-and-test-compat.patch
git apply pr-5678-doc-and-test-compat.patch
```

随后按项目规范提交（`git commit -s`）、同步 main 并检查最新 CI；若分支已有更新，先重新核对补丁。接入提交包含 main 与 #5678，不包含独立的 #6568 输入校验修复。

## 发布状态

用户于 2026-10-21 明确授权上传至 `Liuliuuu0710/cindy` 并将链接补充到 #5678。修复分支已上传：

- 分支：<https://github.com/Liuliuuu0710/cindy/tree/fix/5678-doc-conflict>
- 固定提交：<https://github.com/Liuliuuu0710/cindy/commit/01e3c51f73da5caf0c81eeff7cd59793cba3a6ad>

本目录为公开交付附件。源 PR head 仍为 `03d053b0d6bb20540009dfc83f2597b142238818`，需源仓库维护者接入；本轮未合并上游 PR。
