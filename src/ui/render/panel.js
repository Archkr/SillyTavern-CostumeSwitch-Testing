import {
    getScenePanelContainer,
    getSceneCollapseToggle,
    getSceneRosterList,
    getSceneActiveCards,
    getSceneLiveLog,
} from "../scenePanelState.js";
import { renderSceneRoster } from "./sceneRoster.js";
import { renderActiveCharacters } from "./activeCharacters.js";
import { renderLiveLog } from "./liveLog.js";

function applyCollapsedState(collapsed) {
    const container = getScenePanelContainer?.();
    const toggle = getSceneCollapseToggle?.();
    if (container && typeof container.attr === "function") {
        container.attr("data-cs-collapsed", collapsed ? "true" : "false");
    } else if (container?.[0]) {
        container[0].setAttribute("data-cs-collapsed", collapsed ? "true" : "false");
    }
    if (toggle && typeof toggle.attr === "function") {
        toggle.attr("aria-expanded", collapsed ? "false" : "true");
        toggle.attr("title", collapsed ? "Expand scene roster" : "Collapse scene roster");
    } else if (toggle?.[0]) {
        toggle[0].setAttribute("aria-expanded", collapsed ? "false" : "true");
        toggle[0].setAttribute("title", collapsed ? "Expand scene roster" : "Collapse scene roster");
    }
}

export function renderScenePanel(panelState = {}) {
    if (typeof document === "undefined") {
        return;
    }
    const container = getScenePanelContainer?.();
    if (!container || (typeof container.length === "number" && container.length === 0)) {
        return;
    }

    applyCollapsedState(Boolean(panelState.collapsed));

    const rosterTarget = getSceneRosterList?.();
    if (rosterTarget) {
        renderSceneRoster(rosterTarget, panelState);
    }

    const activeTarget = getSceneActiveCards?.();
    if (activeTarget) {
        renderActiveCharacters(activeTarget, panelState);
    }

    const liveLogTarget = getSceneLiveLog?.();
    if (liveLogTarget) {
        renderLiveLog(liveLogTarget, panelState);
    }
}
