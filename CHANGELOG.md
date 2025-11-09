# Changelog

## v3.6.0 (Unreleased)

### Fixed
- **Scene panel mounting.** Resolving pre-fetched container references no longer breaks roster rendering, fixing the empty panel and console error triggered when the UI initializes.

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
