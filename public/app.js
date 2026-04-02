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
const statusEl      = document.getElementById('status');
const canvas        = document.getElementById('waveform');
const ctx           = canvas.getContext('2d');

// --- Load stock data ---
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

    // Normalize to [-1, 1]
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const normalized = new Float32Array(closes.length);
    for (let i = 0; i < closes.length; i++) {
      normalized[i] = 2 * (closes[i] - min) / range - 1;
    }

    // Init synth on first interaction (browser autoplay policy)
    await synth.init();
    synth.setWavetable(normalized);
    wavetableLoaded = true;

    drawWaveform(normalized);
    statusEl.textContent = `${data.name} (${data.symbol}) — ${closes.length} samples`;
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  } finally {
    loadBtn.disabled = false;
  }
}

// --- Draw waveform on canvas ---
function drawWaveform(samples) {
  const w = canvas.width;
  const h = canvas.height;
  const mid = h / 2;

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);

  // Center line
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(w, mid);
  ctx.stroke();

  // Waveform
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const x = (i / (samples.length - 1)) * w;
    const y = mid - samples[i] * (mid - 10); // 10px padding
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// --- Keyboard handling ---
const heldKeys = new Set();

document.addEventListener('keydown', (e) => {
  // Ignore if typing in an input
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
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.fillStyle = '#555';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Load a stock to see its waveform', w / 2, h / 2 - 10);
}
drawEmpty();
