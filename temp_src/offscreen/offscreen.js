// src/offscreen/offscreen.js
// This runs in a hidden document to load the ONNX model

import { pipeline, env } from '@huggingface/transformers';

console.log('[Defend Offscreen] 🔄 Loading ONNX model...');

// Point to local model
env.localModelPath = './model/';
env.allowRemoteModels = false;

let classifier = null;
let modelLoaded = false;

// ============================================
// LOAD MODEL
// ============================================

async function loadModel() {
    if (classifier !== null) return classifier;
    
    try {
        classifier = await pipeline(
            'text-classification',
            'cyberbullying_model.onnx',
            { device: 'cpu' }
        );
        modelLoaded = true;
        console.log('[Defend Offscreen] ✅ ONNX model loaded!');
        return classifier;
    } catch (error) {
        console.error('[Defend Offscreen] ❌ Model load failed:', error);
        modelLoaded = false;
        classifier = null;
        return null;
    }
}

// ============================================
// KEYWORD FALLBACK
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

    try {
        const model = await loadModel();
        if (!model) {
            throw new Error('Model not loaded');
        }
        const response = await model(text);
        const result = response[0];
        messageCache.set(text, result);
        return result;
    } catch (error) {
        console.log('[Defend Offscreen] ❌ Analysis error:', error);
        const fallback = keywordDetection(text);
        messageCache.set(text, fallback);
        return fallback;
    }
}

// ============================================
// MESSAGE HANDLER
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'analyze_onnx') {
        analyzeText(message.text).then(result => {
            sendResponse({ result: result });
        }).catch(error => {
            sendResponse({ error: error.message });
        });
        return true;
    }
});

console.log('[Defend Offscreen] ✅ Ready!');