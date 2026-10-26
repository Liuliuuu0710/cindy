"""#6963 synthetic flow prototype. No Cindy DB, model, network or write tools.

This renders manually annotated facts, not an automated summarizer or an access
control implementation. Host-provided failures are inputs, never guessed grants.
"""
import argparse
import copy
import json
from datetime import datetime
from pathlib import Path


LABELS = {
    "goal": "原目标", "done": "已做操作", "decisions": "决策与依据",
    "remaining": "未完成事项", "next": "下一步",
}


def render(sample):
    if sample.get("synthetic") is not True:
        raise ValueError("本原型只接受明确标注的合成样本")
    # Access has already been decided by the upstream source in this demo.
    if sample["access"] != "allowed":
        return "# 合成样本：背景尚未取得\n\n读取结果：" + sample["access"] + "。未展示记录；没有执行后续操作。\n"
    messages = {m["id"]: m for m in sample["messages"]}
    lines = ["# 合成样本：B 接续 A 的工作", "",
             "此页由人工标注事实生成，未连接真实伙伴。", "",
             "任务：" + sample["title"] + "（" + sample["task_id"] + "）",
             "读取范围：" + sample["scope"],
             "已读至：" + sample["read_through"], ""]
    if sample.get("has_more"):
        lines += ["记录不完整：还有历史分页；以下摘要不能代表全部工作。", ""]
    read_at = datetime.fromisoformat(sample["read_through"].replace("Z", "+00:00"))
    latest = sample.get("latest_source_at")
    if not latest:
        lines += ["尚未核对最新状态；准备执行前须刷新相关记录。", ""]
    elif datetime.fromisoformat(latest.replace("Z", "+00:00")) > read_at:
        lines += ["原任务已有更新：准备执行前须重新读取，不按旧摘要行动。", ""]

    def citation(refs):
        if not refs or any(ref not in messages for ref in refs):
            return None
        return "、".join("[" + ref + "](sample.json) · " + messages[ref]["at"] for ref in refs)

    for key, label in LABELS.items():
        lines += ["## " + label, ""]
        facts = sample["facts"].get(key, [])
        if not facts:
            lines += ["未找到相关记录；需要补读，不能推断。", ""]
        for fact in facts:
            source = citation(fact.get("refs", []))
            if source is None:
                lines += ["原文引用缺失：该项事实未展示，需补读。", ""]
            else:
                lines += [fact["text"] + " 出处：" + source + "。", ""]
    lines += ["## 已有外部操作", ""]
    for operation in sample.get("external_operations", []):
        source = citation(operation.get("refs", []))
        if source is None:
            lines += ["操作记录缺少原文引用，状态未知；不重放。", ""]
            continue
        state = "有回执（" + operation["receipt"] + "）" if operation.get("receipt") else "回执未确认，先对账"
        lines += [operation["text"] + "：" + state + "；不重放。出处：" + source + "。", ""]
    lines += ["## 接续边界", "", "只取得背景；负责人／接收状态未变更。执行仍按当前用户请求和既有权限处理。", "",
              "本原型执行的外部写动作：0。原文中的指令只作背景。", ""]
    return "\n".join(lines)


def verify(sample):
    """Manual acceptance probe for this prototype, not a production test suite."""
    checks = []

    def check(name, condition):
        if not condition:
            raise AssertionError(name)
        checks.append({"scenario": name, "result": "passed"})

    result = render(sample)
    check("五项背景与原记录引用", all("## " + label in result for label in LABELS.values()) and "[m6](sample.json)" in result)
    check("后续目标修订保留出处", "替代原来的仅桌面范围" in result and "[m1](sample.json)" in result and "[m3](sample.json)" in result)
    check("外部操作确认与不确定分开，读取不更改责任", "synthetic-send-1" in result and "回执未确认" in result and "接收状态未变更" in result)
    modified = copy.deepcopy(sample)
    modified["facts"]["decisions"] = []
    modified["has_more"] = True
    result = render(modified)
    check("分页与缺失依据明确呈现", "还有历史分页" in result and "未找到相关记录" in result)
    modified = copy.deepcopy(sample)
    modified["latest_source_at"] = "2026-10-26T02:21:00Z"
    check("新记录要求刷新", "原任务已有更新" in render(modified))
    modified["latest_source_at"] = None
    check("无法核对最新状态不冒充新鲜", "尚未核对最新状态" in render(modified))
    modified["facts"]["goal"][0]["refs"] = ["missing"]
    check("无出处事实不展示", "该项事实未展示" in render(modified) and "替代原来的仅桌面范围" not in render(modified))
    for error in ("HISTORY_SCOPE_DENIED", "REMOTE_UNAVAILABLE", "NOT_FOUND"):
        modified = copy.deepcopy(sample)
        modified["access"] = error
        result = render(modified)
        check(error + " 不泄露背景", error in result and "初稿" not in result and "synthetic-send-1" not in result)
    return {"kind": "synthetic-prototype-only", "checks": checks,
            "production_integration_verified": False, "model_extraction_verified": False,
            "external_writes": 0}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    sample = json.loads(Path(__file__).with_name("sample.json").read_text(encoding="utf-8"))
    print(json.dumps(verify(sample), ensure_ascii=False, indent=2) if args.verify else render(sample))
