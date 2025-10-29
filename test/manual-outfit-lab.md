# Manual QA: Outfit Lab

Use this checklist to verify the Outfit Lab UI behaves as expected when testing locally in the SillyTavern client.

1. Open the extension settings and switch to the **Outfits (WIP)** tab.
2. Confirm the experimental banner is visible and uses the "Experimental" badge with the new descriptive copy.
3. With **Enable Experimental Outfits** turned **off**:
   - The disabled notice should appear below the toggle.
   - The editor card should be dimmed, and the **Add Character Slot** button should be disabled.
   - Attempting to interact with any inputs inside the editor should have no effect.
4. Toggle **Enable Experimental Outfits** **on**:
   - The disabled notice disappears and the editor becomes interactive.
   - Click **Add Character Slot** and verify a new character card appears with editable name and default folder fields.
5. Add at least one outfit variation inside the new character card:
   - Confirm the folder picker button opens a directory picker (browser support permitting) and populates the folder input when a directory is chosen.
   - Enter several trigger lines and confirm they persist when you switch tabs or toggle the experimental switch off and back on.
6. Remove the variation and the character to ensure the list updates and the mapping table in the Characters tab reflects the changes.

Mark each item as you complete it before delivering the build.
