# Costume Switcher for SillyTavern

Costume Switcher is the companion piece to Lenny’s **Character Expressions** extension—it uses the same foundations, but instead of changing facial expressions it swaps the entire costume or avatar folder the moment a new speaker takes the spotlight. Install both and SillyTavern keeps the correct character in focus *and* their emotions in sync, giving you a live stage crew that reacts faster than you can type.

Under the hood the extension listens to streaming output from your model, scores every character mention it finds, and immediately updates the displayed costume to match the active speaker. It ships with powerful tooling, scene awareness, and a fully redesigned configuration UI so you can understand *why* a switch happened and tune the behaviour to fit any story.

> **New to Costume Switcher?** Start here, then hop over to the Character Expressions README. Together they form a best-friends duo: Expressions handles nuanced emotions, Costume Switcher handles wardrobe changes.

---

## Contents

1. [Highlights at a Glance](#highlights-at-a-glance)
2. [Requirements](#requirements)
3. [Installation](#installation)
4. [Architecture Overview](#architecture-overview)
5. [Custom Detection Engines](#custom-detection-engines)
   1. [Main Detection Engine (v3)](#main-detection-engine-v3)
   2. [Outfit Detection Engine (v1)](#outfit-detection-engine-v1)
6. [Getting Started in Five Minutes](#getting-started-in-five-minutes)
7. [Tour of the Settings UI](#tour-of-the-settings-ui)
8. [Understanding Live Tester Reports](#understanding-live-tester-reports)
9. [Advanced Configuration Tips](#advanced-configuration-tips)
10. [Slash Commands](#slash-commands)
11. [Sharing Top Characters with Other Extensions](#sharing-top-characters-with-other-extensions)
12. [Troubleshooting Checklist](#troubleshooting-checklist)
13. [Support & Contributions](#support--contributions)

---

## Highlights at a Glance

- **Narrative-aware detection** – Attribution, action, vocative, possessive, pronoun, and general mention detectors can be mixed to match the format of your prose.
- **Custom engine lineage** – The fully bespoke detection stack (currently in its third major revision) fuses streaming analysis with explainable telemetry so you always know why a switch occurred.
- **Scene roster logic** – Track who is currently in the conversation and favour them during tight scoring races.
- **Modern profile workflow** – Save, duplicate, rename, and export complete configurations with a couple of clicks.
- **Performance tuning** – Adjust global, per-trigger, and failed-trigger cooldowns plus the maximum buffer size and processing cadence.
- **Live Pattern Tester** – Paste sample prose, inspect every detection, review switch decisions, and copy a rich report for debugging or support requests.
- **Slash command helpers** – Add, ignore, or map characters on the fly without leaving the chat window, and log mention stats for the last message.
- **Scene cast exports** – Surface the top detected characters as slash commands or prompt variables so other extensions can react instantly.

---

## Requirements

- **SillyTavern** v1.10.9 or newer (release or staging). Earlier builds may lack UI hooks required by the extension.
- **Streaming enabled** in your model or API connector. Costume Switcher listens to streaming tokens; without streaming no automatic switches will occur.
- **Browser permissions** to read and write extension settings (enabled by default in SillyTavern).

---

## Installation

1. Open **Settings → Extensions → Extension Manager** in SillyTavern.
2. Click **Install from URL** and paste the repository address:
   ```
   https://github.com/archkrrr/SillyTavern-CostumeSwitch
   ```
3. Press **Install**. SillyTavern downloads the extension and refreshes the page.
4. Enable **Costume Switcher** from the Extensions list if it is not activated automatically.

To update, return to the Extension Manager and click **Update all** or reinstall from the same URL.

---

## Architecture Overview

Costume Switcher combines a lightweight UI layer with a purpose-built streaming analysis pipeline so that avatar changes arrive in perfect sync with the narrative.

- **Streaming bridge** – The extension taps into SillyTavern’s token stream and normalises messages into an incremental buffer that can be rescored every few characters without stalling the UI.
- **Profile-driven configuration** – Every slider, toggle, and text field in the settings drawer writes to a structured profile object. The profile is compiled into runtime detectors, cooldown rules, and costume mappings that can be swapped on the fly when you change stories.
- **Detection orchestration** – When new text appears, the orchestrator fans out the analysis work across multiple detectors, merges the results into a weighted scorecard, and then applies cooldowns, veto phrases, and roster context to determine which character should take the spotlight.
- **Rendering layer** – Once a winner is chosen, the renderer resolves the final costume folder, handles manual focus overrides, and dispatches the change to SillyTavern’s avatar manager without blocking the rest of the extension.

The entire stack was designed in tandem so that authors can iterate quickly, experiment with edge cases in the Live Pattern Tester, and ship polished character experiences without juggling ad-hoc scripts.

---

## Custom Detection Engines

Costume Switcher does not rely on third-party libraries for detection. Every matcher, bias rule, and cooldown is part of a fully custom detection stack purpose-built for SillyTavern roleplay. Both engines below share a common orchestration layer, yet each is tuned for a different job so you can mix expressive character work with razor-sharp costume swaps.

### Main Detection Engine (v3)

Version 3 of the primary detection engine powers all speaker attribution. It represents the third full rewrite of the pipeline and ships with the following pillars:

- **Adaptive mention parsing** – Custom lexers interpret narrative dialogue markers, action beats, and pronoun references in real time to deliver confident matches even when prose gets experimental.
- **Contextual weighting** – Scene roster intelligence, recency decay, and per-detector weights are blended to promote the most believable speaker rather than the most frequent name.
- **Cooldown governance** – Global, per-trigger, and failure-specific cooldowns are enforced centrally so that rapid-fire switches stay smooth instead of jittery.
- **Explainer-first telemetry** – Every detection is logged with type, score, and rationale, powering the Live Pattern Tester’s switch timeline and exported reports for transparent debugging.

The v3 engine is the culmination of extensive field feedback. It prioritises deterministic behaviour, approachable tuning, and maintainability so new detectors can slot in without destabilising existing stories.

### Outfit Detection Engine (v1)

Costume changes deserve their own specialised logic. The outfit detection engine (currently version 1) translates the winning speaker into a wardrobe action using a mapping table, fallback defaults, and optional manual focus locks.

- **Folder resolution graph** – Character aliases, regex entries, and manual overrides converge into a single resolved costume path so you can align multiple avatars with one identity.
- **Bias-aware switching** – The engine respects the same cooldown and veto logic as the primary detector, ensuring costume swaps mirror narrative intent without visual whiplash.
- **State recovery** – Manual resets and default costume fallbacks keep the experience resilient; even if the roster changes mid-session the engine gracefully lands on a sensible wardrobe.

Future updates will iterate on version 1 by layering in richer wardrobe states and shared presets while preserving the confidence-first ethos of the current build.

---

## Getting Started in Five Minutes

1. **Enable the extension.** Expand the Costume Switcher drawer and toggle **Enable Costume Switching** on.
2. **List your characters.** Enter one name (or `/regex/`) per line inside **Active Characters**. Longer names should appear above abbreviations.
3. **Pick the core detectors.** Under **Detection Strategy**, enable **Detect Attribution**, **Detect Action**, and **Detect Pronoun** for narrative-style writing. Add **Scene Roster** if multiple characters speak in the same scene.
4. **Test a sample.** Paste a recent reply into the **Live Pattern Tester** and click **Test Pattern**. Review the detections to confirm the correct costume is chosen.
5. **Save the profile.** Use the **Save** button in the Profiles card to store the configuration for future sessions.

That’s it—you can now focus on storytelling while the avatars keep up automatically.

---

## Tour of the Settings UI

### Header & Master Toggle
The hero header summarises what the extension does and houses the **Enable Costume Switching** toggle. Turn it off temporarily to pause detection without losing any settings.

### Profiles
Create tailored setups for different stories or formats:
- **Select** swaps between saved profiles.
- **Save** writes changes back to the currently selected profile.
- **Save As** copies the active profile under a new name typed in the field.
- **Rename** updates the active profile’s name to the text input value.
- **New (Defaults)** starts from the built-in defaults; **Duplicate Current** clones the active profile first.
- **Delete**, **Import**, and **Export** round out the lifecycle so you can archive and share JSON profiles.

### Character Patterns & Filters
Teach the detector which names to recognise:
- **Active Characters** accepts plain names or `/regex/` entries—one per line.
- **Ignored Characters** suppresses specific matches without removing them from the character list.
- **Veto Phrases** stops detection entirely for a message when the phrase or regex is found (useful for OOC tags).

### Presets & Focus
Kickstart new profiles with curated presets, configure a **Default Costume** to fall back to, and optionally engage **Manual Focus Lock** to pin the avatar to a specific character until you unlock it.

### Detection Strategy
Toggle the individual detectors the engine can use. Tooltips in the UI explain the common scenarios for each detection type. Enable **Scene Roster** to maintain a rolling list of characters active in the conversation and adjust the **Scene Roster TTL (messages)** to control how long they stay on that list.

### Performance & Bias
Fine-tune responsiveness and tie-breaking behaviour:
- **Global Cooldown (ms)** – Minimum time between any two costume changes.
- **Repeat Suppression (ms)** – Minimum time before the same character can switch again.
- **Per-Trigger Cooldown (ms)** – Delay before the same detection type (e.g., action) can trigger again.
- **Failed Trigger Cooldown (ms)** – Backoff applied after a switch attempt is rejected.
- **Max Buffer Size (chars)** – Hard cap on how much of the recent stream is analysed.
- **Token Process Threshold (chars)** – Number of characters that must arrive before the buffer is rescored.
- **Detection Bias** – Slider balancing match priority versus recency; positive numbers favour dialogue/action tags, negative values favour the latest mention.

### Costume Mappings
Map any detected name or alias to a specific costume folder. Use **Add Mapping** to append rows, then fill in the character and destination folder names.

### Live Pattern Tester
Paste sample prose and inspect:
- **All Detections** – Every match in order with its type and priority.
- **Live Switch Decisions** – Real-time simulation showing switches, skips, scores, and veto events.
- **Top Characters** – A live summary of the best scoring speakers pulled from the same logic driving the stream.
- **Copy Report** – Generates an extensive plain-text report containing summaries, skip breakdowns, switch stats, final state details, and key settings so you can share diagnostics quickly.

### Footer Controls
Use **Save Current Profile** as a one-click commit for any edits and **Manual Reset** to snap back to your default costume or main avatar. Status and error banners let you know when actions succeed or if validation fails.

---

## Understanding Live Tester Reports
Every report copied from the tester includes:
- **Input metadata** – Profile name, timestamps, original/processed length, and veto status.
- **Detection log** – List of every detection with match type, character index, and priority.
- **Switch timeline** – Each decision, including score, detection kind, and why switches were skipped.
- **Detection summary** – Aggregated counts per character, highest priority hit, and the range of positions that matched.
- **Switch summary** – Total and unique costumes, the last switch, and the top scoring triggers.
- **Skip reasons** – Counts of why detections were ignored (cooldowns, existing costume, veto, etc.).
- **Final stream state** – Scene roster contents, last accepted name, last subject, processed length, and simulated duration.
- **Top characters** – Ranking of the four strongest contenders including mention counts, roster status, and weighted scores.
- **Key settings snapshot** – Cooldowns, thresholds, roster flag, and bias value in effect during the test.
Attach these reports when filing bug reports or asking for tuning advice—everything needed to reproduce the issue is included.

---

## Advanced Configuration Tips
- **Tune the buffer** when working with long-form prose. Reduce **Max Buffer Size** to keep focus on the latest paragraphs or increase it to catch callbacks to earlier exposition.
- **Combine cooldowns** to eliminate flicker. A short global cooldown paired with per-trigger cooldowns stops rapid-fire switches without muting genuinely new speakers.
- **Scene roster** excels in multi-character RP. Keep the TTL close to the number of alternating speakers to maintain context without dragging in old participants.
- **Custom verb lists** (Attribution/Action) help the detectors understand bespoke writing styles. Add uncommon dialogue tags or narrative verbs as needed.

---

## Slash Commands
All commands are session-scoped—they modify the active profile until you reload the page.

| Command | Description |
| --- | --- |
| `/cs-addchar <name>` | Appends a character or regex to the profile’s patterns list and recompiles detections. |
| `/cs-ignore <name>` | Adds a character or regex to the ignore list for the current session. |
| `/cs-map <alias> to <folder>` | Creates a temporary mapping from `alias` to the specified costume folder. |
| `/cs-stats` | Logs a breakdown of detected character mentions for the most recent AI message to the browser console. |
| `/cs-top [count]` | Returns a comma-separated list of the top detected characters from the last AI message and logs the result to the browser console. Accepts `1`–`4`; defaults to four names. |
| `/cs-top1` – `/cs-top4` | Shortcuts for pulling exactly the top 1–4 characters without specifying an argument. |

---

## Sharing Top Characters with Other Extensions
After each AI message finishes streaming, Costume Switcher ranks every detected character and exposes the results in two convenient ways:

- **Prompt variables** – The latest data lives under `extensions.SillyTavern-CostumeSwitch-Testing.session` in SillyTavern templates.
  - `topCharactersString` provides a ready-to-use comma-separated list (ideal for Group Expressions).
  - `topCharacters` (array) and `topCharacterDetails` (objects with `name`, `count`, `score`, and `inSceneRoster`) offer structured access for advanced prompts.
- **Slash commands** – Use `/cs-top [count]` or the `/cs-top1` … `/cs-top4` shortcuts inside chat inputs, macros, or automations to inject the ranked list on demand.

Because these exports are refreshed on every message, you can wire them directly into Lenny’s **Group Expressions** extension or any other automation that needs to know who dominated the scene without burdening the model with extra thinking instructions.

---

## Troubleshooting Checklist
1. **No switches happen:** verify streaming is enabled, the master toggle is on, at least one detection method is selected, and the characters appear in the patterns list exactly as they do in the story.
2. **The wrong character is chosen:** run the Live Pattern Tester, read the skip reasons, and adjust Detection Bias or enable Scene Roster to give dialogue tags more weight.
3. **Switches flicker between characters:** raise the global cooldown, tweak per-trigger cooldowns, or disable **Detect General Mentions** for subtle references.
4. **Reports show a veto:** check the Veto Phrases list to confirm the text did not match an OOC filter.
5. **Profiles do not persist:** ensure you click **Save** after editing and confirm the SillyTavern browser tab has permission to write local storage.

---

## Support & Contributions
Issues and pull requests are welcome. When reporting a problem, include:
- The copied Live Pattern Tester report (using **Copy Report**).
- Your SillyTavern build number and API provider.
- Any custom detector, cooldown, or buffer settings that differ from defaults.

This information helps others reproduce the behaviour quickly and suggest accurate fixes or tuning advice.
