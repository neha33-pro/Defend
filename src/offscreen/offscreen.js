// src/offscreen/offscreen.js
// Runs the trained model fully in-browser: onnxruntime-web for inference
// (mirrors what server.py did) + transformers.js's tokenizer only (not its
// pipeline() helper, which expects a full HF repo structure we don't have).

import { AutoTokenizer } from '@huggingface/transformers';
import * as ort from 'onnxruntime-web/wasm';

console.log('[Defend Offscreen] 🔄 Initializing...');

// Point onnxruntime-web at locally-bundled WASM files instead of a CDN,
// so inference works fully offline once the extension is installed.
// (Requires copying onnxruntime-web's dist/*.wasm files into public/ort/
//  as a build step - see setup notes.)
ort.env.wasm.wasmPaths = {
    mjs: chrome.runtime.getURL('dist/ort/ort-wasm-simd-threaded.mjs'),
    wasm: chrome.runtime.getURL('dist/ort/ort-wasm-simd-threaded.wasm')
};
// Force single-threaded mode: the multi-threaded WASM build needs
// crossOriginIsolated (SharedArrayBuffer), which extension pages don't get
// by default - this avoids a second potential point of failure.
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

let tokenizer = null;
let session = null;
let ready = false;
let initPromise = null;

async function initialize() {
    if (ready) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        console.log('[Defend Offscreen] 🔄 Loading tokenizer (roberta-base)...');
        // This is the STANDARD roberta-base tokenizer, not your fine-tuned
        // checkpoint - same reasoning as the Python server: fine-tuning only
        // changed the classification head, not the vocabulary.
        tokenizer = await AutoTokenizer.from_pretrained('Xenova/roberta-base');
        console.log('[Defend Offscreen] ✅ Tokenizer loaded!');

        console.log('[Defend Offscreen] 🔄 Loading ONNX model...');
        const modelUrl = chrome.runtime.getURL('dist/model/cyberbullying_model.onnx');
        const dataUrl = chrome.runtime.getURL('dist/model/cyberbullying_model.onnx.data');
        session = await ort.InferenceSession.create(modelUrl, {
            executionProviders: ['wasm'],
            externalData: [
                { path: 'cyberbullying_model.onnx.data', data: dataUrl }
            ]
        });
        console.log('[Defend Offscreen] ✅ ONNX model loaded!');
        console.log('[Defend Offscreen] Inputs:', session.inputNames, 'Outputs:', session.outputNames);

        ready = true;
    })();

    return initPromise;
}

function softmax(arr) {
    const max = Math.max(...arr);
    const exps = arr.map(x => Math.exp(x - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(x => x / sum);
}

async function predict(text) {
    await initialize();

    const encoded = await tokenizer(text, {
        truncation: true,
        max_length: 256,
        padding: 'max_length'
    });

    // transformers.js returns BigInt64Array-backed tensors; ort.Tensor
    // for 'int64' also expects a BigInt64Array, so this is a direct pass-through.
    const inputIds = encoded.input_ids.data;
    const attentionMask = encoded.attention_mask.data;

    const feeds = {
        input_ids: new ort.Tensor('int64', inputIds, [1, inputIds.length]),
        attention_mask: new ort.Tensor('int64', attentionMask, [1, attentionMask.length])
    };

    const output = await session.run(feeds);
    const logits = Array.from(output.logits.data); // Float32Array -> plain array
    const probs = softmax(logits);
    const predClass = probs.indexOf(Math.max(...probs));
    const confidence = probs[predClass];

    const label = predClass === 1 ? 'toxic' : 'non-toxic';
    return { label, score: confidence };
}

// ============================================
// KEYWORD FALLBACK (only if the model fails to load/run)
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
        if (lowerText.includes(word)) return { label: 'toxic', score: 0.95 };
    }
    return { label: 'non-toxic', score: 0.05 };
}

const messageCache = new Map();

async function analyzeText(text) {
    if (messageCache.has(text)) return messageCache.get(text);

    let result;
    try {
        result = await predict(text);
        console.log(`[Defend Offscreen] ✅ Model → "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}" → ${result.label} (${(result.score * 100).toFixed(1)}%)`);
    } catch (error) {
        console.error('[Defend Offscreen]  Model failed, using keyword fallback:', error);
        result = keywordDetection(text);
    }

    messageCache.set(text, result);
    return result;
}

// ============================================
// MESSAGE HANDLER
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'analyze_onnx') {
        analyzeText(message.text)
            .then(result => sendResponse({ result }))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }
});

console.log('[Defend Offscreen]  Ready! (model loads on first request)');