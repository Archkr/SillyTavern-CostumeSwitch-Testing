# Changelog

## v3.6.0 (Unreleased)

### Added
- **Scene panel command center.** Polished the side panel with a branded header, roster manager drawer, log viewer, auto-pin highlight toggle, and quick focus-lock controls so every button delivers meaningful actions.
- **Summon toggle for the scene panel.** Hide the panel completely and bring it back with a floating summon button so the chat column can reclaim the full width when you need extra room.
- **Inline scene roster settings.** The footer button now opens an in-panel settings sheet with quick toggles for auto-open behavior, section visibility, and roster avatars.

### Fixed
- **Scene panel analytics remapping.** Detection events recorded during streaming now follow the rendered message key, restoring roster/results feeds that previously appeared empty after generation finished.
- **Scene panel mounting.** Resolving pre-fetched container references no longer breaks roster rendering, fixing the empty panel and console error triggered when the UI initializes.
- **Scene panel rehydration.** Switching chats or waiting for autosaves now restores the latest assistant message so the roster, active characters, and live log remain populated instead of clearing after a few seconds.
- **Live log stability.** The live diagnostics panel keeps the prior message data visible until the next stream produces detections, so it no longer flickers "Awaiting detections" while idle.

## v3.5.0

### Added
- **Character slot editor.** Replaced the plain character textarea with a structured slot editor that supports per-slot names, aliases, folders, quick search, and auto-save when adding new entries, making large casts easier to manage.
- **Dialogue scanning toggle.** Added a setting that lets the attribution and action detectors optionally scan quoted dialogue, unlocking better support for transcript-style prose.
- **Focus lock awareness.** The extension now surfaces focus-lock status with periodic notices and records the skip event so telemetry and reports explain why switching paused.
- **Skip-reason telemetry.** Live tester panels and exported reports summarise recent cooldown and veto skips so you can see whether throttling blocked a switch.

### Improved
- **Richer name parsing.** Detection regexes now understand honorifics, descriptive commas, and compound names while sharing the new structured pattern list, greatly improving match accuracy across localisation styles.
- **Pronoun hand-off.** Pronoun matches only fire when a confirmed subject exists, and message state now carries pending subjects between buffers to smooth streaming transitions.
- **Veto insights.** The last vetoed phrase is recorded for both live runs and tester sessions, making it obvious which safeguard halted detection.

### Fixed
- **Pattern exhaustion feedback.** When every pattern is ignored, the UI now raises an actionable error instead of silently stalling detection.
- **Skip summaries reset correctly.** Clearing tester results or rerunning tests now resets skip summaries so stale cooldown data no longer lingers.
- **Focus lock cleanup.** Clearing a focus lock resets the notice state, preventing phantom “detection paused” messages after unlocking.
