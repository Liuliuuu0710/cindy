# Review follow-up: 44 × 44 pt cancel target

2026-10-30. iPhone 17 Pro Simulator / iOS 26.5 / mock only.
Code fix commit: 7a93449515a439a2240752ab44e7a9cfe37a0012.
QA bundle: fix/mobile-group-quote-alignment@cf2d0ebb0+e5e1718703 (fix + synthetic fixture).
Native fingerprint and Metro ownership matched.

- Visible circle remains 26 × 26; enclosing Pressable is 44 × 44, without hitSlop.
- Native accessibility frame in both themes: [341.7, 407.7, 44, 44].
- Light upper-left edge at (343.7, 409.7) cancelled the quote.
- Dark lower-right edge at (383.7, 449.7) cancelled the quote.
- Both edge taps were outside the visible circle; typed body remained visible.
- 113 page tests and Mobile package typecheck passed.
- Simulator verification only; physical iPhone unavailable, Android unverified.
