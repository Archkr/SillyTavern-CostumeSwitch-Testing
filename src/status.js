import { state } from "./state.js";

export function showStatus(message, type = 'info', duration = 3000) {
    const statusEl = $("#cs-status");
    const textEl = statusEl.find('.cs-status-text');
    if (state.statusTimer) {
        clearTimeout(state.statusTimer);
        state.statusTimer = null;
    }

    statusEl.toggleClass('is-error', type === 'error');
    statusEl.toggleClass('is-success', type === 'success');
    textEl.html(message);
    statusEl.stop(true, true).fadeIn();

    state.statusTimer = setTimeout(() => {
        statusEl.fadeOut(400, () => {
            textEl.text('Ready');
            statusEl.removeClass('is-error is-success').fadeIn();
        });
        state.statusTimer = null;
    }, Math.max(duration, 1000));
}
