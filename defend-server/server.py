# server.py - ONNX Model Server with Flask
# Uses onnxruntime directly since only the ONNX export is available
# (the original HF checkpoint folder no longer exists on disk).
# The tokenizer is NOT something you fine-tuned - RoBERTa's tokenizer
# is fixed vocabulary, so we load the standard 'roberta-base' tokenizer.

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import onnxruntime as ort
from transformers import RobertaTokenizer
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Allow requests from the extension

print("=" * 60)
print("🛡️ DEFEND - Cyberbullying Detection Server")
print("=" * 60)

# ============================================
# LOAD MODEL (ONNX) + TOKENIZER
# ============================================

MODEL_DIR = './cyberbullying_model'
ONNX_PATH = os.path.join(MODEL_DIR, 'cyberbullying_model.onnx')

if not os.path.exists(ONNX_PATH):
    print(f" ONNX model not found at: {ONNX_PATH}")
    print("📁 Expected: cyberbullying_model.onnx + cyberbullying_model.onnx.data")
    print("   in the same folder (the .data file holds the actual weights).")
    exit(1)

print("\n🔄 Loading tokenizer (roberta-base, standard vocabulary)...")
try:
    tokenizer = RobertaTokenizer.from_pretrained('roberta-base')
    print("✅ Tokenizer loaded!")
except Exception as e:
    print(f" Error loading tokenizer: {e}")
    print("💡 This requires an internet connection the first time (downloads")
    print("   and caches roberta-base's vocab.json/merges.txt from Hugging Face).")
    exit(1)

print("\n Loading ONNX model...")
try:
    session = ort.InferenceSession(ONNX_PATH, providers=['CPUExecutionProvider'])
    input_names = [i.name for i in session.get_inputs()]
    output_names = [o.name for o in session.get_outputs()]
    print(f" ONNX model loaded!")
    print(f" Inputs expected:  {input_names}")
    print(f" Outputs produced: {output_names}")
except Exception as e:
    print(f" Error loading ONNX model: {e}")
    exit(1)

# ============================================
# PREDICTION FUNCTION
# ============================================

def softmax(x):
    e_x = np.exp(x - np.max(x))
    return e_x / e_x.sum()

def predict(text):
    """Predict if text contains cyberbullying using the ONNX model."""
    if not text or len(text.strip()) == 0:
        return "not_bullying", 0.0

    inputs = tokenizer(
        text,
        return_tensors="np",
        truncation=True,
        max_length=256,
        padding='max_length'
    )

    # Build the feed dict using whatever input names the ONNX graph expects.
    # Most RoBERTa ONNX exports expect input_ids + attention_mask.
    ort_inputs = {}
    for name in input_names:
        if name in inputs:
            ort_inputs[name] = inputs[name].astype(np.int64)

    outputs = session.run(output_names, ort_inputs)
    logits = outputs[0][0]  # first output, first (only) batch item
    probs = softmax(logits)
    pred_class = int(np.argmax(probs))
    confidence = float(probs[pred_class])

    label = "bullying" if pred_class == 1 else "not_bullying"
    return label, confidence

# ============================================
# API ENDPOINTS
# ============================================

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'status': 'online',
        'message': '🛡️ Defend Cyberbullying Detection Server is running',
        'model': 'RoBERTa-base fine-tuned on Jigsaw dataset (ONNX)',
        'server_time': datetime.now().isoformat()
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'model_loaded': True,
        'backend': 'onnxruntime'
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze a single text for cyberbullying."""
    data = request.get_json()

    if not data or 'text' not in data:
        return jsonify({'error': 'No text provided'}), 400

    text = data['text'].strip()
    if not text:
        return jsonify({'error': 'Empty text'}), 400

    try:
        label, confidence = predict(text)
        return jsonify({
            'label': label,
            'confidence': confidence,
            'text': text,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/batch', methods=['POST'])
def batch_analyze():
    """Analyze multiple texts."""
    data = request.get_json()

    if not data or 'texts' not in data:
        return jsonify({'error': 'No texts provided'}), 400

    texts = data['texts']
    results = []

    for text in texts:
        try:
            label, confidence = predict(text)
            results.append({'text': text, 'label': label, 'confidence': confidence})
        except Exception as e:
            results.append({'text': text, 'error': str(e)})

    return jsonify({'results': results})

@app.route('/stats', methods=['GET'])
def stats():
    return jsonify({'model': 'RoBERTa-base (ONNX)', 'backend': 'onnxruntime', 'status': 'running'})

# ============================================
# RUN THE SERVER
# ============================================

if __name__ == '__main__':
    print("\n" + "=" * 60)
    print(" Starting cyberbullying detection server...")
    print(" http://localhost:5000")
    print(" Send POST requests to /analyze")
    print("Example: curl -X POST http://localhost:5000/analyze -H \"Content-Type: application/json\" -d \"{\\\"text\\\": \\\"You are an idiot\\\"}\"")
    print("=" * 60)
    print("\nPress Ctrl+C to stop the server\n")
    app.run(host='0.0.0.0', port=5000, debug=True)