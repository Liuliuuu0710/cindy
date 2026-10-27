# PR #7445 iOS native task tag acceptance

Synthetic test data only. These are screenshots of the real iOS native development application, not HTML or a static component mock.

- Product source: `fix/6947-ios-task-tags`, `d47990cf35`.
- Runtime source label: `fix/6947-ios-task-tags@d47990cf3+84aae8c626`.
- Global, Metro `localhost:8081`, iPhone 17 Pro Simulator, iOS 26.5.
- Installed native app: `com.xd.cindy`, version `0.1.0`, build `2026072301`.
- Native fingerprint: `cee3bb8bd1228b1fc9b0ce56a4e1d2eed59bbfa9`; installed and worktree fingerprints matched.
- The dirty suffix covers only the temporary `tag-qa` route and the visual mock transport bridge in `fixture/`. The production tag components are the committed versions above. Neither fixture change is included in the PR.

The temporary route mounts the real `TaskTagsSheet`, `TaskTagsPanel`, and `NativeTaskTagsExpanded` under the existing application providers. A local HTTP bridge sends only task-tag operations to the unmodified production `runTaskTagsTransaction`, backed by a fresh on-disk SQLite database. Its synchronous Node SQLite adapter and temporary database are independent of every user profile. Only three synthetic tags and `session-primary` exist in this fixture. Themes use a subtree theme override; the original app preference is untouched.

## Results

1. Native handles appear after entering sorting; the ordinary page retains selection and edit controls.
2. Actual pointer drags in Light and Dark emitted complete `reorder` requests and changed SQLite order. Light moved `qa-ideas` from first to last; Dark moved `qa-work` from first to last. The closed/reopened sheet kept the order. See `after-light-drag.json`, `after-dark-drag.json`, and `host-operations.jsonl`.
3. Editing `qa-work`, pressing delete, and confirming the affected count (1 task) issued `previewDelete` and `delete` with matching revision/count. Reopening displayed only `qa-follow` and `qa-ideas`. A fresh independent read-only SQLite connection confirmed the same rows; see `fresh-sqlite-read.json`.
4. A left swipe did not expose an unconfirmed delete action or remove a tag.
5. In the temporary locked/disconnected-state fixture, `完成排序` still exited sorting; entering sorting and writes then remained disabled. This is a UI lock simulation, not a real device-link disconnection.
6. Light and Dark normal/sorting/done screenshots were visually inspected. Main screenshots are whole Simulator screen captures, without cropping or compositing.

## Boundaries

This proves native SwiftUI interaction, the shared JS tag flow, and actual SQLite transaction writes through the isolated test bridge. It does **not** prove a physical iPhone, a packaged Windows Host, or the full device-link network/permission path. The default UI mock alone cannot write tags, hence the explicit bridge and synthetic fixture.

The temporary route/bridge were removed after acceptance. The original #6881 Metro worktree and simulator environment were restored at that worktree's current source (`fix/6881-mobile-text-attachment-preview@52ef3cd3d`), non-mock Global mode, native fingerprint matched. The simulator system appearance was restored to Light.
