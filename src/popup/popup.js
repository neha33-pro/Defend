// src/popup/popup.js

document.addEventListener('DOMContentLoaded', () => {
    // Get stats from storage
    chrome.storage.local.get(['protectedCount', 'hiddenCount', 'blockedCount'], (data) => {
        document.getElementById('protectedCount').textContent = data.protectedCount || 0;
        document.getElementById('hiddenCount').textContent = data.hiddenCount || 0;
        document.getElementById('blockedCount').textContent = data.blockedCount || 0;
    });

    const toggleBtn = document.getElementById('toggleBtn');
    const statusBadge = document.getElementById('statusBadge');

    chrome.storage.local.get(['enabled'], (data) => {
        const isEnabled = data.enabled !== false;
        updateUI(isEnabled);
    });

    toggleBtn.addEventListener('click', () => {
        chrome.storage.local.get(['enabled'], (data) => {
            const newState = data.enabled === false;
            chrome.storage.local.set({ enabled: newState });
            updateUI(newState);
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle', enabled: newState }).catch(() => {});
                }
            });
        });
    });

    function updateUI(enabled) {
        if (enabled) {
            toggleBtn.textContent = '⏸️ Pause Protection';
            toggleBtn.className = 'primary-btn active';
            statusBadge.textContent = 'Active';
            statusBadge.style.background = '#00c853';
        } else {
            toggleBtn.textContent = '▶️ Resume Protection';
            toggleBtn.className = 'primary-btn';
            statusBadge.textContent = 'Paused';
            statusBadge.style.background = '#ffa726';
        }
    }

    const slider = document.getElementById('thresholdSlider');
    const thresholdValue = document.getElementById('thresholdValue');

    chrome.storage.local.get(['threshold'], (data) => {
        if (data.threshold) {
            const val = Math.round(data.threshold * 100);
            slider.value = val;
            thresholdValue.textContent = val + '%';
        }
    });

    slider.addEventListener('input', () => {
        const val = slider.value;
        thresholdValue.textContent = val + '%';
        chrome.storage.local.set({ threshold: parseInt(val) / 100 });
    });

    chrome.storage.local.get(['autoScan'], (data) => {
        document.getElementById('autoScan').checked = data.autoScan !== false;
    });

    document.getElementById('autoScan').addEventListener('change', (e) => {
        chrome.storage.local.set({ autoScan: e.target.checked });
    });
});