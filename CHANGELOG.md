# Changelog

## v3.6.0 (Unreleased)

### Added
- **Scene panel command center.** Polished the side panel with a branded header, roster manager drawer, log viewer, auto-pin highlight toggle, and quick focus-lock controls so every button delivers meaningful actions.
- **Summon toggle for the scene panel.** Hide the panel completely and bring it back with a floating summon button that stays available as a quick toggle so the chat column can reclaim the full width whenever you need extra room.
- **Inline scene roster settings.** The footer button now opens an in-panel settings sheet with quick toggles for auto-open behavior, section visibility, and roster avatars.
- **Roster expiry counter.** Every roster entry now displays the remaining message count before it expires, making it easy to spot characters that are about to drop from the scene.
- **Aurora side panel finish.** The roster workspace picked up animated lighting, hover glows, and a responsive section scaffold so the settings footer stays anchored and never falls off-screen.
- **Coverage suggestions in the scene panel.** Vocabulary guidance from the live tester now appears alongside the roster with quick-add pills that update in real time as chats roll in.

### Improved
- **Scene control center polish.** Refined the panel with a live-status banner, quick section navigation chips, richer hover states, and smoother animations to make the roster workspace feel faster and more intentional.
- **Adaptive section sizing.** Remaining scene panel sections now stretch to fill the freed space as soon as any module is hidden, so two-up layouts immediately expand instead of waiting until only a single section remains.
- **Live log export parity.** Copying the live log now produces a full report with detection summaries, switch analytics, skip reasons, and roster state—matching the fidelity of the live pattern tester output.
- **Scene panel layout cleanup.** Retired the legacy collapse handle so the crest header and toolbar own panel visibility, keeping the frame tidy without the extra toggle stub.

### Fixed
- **Scene panel user message handling.** User-authored chat updates no longer trigger roster wipes or scene panel refreshes, so the control center stays stable and message counters persist while players talk.
- **Scene panel idle refresh.** Chat-change hooks now ignore updates that don't alter the latest assistant message, so editing system prompts or sending player chatter no longer clears or replays roster detections.
- **Scene panel auto-open triggers.** Auto-open on streaming or new results now re-enables the side panel when it was hidden, so updates bring the workspace back instead of staying out of view.
- **Buffer window trimming.** Streaming keeps matching after the max buffer limit trims older text, so outfit switching and live diagnostics continue instead of stalling at the limit.
- **Coverage fallback in the scene panel.** The side panel now reuses the latest tester coverage analysis when no live buffer is
  streaming so vocabulary suggestions stay visible between messages.
- **Skip reason flood control.** Live diagnostics cap repeated skip notices to keep recent switch and veto activity surfaced in
  the event list.
- **Roster inactivity detection.** Characters drop to an inactive state when they are missing from the latest detection pass,
  preventing message counters from stalling at their initial values.
- **Scene roster TTL countdown.** Remaining message counters now inherit their prior balance per character, so each roster entry ticks down independently instead of every slot sharing the same timer.
- **First-stream detection fallback.** Streaming tokens now capture their message key when the generation-start hook fires too early, restoring roster updates for the first outputs after loading a chat.
- **Scene roster scrolling.** The roster list keeps its scrollbox active so large casts remain accessible without shifting the entire panel.
- **Scene panel analytics remapping.** Detection events recorded during streaming now follow the rendered message key, restoring roster/results feeds that previously appeared empty after generation finished.
- **Scene panel mounting.** Resolving pre-fetched container references no longer breaks roster rendering, fixing the empty panel and console error triggered when the UI initializes.
- **Scene panel rehydration.** Switching chats or waiting for autosaves now restores the latest assistant message so the roster, active characters, and live log remain populated instead of clearing after a few seconds.
- **Live log stability.** The live diagnostics panel keeps the prior message data visible until the next stream produces detections, so it no longer flickers "Awaiting detections" while idle.
- **Live diagnostics retention.** Streaming preserves the full switch history for the active message instead of trimming entries mid-stream, so the log no longer empties before generation ends.
- **Scene panel hide toggle.** Hiding the command center now removes the panel entirely so no translucent shell remains on screen.
- **Scene control center refresh.** Event subscriptions now match additional SillyTavern generation hooks, so the roster, live diagnostics, and status copy update right after streaming and message completion without needing manual history edits.
- **Stream start detection resiliency.** Hidden and symbol-keyed SillyTavern events are now recognised when wiring the integration, keeping the side panel aware of streaming starts even when the host app reshuffles its hooks.
- **Streaming event detection.** The scene panel now tracks SillyTavern's symbol-based generation events, restoring auto-open behaviour and post-stream analytics updates for live messages.
- **Character slot persistence.** Pattern cards stay linked to the active profile after auto-saves, so follow-up edits continue to stick instead of silently rolling back.
- **Scene panel glow overflow.** The aurora backdrop now animates entirely inside the frame and keeps a generous bleed so no hard edges peek through mid-cycle.
- **Live tester isolation.** Running pattern simulations no longer injects tester roster data or log events into the side panel.
- **Scene completion gating.** Live tester streams no longer trigger the command center's completion handlers, so roster capture waits for real assistant messages to finish.
- **Roster activation regression.** Freshly detected characters now mark as active again when they enter the roster instead of staying flagged as inactive.
- **Manual refresh recovery.** The refresh control reloads the latest assistant outcome so the side panel actually updates instead of simply re-rendering stale data.

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
