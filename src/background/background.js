// src/background/background.js

console.log('[Defend] 🛡️ Background started');

// ============================================
// KEYWORD DETECTION (last-resort fallback only)
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
// OFFSCREEN DOCUMENT MANAGEMENT
// ============================================
// The offscreen document is a real DOM page living in the extension's own
// context (its own CSP, not the host page's). That's what lets us run WASM
// (onnxruntime-web) - something impossible directly in a service worker or
// injected into a CSP-locked page like Instagram.

let creatingOffscreen = null;

async function ensureOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) return;

    if (creatingOffscreen) {
        await creatingOffscreen;
        return;
    }

    creatingOffscreen = chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('dist/offscreen.html'),
        reasons: ['WORKERS'],
        justification: 'Run local ONNX model inference with onnxruntime-web'
    });

    await creatingOffscreen;
    creatingOffscreen = null;
}

async function analyzeWithOffscreen(text) {
    await ensureOffscreenDocument();

    const response = await chrome.runtime.sendMessage({
        action: 'analyze_onnx',
        text
    });

    if (response && response.result) {
        return response.result; // { label: 'toxic'|'non-toxic', score }
    }
    throw new Error(response?.error || 'No result from offscreen document');
}

// ============================================
// ANALYZE TEXT
// ============================================

const messageCache = new Map();

async function analyzeText(text) {
    if (messageCache.has(text)) {
        return messageCache.get(text);
    }

    let result;
    try {
        result = await analyzeWithOffscreen(text);
        console.log(`[Defend] ✅ Local model → "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}" → ${result.label} (${(result.score * 100).toFixed(1)}%)`);
    } catch (error) {
        console.warn('[Defend] ⚠️ Local model unavailable, falling back to keywords:', error.message);
        result = keywordDetection(text);
        console.log(`[Defend] 🔤 Keyword → "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}" → ${result.label}`);
    }

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
        sendResponse({ loaded: true, method: 'Local ONNX + Keyword fallback' });
        return true;
    }
});

console.log('[Defend] ✅ Background ready!');

// Pre-warm the offscreen model right away, instead of paying the full
// tokenizer-download + model-load cost on the first real comment scan.
analyzeText('warmup').catch(() => {});