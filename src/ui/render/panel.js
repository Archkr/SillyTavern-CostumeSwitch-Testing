import {
    getScenePanelContainer,
    getSceneCollapseToggle,
    getSceneRosterList,
    getSceneActiveCards,
    getSceneLiveLog,
    getSceneRosterSection,
    getSceneActiveSection,
    getSceneLiveLogSection,
    getSceneStatusText,
    getSceneCoverageSection,
    getSceneCoveragePronouns,
    getSceneCoverageAttribution,
    getSceneCoverageAction,
    getSceneSectionsContainer,
} from "../scenePanelState.js";
import { renderSceneRoster } from "./sceneRoster.js";
import { renderActiveCharacters } from "./activeCharacters.js";
import { renderLiveLog } from "./liveLog.js";
import { renderCoverageSuggestions } from "./coverage.js";
import { resolveContainer, clearContainer, createElement } from "./utils.js";

let scenePanelSummonButton = null;

function ensureScenePanelSummonButton() {
    if (typeof document === "undefined") {
        return null;
    }
    if (scenePanelSummonButton && scenePanelSummonButton.isConnected) {
        return scenePanelSummonButton;
    }
    const existing = document.getElementById("cs-scene-panel-summon");
    if (existing) {
        scenePanelSummonButton = existing;
        return scenePanelSummonButton;
    }
    const button = createElement("button", "cs-scene-panel__summon");
    if (!button) {
        return null;
    }
    button.id = "cs-scene-panel-summon";
    button.type = "button";
    button.setAttribute("data-scene-panel", "show-panel");
    button.setAttribute("aria-controls", "cs-scene-panel");
    button.setAttribute("aria-label", "Show scene panel");
    button.title = "Show scene panel";
    button.setAttribute("aria-pressed", "false");
    button.dataset.panelVisible = "false";
    button.dataset.panelCollapsed = "false";
    const icon = createElement("i", "fa-solid fa-masks-theater cs-scene-panel__summon-icon");
    if (icon) {
        icon.setAttribute("aria-hidden", "true");
        button.appendChild(icon);
    }
    const label = createElement("span", "cs-scene-panel__summon-label");
    if (label) {
        label.textContent = "Scene panel";
        button.appendChild(label);
    }
    button.hidden = true;
    button.setAttribute("aria-hidden", "true");
    const parent = document.body;
    if (parent) {
        parent.appendChild(button);
    }
    scenePanelSummonButton = button;
    return scenePanelSummonButton;
}

function updateScenePanelSummonVisibility(enabled, { collapsed = false } = {}) {
    const button = ensureScenePanelSummonButton();
    if (!button) {
        return;
    }
    if (!button.isConnected && typeof document !== "undefined" && document.body) {
        document.body.appendChild(button);
    }
    button.dataset.visible = "true";
    button.dataset.panelVisible = enabled ? "true" : "false";
    button.dataset.panelCollapsed = collapsed ? "true" : "false";
    button.hidden = false;
    button.removeAttribute("hidden");
    button.removeAttribute("aria-hidden");
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    button.setAttribute("aria-label", enabled ? "Hide scene panel" : "Show scene panel");
    button.title = enabled ? "Hide scene panel" : "Show scene panel";

    const icon = button.querySelector(".cs-scene-panel__summon-icon");
    if (icon) {
        icon.classList.remove("fa-eye", "fa-eye-slash", "fa-masks-theater");
        icon.classList.add(enabled ? "fa-eye-slash" : "fa-masks-theater");
    }

    const label = button.querySelector(".cs-scene-panel__summon-label");
    if (label) {
        label.textContent = enabled ? "Hide Scene Panel" : "Show Scene Panel";
    }

    if (!enabled) {
        try {
            button.focus({ preventScroll: true });
        } catch (err) {
            try {
                button.focus();
            } catch (innerErr) {
            }
        }
    }
}

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

function applyPanelEnabledState(enabled, { collapsed = false } = {}) {
    const container = getScenePanelContainer?.();
    const { $, el } = resolveContainer(container);
    const value = enabled ? "false" : "true";
    if ($ && typeof $.attr === "function") {
        $.attr("data-cs-disabled", value);
        $.attr("aria-disabled", enabled ? "false" : "true");
        $.attr("aria-hidden", enabled ? "false" : "true");
    } else if (el) {
        el.setAttribute("data-cs-disabled", value);
        el.setAttribute("aria-disabled", enabled ? "false" : "true");
        el.setAttribute("aria-hidden", enabled ? "false" : "true");
    }
    if (el) {
        if (enabled) {
            el.removeAttribute("hidden");
        } else {
            el.setAttribute("hidden", "");
        }
    }
    updateScenePanelSummonVisibility(enabled, { collapsed });
}

function applyAutoPinMode(active) {
    const container = getScenePanelContainer?.();
    const { $, el } = resolveContainer(container);
    const value = active ? "true" : "false";
    if ($ && typeof $.attr === "function") {
        $.attr("data-cs-auto-pin", value);
    } else if (el) {
        el.setAttribute("data-cs-auto-pin", value);
    }
}

function applySectionVisibility(target, visible) {
    const { $, el } = resolveContainer(target);
    const value = visible ? "false" : "true";
    if ($ && typeof $.attr === "function") {
        $.attr("data-scene-panel-hidden", value);
        $.attr("aria-hidden", visible ? "false" : "true");
    } else if (el) {
        el.setAttribute("data-scene-panel-hidden", value);
        el.setAttribute("aria-hidden", visible ? "false" : "true");
    }
}

function applySectionLayoutState(visibleCount) {
    const sectionsContainer = getSceneSectionsContainer?.();
    const { $, el } = resolveContainer(sectionsContainer);
    if (!$ && !el) {
        return;
    }

    let totalSections = 0;
    if ($ && typeof $.find === "function") {
        totalSections = $.find(".cs-scene-panel__section").length;
    } else if (el && typeof el.querySelectorAll === "function") {
        totalSections = el.querySelectorAll(".cs-scene-panel__section").length;
    }

    const sanitizedVisible = Math.max(0, Number.isFinite(visibleCount) ? Math.floor(visibleCount) : 0);
    const expanded = sanitizedVisible > 0 && totalSections > 0 && sanitizedVisible < totalSections;
    const visibleValue = String(sanitizedVisible);
    const expandedValue = expanded ? "true" : "false";

    if ($ && typeof $.attr === "function") {
        $.attr("data-visible-sections", visibleValue);
        $.attr("data-sections-expanded", expandedValue);
        if (typeof $.css === "function") {
            $.css("--cs-scene-visible-section-count", visibleValue);
        }
    }

    if (el) {
        el.setAttribute("data-visible-sections", visibleValue);
        el.setAttribute("data-sections-expanded", expandedValue);
        if (el.style && typeof el.style.setProperty === "function") {
            el.style.setProperty("--cs-scene-visible-section-count", visibleValue);
        }
    }
}

function updateToolbarToggleState(buttonId, pressed, { pressedTitle, unpressedTitle }) {
    if (typeof document === "undefined") {
        return;
    }
    const button = document.getElementById(buttonId);
    if (!button) {
        return;
    }
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
    const title = pressed ? pressedTitle : unpressedTitle;
    if (title) {
        button.setAttribute("title", title);
    }
}

function updateStatusCopy(enabled) {
    const statusTarget = getSceneStatusText?.();
    const { $, el } = resolveContainer(statusTarget);
    const copy = enabled
        ? "Mirrors the live tester timeline while tracking actual chat results."
        : "Scene panel is hidden. Use the mask button to bring it back when you need it.";
    if ($ && typeof $.text === "function") {
        $.text(copy);
    } else if (el) {
        el.textContent = copy;
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

    const collapsed = Boolean(panelState.collapsed);
    applyCollapsedState(collapsed);

    const settings = panelState.settings || {};
    const enabled = settings.enabled !== false;
    applyPanelEnabledState(enabled, { collapsed });
    applyAutoPinMode(settings.autoPinActive !== false);
    updateStatusCopy(enabled);

    const sections = settings.sections || {};
    const showRoster = enabled && sections.roster !== false;
    const showActive = enabled && sections.activeCharacters !== false;
    const showLog = enabled && sections.liveLog !== false;
    const showCoverage = enabled && sections.coverage !== false;

    applySectionVisibility(getSceneRosterSection?.(), showRoster);
    applySectionVisibility(getSceneActiveSection?.(), showActive);
    applySectionVisibility(getSceneLiveLogSection?.(), showLog);
    applySectionVisibility(getSceneCoverageSection?.(), showCoverage);
    const visibleSections = [showRoster, showActive, showLog, showCoverage].filter(Boolean).length;
    applySectionLayoutState(visibleSections);

    updateToolbarToggleState("cs-scene-panel-toggle", enabled, {
        pressedTitle: "Hide scene panel",
        unpressedTitle: "Show scene panel",
    });
    updateToolbarToggleState("cs-scene-section-toggle-roster", showRoster, {
        pressedTitle: "Hide roster section",
        unpressedTitle: "Show roster section",
    });
    updateToolbarToggleState("cs-scene-section-toggle-active", showActive, {
        pressedTitle: "Hide active characters section",
        unpressedTitle: "Show active characters section",
    });
    updateToolbarToggleState("cs-scene-section-toggle-log", showLog, {
        pressedTitle: "Hide live log section",
        unpressedTitle: "Show live log section",
    });
    updateToolbarToggleState("cs-scene-section-toggle-coverage", showCoverage, {
        pressedTitle: "Hide coverage suggestions section",
        unpressedTitle: "Show coverage suggestions section",
    });
    updateToolbarToggleState("cs-scene-panel-toggle-auto-open", settings.autoOpenOnResults !== false, {
        pressedTitle: "Disable auto-open on new results",
        unpressedTitle: "Enable auto-open on new results",
    });

    const rosterTarget = getSceneRosterList?.();
    if (rosterTarget && showRoster) {
        renderSceneRoster(rosterTarget, panelState);
    } else if (rosterTarget) {
        clearContainer(rosterTarget);
    }

    const activeTarget = getSceneActiveCards?.();
    if (activeTarget && showActive) {
        renderActiveCharacters(activeTarget, panelState);
    } else if (activeTarget) {
        clearContainer(activeTarget);
    }

    const liveLogTarget = getSceneLiveLog?.();
    if (liveLogTarget && showLog) {
        renderLiveLog(liveLogTarget, panelState);
    } else if (liveLogTarget) {
        clearContainer(liveLogTarget);
    }

    const coverageSection = getSceneCoverageSection?.();
    const coveragePronouns = getSceneCoveragePronouns?.();
    const coverageAttribution = getSceneCoverageAttribution?.();
    const coverageAction = getSceneCoverageAction?.();
    if (coverageSection && showCoverage) {
        renderCoverageSuggestions({
            section: coverageSection,
            pronouns: coveragePronouns,
            attribution: coverageAttribution,
            action: coverageAction,
        }, panelState);
    } else {
        if (coveragePronouns) {
            clearContainer(coveragePronouns);
        }
        if (coverageAttribution) {
            clearContainer(coverageAttribution);
        }
        if (coverageAction) {
            clearContainer(coverageAction);
        }
    }
}
