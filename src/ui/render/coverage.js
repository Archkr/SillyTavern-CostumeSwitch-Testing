import {
    resolveContainer,
    clearContainer,
    createElement,
} from "./utils.js";

function renderPlaceholder(target, message, tone = "muted") {
    const container = resolveContainer(target);
    if (!container.$ && !container.el) {
        return;
    }
    clearContainer(container);
    const wrapper = createElement("div", "cs-scene-panel__placeholder");
    if (!wrapper) {
        return;
    }
    if (tone) {
        wrapper.dataset.tone = tone;
    }
    wrapper.textContent = message;
    if (container.$ && typeof container.$.append === "function") {
        container.$.append(wrapper);
    } else if (container.el) {
        container.el.appendChild(wrapper);
    }
}

function renderList(target, values = [], type, { hasBuffer }) {
    const container = resolveContainer(target);
    if (!container.$ && !container.el) {
        return;
    }
    clearContainer(container);
    if (!Array.isArray(values) || values.length === 0) {
        const message = hasBuffer
            ? "No gaps detected."
            : "Awaiting an assistant message.";
        renderPlaceholder(container, message);
        return;
    }
    const list = createElement("div", "cs-coverage-list");
    if (!list) {
        return;
    }
    values.forEach((value) => {
        if (typeof value !== "string" || !value.trim()) {
            return;
        }
        const pill = createElement("button", "cs-coverage-pill");
        if (!pill) {
            return;
        }
        pill.type = "button";
        pill.dataset.type = type;
        pill.dataset.value = value;
        pill.textContent = value;
        list.appendChild(pill);
    });
    if (container.$ && typeof container.$.append === "function") {
        container.$.append(list);
    } else if (container.el) {
        container.el.appendChild(list);
    }
}

export function renderCoverageSuggestions(targets = {}, panelState = {}) {
    const coverage = panelState.coverage || {};
    const hasBuffer = typeof panelState.analytics?.buffer === "string"
        ? panelState.analytics.buffer.trim().length > 0
        : false;
    const wrapper = resolveContainer(targets.section);
    if (wrapper.el) {
        wrapper.el.setAttribute("data-has-content", hasBuffer ? "true" : "false");
    } else if (wrapper.$ && typeof wrapper.$.attr === "function") {
        wrapper.$.attr("data-has-content", hasBuffer ? "true" : "false");
    }
    renderList(targets.pronouns, coverage.missingPronouns, "pronoun", { hasBuffer });
    renderList(targets.attribution, coverage.missingAttributionVerbs, "attribution", { hasBuffer });
    renderList(targets.action, coverage.missingActionVerbs, "action", { hasBuffer });
}
