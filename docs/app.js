// --- QWERTY -> MIDI note mapping (two octaves) ---
const KEY_MAP = {
  // Lower octave: C3 = MIDI 48
  'z': 48, 's': 49, 'x': 50, 'd': 51, 'c': 52,
  'v': 53, 'g': 54, 'b': 55, 'h': 56, 'n': 57,
  'j': 58, 'm': 59,
  // Upper octave: C4 = MIDI 60
  'q': 60, '2': 61, 'w': 62, '3': 63, 'e': 64,
  'r': 65, '5': 66, 't': 67, '6': 68, 'y': 69,
  '7': 70, 'u': 71,
};

const synth = new StockSynth();
let wavetableLoaded = false;

// --- DOM refs ---
const tickerInput   = document.getElementById('ticker');
const rangeSelect   = document.getElementById('range');
const loadBtn       = document.getElementById('load-btn');
const csvFileInput  = document.getElementById('csv-file');
const statusEl      = document.getElementById('status');
const canvas        = document.getElementById('waveform');
const canvasCtx     = canvas.getContext('2d');

// --- Normalize closing prices to [-1, 1] ---
function normalize(closes) {
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const out = new Float32Array(closes.length);
  for (let i = 0; i < closes.length; i++) {
    out[i] = 2 * (closes[i] - min) / range - 1;
  }
  return out;
}

// --- Apply waveform to synth and canvas ---
async function applyWaveform(closes, label) {
  const normalized = normalize(closes);
  await synth.init();
  synth.setWavetable(normalized);
  wavetableLoaded = true;
  drawWaveform(normalized);
  statusEl.textContent = `${label} — ${closes.length} samples`;
}

// --- Load stock data via API ---
loadBtn.addEventListener('click', loadStock);
tickerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadStock();
});

async function loadStock() {
  const ticker = tickerInput.value.trim().toUpperCase();
  if (!ticker) return;

  statusEl.textContent = 'Loading...';
  loadBtn.disabled = true;

  try {
    const resp = await fetch(`/api/stock/${encodeURIComponent(ticker)}?range=${rangeSelect.value}`);
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const closes = data.prices.map(p => p.close);
    await applyWaveform(closes, `${data.name} (${data.symbol})`);
  } catch (err) {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      statusEl.textContent = 'Server not available — load a CSV file instead';
    } else {
      statusEl.textContent = `Error: ${err.message}`;
    }
  } finally {
    loadBtn.disabled = false;
  }
}

// --- CSV file loading ---
csvFileInput.addEventListener('change', loadCSV);

async function loadCSV() {
  const file = csvFileInput.files[0];
  if (!file) return;

  statusEl.textContent = 'Parsing CSV...';

  try {
    const text = await file.text();
    const closes = parseCSV(text);
    if (closes.length < 2) {
      throw new Error('CSV must contain at least 2 numeric price values');
    }
    await applyWaveform(closes, file.name.replace(/\.csv$/i, ''));
  } catch (err) {
    statusEl.textContent = `CSV error: ${err.message}`;
  }
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  // Detect header row and find the "Close" column
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  let closeCol = header.indexOf('close');
  if (closeCol === -1) closeCol = header.indexOf('adj close');

  // If we found a close column, parse as columnar CSV
  if (closeCol !== -1) {
    const closes = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const val = parseFloat(cols[closeCol]);
      if (!isNaN(val)) closes.push(val);
    }
    return closes;
  }

  // Otherwise, try to parse as one number per line (or single-column CSV)
  // Skip the first line if it doesn't parse as a number (header)
  const startIdx = isNaN(parseFloat(lines[0].split(',')[0])) ? 1 : 0;
  const closes = [];
  for (let i = startIdx; i < lines.length; i++) {
    const val = parseFloat(lines[i].split(',')[0]);
    if (!isNaN(val)) closes.push(val);
  }
  return closes;
}

// --- Draw waveform on canvas ---
function drawWaveform(samples) {
  const w = canvas.width;
  const h = canvas.height;
  const mid = h / 2;

  canvasCtx.fillStyle = '#1a1a2e';
  canvasCtx.fillRect(0, 0, w, h);

  // Center line
  canvasCtx.strokeStyle = '#333';
  canvasCtx.lineWidth = 1;
  canvasCtx.beginPath();
  canvasCtx.moveTo(0, mid);
  canvasCtx.lineTo(w, mid);
  canvasCtx.stroke();

  // Waveform
  canvasCtx.strokeStyle = '#00d4ff';
  canvasCtx.lineWidth = 2;
  canvasCtx.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const x = (i / (samples.length - 1)) * w;
    const y = mid - samples[i] * (mid - 10);
    if (i === 0) canvasCtx.moveTo(x, y);
    else canvasCtx.lineTo(x, y);
  }
  canvasCtx.stroke();
}

// --- Keyboard handling ---
const heldKeys = new Set();

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const key = e.key.toLowerCase();
  if (!KEY_MAP[key] || heldKeys.has(key)) return;
  if (!wavetableLoaded) return;

  heldKeys.add(key);
  synth.playNote(KEY_MAP[key]);
});

document.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (!KEY_MAP[key]) return;

  heldKeys.delete(key);
  synth.stopNote(KEY_MAP[key]);
});

// --- Synth parameter inputs ---
document.querySelectorAll('.param-input').forEach((input) => {
  input.addEventListener('change', () => {
    synth.setParam(input.dataset.param, input.value);
  });
});

// --- Init canvas with empty state ---
function drawEmpty() {
  const w = canvas.width;
  const h = canvas.height;
  canvasCtx.fillStyle = '#1a1a2e';
  canvasCtx.fillRect(0, 0, w, h);
  canvasCtx.strokeStyle = '#333';
  canvasCtx.beginPath();
  canvasCtx.moveTo(0, h / 2);
  canvasCtx.lineTo(w, h / 2);
  canvasCtx.stroke();
  canvasCtx.fillStyle = '#555';
  canvasCtx.font = '14px monospace';
  canvasCtx.textAlign = 'center';
  canvasCtx.fillText('Load a stock or CSV to see its waveform', w / 2, h / 2 - 10);
}
drawEmpty();
