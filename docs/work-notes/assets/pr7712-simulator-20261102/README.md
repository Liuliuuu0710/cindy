# PR #7712 · Native simulator evidence · 2026-11-02

This supplements the merged [PR #7712](https://github.com/makecindy/cindy/pull/7712), following the screenshot requests on duplicate PR #8442. It is **native UI/component acceptance with synthetic transport**, not a new live-server end-to-end result.

## Environment and source

- Baguette simulator plugin, iPhone 17 Pro, iOS 26.5, 402 × 874 points, standard memory mode.
- UDID: `8104B97E-9CA2-4736-9DAC-9EFAED103E59`.
- Native fingerprint matched: `ddb763835cdf9497f45a5995db8830ae098b362f`.
- `sim-whoami --mock --udid … --json` reported `healthy: true`, `native-matched`, `target-fresh` after the acceptance route was added; source identity then `feat/mobile-direct-group-attachments@41bf7e99a+3b979e72cb`. Subsequent controlled fixture / baseline changes are described below and are not represented as the same whole-tree identity.
- AFTER: current production `ComposerFrame.ios.tsx`, SHA-256 `985eb8033c64f1dd00d3c677a85f49c60c0e7f88156c23bea3cc2e1733ec46ba`; identical to the attachment fix on main.
- BEFORE: exact `ComposerFrame.ios.tsx` from `a6fdc83f21^`. Only that component was temporarily replaced; this is a component comparison, not a full historical application build.
- Harness: [harness.tsx.txt](harness.tsx.txt). Uses production `BotGroupComposer`, `useMobileLocalAttachments` through its normal hook, `MobileComposerInputRow`, and `BotGroupMessageAttachments`. Native touches and typing go through the simulator plugin; no injected JS touch events.
- Upload and send promises are held/rejected/completed by visible harness buttons. The selected photo is a simulator-provided photo, selected through the production recent-photo sheet. Image rendering uses those actual selected bytes in memory.
- PDF is explicitly labeled **synthetic projection**, not selected or uploaded. Outer transcript labels/layout are harness UI, not the full production timeline.
- Temporary acceptance route removed and production ComposerFrame restored byte-for-byte after capture. No production code change or new native fingerprint.

## Observed results

| Check | Result and evidence |
| --- | --- |
| Group composer text focus / native keyboard, Light | [BEFORE](before-light-group-text.jpg) / [AFTER](after-light-group-text.jpg): text accepted, caret and keyboard visible. |
| Group composer text focus / native keyboard, Dark | [BEFORE](before-dark-group-text.jpg) / [AFTER](after-dark-group-text.jpg). |
| Group + opens production attachment sheet | [BEFORE Light](before-light-plus.jpg), [AFTER Dark](after-dark-plus.jpg). Buttons respond in this setup; the original touch failure was not reproduced here. |
| Another non-morph shared component | [BEFORE Dark](before-dark-shared-text.jpg), [BEFORE Light toolbar](before-light-shared-toolbar.jpg), [AFTER Dark](after-dark-shared-current-focus.jpg), [AFTER Light](after-light-shared-current-focus.jpg). Production shared input component with a harness toolbar; count increases on actual + taps. **This does not replace a second full production screen check.** |
| Upload in progress | [Dark](after-dark-uploading.jpg): photo immediately in real tray, spinner and remove button visible. |
| Upload fails | [Dark](after-dark-failed.jpg), [Light](after-light-failed.jpg): real error message + retry action. |
| Tap retry | [Light](after-light-retry-uploading.jpg): spinner returns; then controlled completion puts the uploaded item in tray. |
| Send held | [Light](after-light-sending.jpg): tray retained while send waits; accessibility observation additionally reported send busy/disabled and remove disabled. |
| Sent image attachment projection | [Light](after-light-image-preview.jpg), [Dark](after-dark-image-preview.jpg): actual selected photo displayed by production attachment renderer. |
| Sent PDF projection | [Light](after-light-pdf-projection.jpg), [Dark](after-dark-pdf-projection.jpg): filename and file icon displayed. **Synthetic metadata only.** |

## Observed issue, not signed off

During Dark → Light switching, the expanded glass input sometimes kept a dark grey material while text switched to light-theme colors, reducing contrast. The same behavior was seen with the BEFORE component ([screenshot](before-light-shared-toolbar.jpg)) and an AFTER mounted component ([screenshot](after-light-failed.jpg)); remounting restored the light surface ([AFTER](after-light-shared-current-focus.jpg)). A native sheet also showed mismatched material after relaunch in both variants. This comparison does **not** establish the root cause, and does not support an unconditional “Light/Dark all passed” claim.

## Remaining acceptance

- [ ] A second **full production** non-morph composer screen, before/after Light and Dark. The shared-component harness above is useful regression evidence but narrower.
- [ ] Actual production timeline and server-media authorization with sent image + file, including reopening history. The harness proves renderer layout, not server authorization/delivery.
- [ ] Normal iOS Files picker → PDF return → direct upload → partner reads content; the prior simulator file-provider failure remains unresolved and was not bypassed here.
- [ ] Real network/offline/reconnect retry and duplicate-send check against a real server. Controlled failure is UI evidence only.
- [ ] Investigate glass theme-switch material mismatch; verify in an ordinary production screen and on a physical iPhone.
- [ ] Physical iPhone on a current, source-verified build: photo/file selection and opening, attachment-only sending, partner content reading, keyboard/safe-area, foreground/background and reconnect.

No physical-device result is claimed. The iPhone was disconnected during this run.

