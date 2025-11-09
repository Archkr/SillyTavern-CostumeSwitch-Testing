import {
    resolveContainer,
    clearContainer,
    appendContent,
    createElement,
    createTextElement,
    createPlaceholder,
    formatRelativeTime,
} from "./utils.js";

function renderCard(entry, { displayNames, now }) {
    const container = createElement("article", "cs-scene-active__card");
    if (!container) {
        return null;
    }
    if (entry.normalized) {
        container.dataset.character = entry.normalized;
    }
    if (entry.inSceneRoster) {
        container.dataset.roster = "true";
    }
    const name = entry.name || (entry.normalized ? displayNames?.get(entry.normalized) : null) || entry.normalized || "Unknown";
    const title = createTextElement("h5", "cs-scene-active__name", name);
    if (title) {
        container.appendChild(title);
    }
    const detailParts = [];
    if (Number.isFinite(entry.count)) {
        detailParts.push(`${entry.count} detection${entry.count === 1 ? "" : "s"}`);
    }
    if (Number.isFinite(entry.score)) {
        detailParts.push(`Score ${entry.score}`);
    } else if (Number.isFinite(entry.bestPriority)) {
        detailParts.push(`Priority ${entry.bestPriority}`);
    }
    if (detailParts.length) {
        const detail = createTextElement("p", "cs-scene-active__details", detailParts.join(" • "));
        if (detail) {
            container.appendChild(detail);
        }
    }
    if (Array.isArray(entry.events) && entry.events.length) {
        const lastEvent = entry.events[entry.events.length - 1];
        const when = Number.isFinite(lastEvent.timestamp) ? formatRelativeTime(lastEvent.timestamp, now) : null;
        const eventParts = [];
        if (lastEvent.type) {
            eventParts.push(lastEvent.type);
        }
        if (lastEvent.matchKind) {
            eventParts.push(lastEvent.matchKind);
        }
        if (Number.isFinite(lastEvent.charIndex)) {
            eventParts.push(`#${lastEvent.charIndex + 1}`);
        }
        if (when) {
            eventParts.push(when);
        }
        const eventLine = createTextElement("p", "cs-scene-active__event", eventParts.join(" · "));
        if (eventLine) {
            container.appendChild(eventLine);
        }
    }
    return container;
}

export function renderActiveCharacters(target, panelState = {}) {
    if (typeof document === "undefined") {
        return;
    }
    const container = resolveContainer(target);
    if (!container.$ && !container.el) {
        return;
    }
    clearContainer(container);

    const ranking = Array.isArray(panelState.ranking) ? panelState.ranking : [];
    if (!ranking.length) {
        const placeholder = createPlaceholder("No recent detections to highlight.");
        appendContent(container, placeholder);
        return;
    }

    const fragment = document.createDocumentFragment();
    const now = Number.isFinite(panelState.now) ? panelState.now : Date.now();
    ranking.forEach((entry) => {
        if (!entry || typeof entry !== "object") {
            return;
        }
        const card = renderCard(entry, {
            displayNames: panelState.displayNames,
            now,
        });
        if (card) {
            fragment.appendChild(card);
        }
    });

    appendContent(container, fragment);
}
