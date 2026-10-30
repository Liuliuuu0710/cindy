# PR #8009 — Mobile quote visual verification

2026-10-30. iPhone 17 Pro Simulator, iOS 26.5, portrait 402 × 874 pt.
Global development app com.xd.cindy, v0.1.0 (2026072301), mock data only.
Source: fix/mobile-group-quote-alignment@cf2d0ebb0+0db5ee2156; Metro 8081.
Native fingerprint matched; source ownership check passed; fresh iOS bundle observed.
Production UI source is PR cf2d0ebb09. Dirty change is a temporary synthetic-data fixture only.

Light and Dark checked in the running native app:
- Author, quote rail, two-line long excerpt, truncation and reply body are readable.
- Sent quote appears inside the user bubble above the body.
- Composer quote card and X remain visible with the on-screen keyboard open.
- Touching X removes the quote while preserving the typed body in both modes.

The screenshots use synthetic pre-seeded sent messages. No real message was sent.
The available physical iPhone was disconnected: this is simulator verification, not hardware acceptance.
Android, attachment-only quotes, deleted-source visual states, and alternate font scales were not visually checked.
Metro emitted existing dependency-cycle, deprecated navigation-prop and initial bundle-stall warnings; no quote-rendering error appeared.

Files: light-sent.jpg / dark-sent.jpg, light-draft.jpg / dark-draft.jpg,
light-cancel.jpg / dark-cancel.jpg, source-label.jpg.
