# Changelog

## v3.6.0 (Unreleased)

### Added
- **Scene panel command center.** Polished the side panel with a branded header, roster manager drawer, log viewer, auto-pin highlight toggle, and quick focus-lock controls so every button delivers meaningful actions.
- **Summon toggle for the scene panel.** Hide the panel completely and bring it back with a floating summon button that stays available as a quick toggle so the chat column can reclaim the full width whenever you need extra room.
- **Inline scene roster settings.** The footer button now opens an in-panel settings sheet with quick toggles for auto-open behavior, section visibility, and roster avatars.
- **Roster expiry counter.** Every roster entry now displays the remaining message count before it expires, making it easy to spot characters that are about to drop from the scene.
- **Aurora side panel finish.** The roster workspace picked up animated lighting, hover glows, and a responsive section scaffold so the settings footer stays anchored and never falls off-screen.

### Improved
- **Scene control center polish.** Refined the panel with a live-status banner, quick section navigation chips, richer hover states, and smoother animations to make the roster workspace feel faster and more intentional.
- **Live log export parity.** Copying the live log now produces a full report with detection summaries, switch analytics, skip reasons, and roster state—matching the fidelity of the live pattern tester output.

### Fixed
- **Scene panel analytics remapping.** Detection events recorded during streaming now follow the rendered message key, restoring roster/results feeds that previously appeared empty after generation finished.
- **Scene panel mounting.** Resolving pre-fetched container references no longer breaks roster rendering, fixing the empty panel and console error triggered when the UI initializes.
- **Scene panel rehydration.** Switching chats or waiting for autosaves now restores the latest assistant message so the roster, active characters, and live log remain populated instead of clearing after a few seconds.
- **Live log stability.** The live diagnostics panel keeps the prior message data visible until the next stream produces detections, so it no longer flickers "Awaiting detections" while idle.
- **Scene panel hide toggle.** Hiding the command center now removes the panel entirely so no translucent shell remains on screen.
- **Scene control center refresh.** Event subscriptions now match additional SillyTavern generation hooks, so the roster, live diagnostics, and status copy update right after streaming and message completion without needing manual history edits.
- **Streaming event detection.** The scene panel now tracks SillyTavern's symbol-based generation events, restoring auto-open behaviour and post-stream analytics updates for live messages.

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
