/**
 * Debug UI Module
 * Provides mobile-friendly debug log viewer for troubleshooting parsing issues
 */

import { extensionSettings, getDebugLogs, clearDebugLogs } from '../../core/state.js';

/**
 * Creates and injects the debug panel into the page
 * Note: Debug toggle button is created in index.js, not here
 */
export function createDebugPanel() {
    // Remove existing debug panel if any
    $('#rpg-debug-panel').remove();

    // Create debug panel HTML
    const debugPanelHtml = `
        <div id="rpg-debug-panel" class="rpg-debug-panel">
            <div class="rpg-debug-header">
                <h3>🔍 Debug Logs</h3>
                <div class="rpg-debug-actions">
                    <button id="rpg-debug-copy" title="Copy logs to clipboard">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                    <button id="rpg-debug-clear" title="Clear logs">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    <button id="rpg-debug-close" title="Close debug panel">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div id="rpg-debug-logs" class="rpg-debug-logs"></div>
        </div>
    `;

    // Append to body
    $('body').append(debugPanelHtml);

    // Set up event handlers
    setupDebugEventHandlers();

    // Initial log render
    renderDebugLogs();
}

/**
 * Closes the debug panel with proper animation (mobile or desktop)
 */
function closeDebugPanel() {
    const $panel = $('#rpg-debug-panel');
    const isMobile = window.innerWidth <= 1000;

    if (isMobile) {
        // Mobile: animate slide-out to right
        $panel.removeClass('rpg-mobile-open').addClass('rpg-mobile-closing');

        // Wait for animation to complete before hiding
        $panel.one('animationend', function() {
            $panel.removeClass('rpg-mobile-closing');
            $('.rpg-mobile-overlay').remove();
        });
    } else {
        // Desktop: simple slide-down
        $panel.removeClass('rpg-debug-open');
    }
}

/**
 * Sets up event handlers for debug panel using event delegation for mobile compatibility
 */
function setupDebugEventHandlers() {
    // Use event delegation for better mobile compatibility and reliability with dynamic elements
    // Remove any existing handlers first to prevent duplicates
    $(document).off('click.rpgDebug');

    // Toggle button
    $(document).on('click.rpgDebug', '#rpg-debug-toggle', function() {
        const $debugToggle = $(this);

        // Skip if we just finished dragging
        if ($debugToggle.data('just-dragged')) {
            console.log('[RPG Debug] Click blocked - just finished dragging');
            return;
        }

        const $panel = $('#rpg-debug-panel');
        const isMobile = window.innerWidth <= 1000;

        if (isMobile) {
            // Mobile: use rpg-mobile-open class with slide-from-right animation
            const isOpen = $panel.hasClass('rpg-mobile-open');

            if (isOpen) {
                // Close with animation
                closeDebugPanel();
            } else {
                // Open with animation
                $panel.addClass('rpg-mobile-open');
                renderDebugLogs();

                // Create overlay for mobile
                const $overlay = $('<div class="rpg-mobile-overlay"></div>');
                $('body').append($overlay);

                // Close when clicking overlay
                $overlay.on('click', function() {
                    closeDebugPanel();
                });
            }
        } else {
            // Desktop: use rpg-debug-open class with slide-from-bottom animation
            $panel.toggleClass('rpg-debug-open');
            renderDebugLogs();
        }
    });

    // Close button
    $(document).on('click.rpgDebug', '#rpg-debug-close', function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeDebugPanel();
    });

    // Copy button
    $(document).on('click.rpgDebug', '#rpg-debug-copy', function() {
        const logs = getDebugLogs();
        const logsText = logs.map(log => {
            let text = `[${log.timestamp}] ${log.message}`;
            if (log.data) {
                text += `\n${log.data}`;
            }
            return text;
        }).join('\n\n');

        navigator.clipboard.writeText(logsText).then(() => {
            // Show feedback
            const $btn = $(this);
            const $icon = $btn.find('i');
            $icon.removeClass('fa-copy').addClass('fa-check');
            setTimeout(() => {
                $icon.removeClass('fa-check').addClass('fa-copy');
            }, 1500);
        }).catch(err => {
            console.error('Failed to copy logs:', err);
            alert('Failed to copy logs. Please use browser console instead.');
        });
    });

    // Clear button
    $(document).on('click.rpgDebug', '#rpg-debug-clear', function() {
        if (confirm('Clear all debug logs?')) {
            clearDebugLogs();
            renderDebugLogs();
        }
    });
}

/**
 * Renders debug logs to the panel
 */
function renderDebugLogs() {
    const logs = getDebugLogs();
    const $logsContainer = $('#rpg-debug-logs');

    if (logs.length === 0) {
        $logsContainer.html('<div class="rpg-debug-empty">No logs yet. Logs will appear when parser runs.</div>');
        return;
    }

    // Build logs HTML
    const logsHtml = logs.map(log => {
        let html = `<div class="rpg-debug-entry">`;
        html += `<span class="rpg-debug-time">[${log.timestamp}]</span> `;
        html += `<span class="rpg-debug-message">${escapeHtml(log.message)}</span>`;
        if (log.data) {
            html += `<pre class="rpg-debug-data">${escapeHtml(log.data)}</pre>`;
        }
        html += `</div>`;
        return html;
    }).join('');

    $logsContainer.html(logsHtml);

    // Auto-scroll to bottom
    $logsContainer[0].scrollTop = $logsContainer[0].scrollHeight;
}

/**
 * Escapes HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Shows or hides debug UI based on debug mode setting
 * Note: Debug toggle button always exists in DOM (created in index.js)
 */
export function updateDebugUIVisibility() {
    const $debugToggle = $('#rpg-debug-toggle');

    if (extensionSettings.debugMode) {
        // Show debug toggle button
        $debugToggle.css('display', 'flex');

        // Create debug panel if it doesn't exist
        if ($('#rpg-debug-panel').length === 0) {
            createDebugPanel();
        }
    } else {
        // Hide debug toggle button
        $debugToggle.css('display', 'none');

        // Remove debug panel
        $('#rpg-debug-panel').remove();
    }
}
