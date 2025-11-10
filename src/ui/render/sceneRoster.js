import {
    resolveContainer,
    clearContainer,
    appendContent,
    createElement,
    createTextElement,
    formatRelativeTime,
    resolveAvatarUrl,
    createPlaceholder,
} from "./utils.js";

function buildDisplayName(normalized, fallback, displayNames) {
    if (normalized && displayNames instanceof Map && displayNames.has(normalized)) {
        return displayNames.get(normalized);
    }
    return fallback || normalized || "Unknown";
}

function formatRosterMeta(entry, now) {
    const parts = [];
    if (Number.isFinite(entry.joinedAt)) {
        const joined = formatRelativeTime(entry.joinedAt, now);
        if (joined) {
            parts.push(`Joined ${joined}`);
        }
    }
    if (entry.active) {
        if (Number.isFinite(entry.lastSeenAt)) {
            const seen = formatRelativeTime(entry.lastSeenAt, now);
            if (seen) {
                parts.push(`Seen ${seen}`);
            }
        }
    } else {
        const leftTs = Number.isFinite(entry.lastLeftAt) ? entry.lastLeftAt : entry.lastSeenAt;
        const label = Number.isFinite(entry.lastLeftAt) ? "Left" : "Last seen";
        const relative = formatRelativeTime(leftTs, now);
        if (relative) {
            parts.push(`${label} ${relative}`);
        }
    }
    return parts.join(" • ");
}

function describeTesterSummary(testerEntry, now) {
    if (!testerEntry || typeof testerEntry !== "object") {
        return "No live tester activity recorded.";
    }
    const summary = testerEntry.summary || {};
    const parts = [];
    if (Number.isFinite(summary.switches) && summary.switches > 0) {
        parts.push(`${summary.switches} switch${summary.switches === 1 ? "" : "es"}`);
    }
    if (Number.isFinite(summary.skips) && summary.skips > 0) {
        parts.push(`${summary.skips} skip${summary.skips === 1 ? "" : "s"}`);
    }
    if (Number.isFinite(summary.vetoes) && summary.vetoes > 0) {
        parts.push(`${summary.vetoes} veto${summary.vetoes === 1 ? "" : "es"}`);
    }
    const lastEvent = testerEntry.lastEvent;
    if (lastEvent) {
        const label = typeof lastEvent.type === "string" ? lastEvent.type : "event";
        const detailParts = [];
        if (typeof lastEvent.matchKind === "string" && lastEvent.matchKind.trim()) {
            detailParts.push(lastEvent.matchKind.trim());
        }
        if (Number.isFinite(lastEvent.charIndex)) {
            detailParts.push(`#${lastEvent.charIndex + 1}`);
        }
        const detail = detailParts.length ? ` (${detailParts.join(" · ")})` : "";
        const when = Number.isFinite(lastEvent.timestamp) ? formatRelativeTime(lastEvent.timestamp, now) : null;
        const line = `Last ${label}${detail}${when ? ` · ${when}` : ""}`;
        parts.push(line);
    }
    if (!parts.length) {
        return "No live tester activity recorded.";
    }
    return parts.join(" • ");
}

function resolveAvatarElement(name, showAvatars) {
    const wrapper = createElement("div", "cs-scene-roster__avatar");
    if (!wrapper) {
        return null;
    }
    if (!showAvatars) {
        wrapper.classList.add("cs-scene-roster__avatar--hidden");
        return wrapper;
    }
    const url = resolveAvatarUrl(name);
    if (url) {
        const img = createElement("img", "cs-scene-roster__avatar-image");
        if (img) {
            img.src = url;
            img.alt = "";
            img.loading = "lazy";
            wrapper.appendChild(img);
        }
        return wrapper;
    }
    const fallback = createElement("span", "cs-scene-roster__avatar-fallback");
    if (fallback) {
        const initial = typeof name === "string" && name.trim() ? name.trim().charAt(0).toUpperCase() : "?";
        fallback.textContent = initial;
        wrapper.appendChild(fallback);
    }
    return wrapper;
}

function renderRosterRow(entry, { displayNames, showAvatars, now }) {
    const container = createElement("div", "cs-scene-roster__row");
    if (!container) {
        return null;
    }
    if (entry.normalized) {
        container.dataset.character = entry.normalized;
    }
    container.dataset.active = entry.active ? "true" : "false";
    if (entry.isLatest) {
        container.dataset.latest = "true";
    }
    const turnsRemaining = Number.isFinite(entry.turnsRemaining) ? Math.max(0, entry.turnsRemaining) : null;
    if (turnsRemaining != null) {
        container.dataset.turnsRemaining = String(turnsRemaining);
    }
    const displayName = buildDisplayName(entry.normalized, entry.name, displayNames);
    const avatar = resolveAvatarElement(displayName, showAvatars);
    if (avatar) {
        container.appendChild(avatar);
    }
    const body = createElement("div", "cs-scene-roster__body");
    if (!body) {
        return container;
    }
    const nameRow = createElement("div", "cs-scene-roster__name-row");
    const nameEl = createElement("span", "cs-scene-roster__name");
    if (nameEl) {
        nameEl.textContent = displayName;
        nameRow.appendChild(nameEl);
    }
    const status = createElement("span", "cs-scene-roster__status");
    if (status) {
        if (entry.active) {
            status.classList.add("cs-scene-roster__status--active");
            status.textContent = "Active";
        } else if (Number.isFinite(entry.lastSeenAt)) {
            const seen = formatRelativeTime(entry.lastSeenAt, now);
            status.textContent = seen ? `Inactive · ${seen}` : "Inactive";
        } else {
            status.textContent = "Inactive";
        }
        nameRow.appendChild(status);
    }
    if (entry.isLatest) {
        const badge = createElement("span", "cs-scene-roster__badge");
        if (badge) {
            badge.textContent = "Latest match";
            nameRow.appendChild(badge);
        }
    }
    if (turnsRemaining != null) {
        const ttl = createElement("span", "cs-scene-roster__ttl");
        if (ttl) {
            ttl.textContent = `${turnsRemaining} message${turnsRemaining === 1 ? "" : "s"} left`;
            ttl.title = turnsRemaining === 0
                ? "Will expire before the next message."
                : `Roster slot expires after ${turnsRemaining} more message${turnsRemaining === 1 ? "" : "s"}.`;
            if (turnsRemaining <= 1) {
                ttl.classList.add("cs-scene-roster__ttl--warning");
            }
            nameRow.appendChild(ttl);
        }
    }
    body.appendChild(nameRow);

    const meta = formatRosterMeta(entry, now);
    if (meta) {
        const metaEl = createTextElement("div", "cs-scene-roster__meta", meta);
        if (metaEl) {
            body.appendChild(metaEl);
        }
    }

    const analysis = describeTesterSummary(entry.tester, now);
    if (analysis) {
        const analysisEl = createTextElement("div", "cs-scene-roster__analysis", analysis);
        if (analysisEl) {
            body.appendChild(analysisEl);
        }
    }

    container.appendChild(body);
    return container;
}

function normalizeMember(member) {
    if (!member || typeof member !== "object") {
        return null;
    }
    const normalized = typeof member.normalized === "string" && member.normalized.trim()
        ? member.normalized.trim().toLowerCase()
        : typeof member.name === "string" && member.name.trim()
            ? member.name.trim().toLowerCase()
            : null;
    if (!normalized) {
        return null;
    }
    return {
        name: member.name || normalized,
        normalized,
        joinedAt: Number.isFinite(member.joinedAt) ? member.joinedAt : null,
        lastSeenAt: Number.isFinite(member.lastSeenAt) ? member.lastSeenAt : null,
        lastLeftAt: Number.isFinite(member.lastLeftAt) ? member.lastLeftAt : null,
        active: Boolean(member.active),
        turnsRemaining: Number.isFinite(member.turnsRemaining) ? member.turnsRemaining : null,
    };
}

function mergeRosterData(scene, membership, testers, now) {
    const map = new Map();
    if (membership && Array.isArray(membership.members)) {
        membership.members.forEach((member) => {
            const normalized = normalizeMember(member);
            if (!normalized) {
                return;
            }
            map.set(normalized.normalized, normalized);
        });
    }

    if (scene && Array.isArray(scene.roster)) {
        scene.roster.forEach((entry) => {
            const normalized = normalizeMember(entry);
            if (!normalized) {
                return;
            }
            const existing = map.get(normalized.normalized) || normalized;
            existing.active = true;
            if (Number.isFinite(normalized.lastSeenAt)) {
                existing.lastSeenAt = Math.max(existing.lastSeenAt || 0, normalized.lastSeenAt);
            }
            if (Number.isFinite(normalized.joinedAt)) {
                existing.joinedAt = existing.joinedAt || normalized.joinedAt;
            }
            if (Number.isFinite(normalized.turnsRemaining)) {
                existing.turnsRemaining = Number.isFinite(existing.turnsRemaining)
                    ? Math.min(existing.turnsRemaining, normalized.turnsRemaining)
                    : normalized.turnsRemaining;
            }
            map.set(normalized.normalized, existing);
        });
    }

    const testerMap = new Map();
    if (testers && Array.isArray(testers.entries)) {
        testers.entries.forEach((entry) => {
            if (!entry || typeof entry !== "object") {
                return;
            }
            const normalized = typeof entry.normalized === "string" && entry.normalized.trim()
                ? entry.normalized.trim().toLowerCase()
                : typeof entry.name === "string" && entry.name.trim()
                    ? entry.name.trim().toLowerCase()
                    : null;
            if (!normalized) {
                return;
            }
            testerMap.set(normalized, entry);
        });
    }

    const latestMatch = scene?.lastEvent?.normalized
        ? scene.lastEvent.normalized.toLowerCase()
        : null;

    const entries = Array.from(map.values()).map((entry) => {
        const tester = entry.normalized ? testerMap.get(entry.normalized) : null;
        return {
            ...entry,
            tester,
            isLatest: latestMatch && entry.normalized === latestMatch,
        };
    });

    entries.sort((a, b) => {
        if (a.active !== b.active) {
            return a.active ? -1 : 1;
        }
        const aSeen = Number.isFinite(a.lastSeenAt) ? a.lastSeenAt : 0;
        const bSeen = Number.isFinite(b.lastSeenAt) ? b.lastSeenAt : 0;
        if (aSeen !== bSeen) {
            return bSeen - aSeen;
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return entries;
}

export function renderSceneRoster(target, panelState = {}) {
    if (typeof document === "undefined") {
        return;
    }
    const container = resolveContainer(target);
    if (!container.$ && !container.el) {
        return;
    }
    clearContainer(container);

    const now = Number.isFinite(panelState.now) ? panelState.now : Date.now();
    const entries = mergeRosterData(panelState.scene, panelState.membership, panelState.testers, now);
    const showAvatars = panelState.settings?.showRosterAvatars !== false;

    if (panelState.isStreaming && entries.length === 0) {
        const placeholder = createPlaceholder("Listening for live detections…", { tone: "informative" });
        appendContent(container, placeholder);
        return;
    }

    if (entries.length === 0) {
        const placeholder = createPlaceholder("No characters are in the scene roster yet.");
        appendContent(container, placeholder);
        return;
    }

    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => {
        const row = renderRosterRow(entry, {
            displayNames: panelState.displayNames,
            showAvatars,
            now,
        });
        if (row) {
            fragment.appendChild(row);
        }
    });

    appendContent(container, fragment);
}
