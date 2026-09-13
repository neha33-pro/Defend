// src/background/background.js

console.log('[Defend] 🛡️ Background started');

// ============================================
// KEYWORD DETECTION
// ============================================

function keywordDetection(text) {
    const toxicWords = [
        'idiot', 'stupid', 'dumb', 'moron', 'worthless',
        'hate', 'kill yourself', 'die', 'waste of space',
        'bitch', 'cunt', 'hoe', 'whore', 'slut',
        'fuck', 'asshole', 'bastard', 'retard'
    ];
    const lowerText = text.toLowerCase();
    for (const word of toxicWords) {
        if (lowerText.includes(word)) {
            return { label: 'toxic', score: 0.95 };
        }
    }
    return { label: 'non-toxic', score: 0.05 };
}

// ============================================
// ANALYZE TEXT
// ============================================

const messageCache = new Map();

async function analyzeText(text) {
    if (messageCache.has(text)) {
        return messageCache.get(text);
    }
    const result = keywordDetection(text);
    messageCache.set(text, result);
    return result;
}

// ============================================
// MESSAGE HANDLER
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'analyze') {
        analyzeText(message.text).then(result => {
            sendResponse({ result: result });
        }).catch(error => {
            sendResponse({ error: error.message });
        });
        return true;
    }
    
    if (message.action === 'status') {
        sendResponse({ loaded: true, method: 'Keyword' });
        return true;
    }
});

console.log('[Defend] ✅ Background ready!');