const vm = require('vm');
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'stock.csv');
const csvExists = fs.existsSync(CSV_PATH);

// Load normalize and parseCSV from app.js via sandboxed context
function loadAppFunctions() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'docs', 'app.js'), 'utf-8');

  const mockElement = {
    addEventListener: () => {},
    value: '',
    files: [],
    textContent: '',
    dataset: {},
    getContext: () => ({
      fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '',
      fillRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
      stroke: () => {}, fillText: () => {},
    }),
    width: 800,
    height: 200,
  };

  const context = {
    StockSynth: class { init() {} setWavetable() {} setParam() {} playNote() {} stopNote() {} },
    document: {
      getElementById: () => mockElement,
      addEventListener: () => {},
      querySelectorAll: () => [],
    },
    window: {},
    Set: Set,
    Float32Array: Float32Array,
    Math: Math,
    console: console,
    isNaN: isNaN,
    parseFloat: parseFloat,
  };

  vm.createContext(context);
  vm.runInContext(code, context);

  return {
    normalize: context.normalize,
    parseCSV: context.parseCSV,
  };
}

const conditionalDescribe = csvExists ? describe : describe.skip;

conditionalDescribe('Integration: stock.csv end-to-end pipeline', () => {
  let csvText;
  let parseCSV;
  let normalize;

  beforeAll(() => {
    csvText = fs.readFileSync(CSV_PATH, 'utf-8');
    ({ parseCSV, normalize } = loadAppFunctions());
  });

  it('parseCSV extracts closing prices from the real CSV', () => {
    const closes = parseCSV(csvText);
    expect(closes.length).toBeGreaterThan(100);
    closes.forEach(v => {
      expect(typeof v).toBe('number');
      expect(isFinite(v)).toBe(true);
    });
  });

  it('all closing prices are positive', () => {
    const closes = parseCSV(csvText);
    closes.forEach(v => {
      expect(v).toBeGreaterThan(0);
    });
  });

  it('normalize produces values strictly within [-1, 1]', () => {
    const closes = parseCSV(csvText);
    const normalized = normalize(closes);

    expect(normalized).toBeInstanceOf(Float32Array);
    expect(normalized.length).toBe(closes.length);

    let min = Infinity, max = -Infinity;
    for (const v of normalized) {
      expect(isFinite(v)).toBe(true);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    expect(min).toBeCloseTo(-1);
    expect(max).toBeCloseTo(1);
  });

  it('normalized waveform preserves relative ordering', () => {
    const closes = parseCSV(csvText);
    const normalized = normalize(closes);

    // Pick a few indices and verify monotonic relationship is preserved
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        expect(normalized[i]).toBeGreaterThan(normalized[i - 1]);
      } else if (closes[i] < closes[i - 1]) {
        expect(normalized[i]).toBeLessThan(normalized[i - 1]);
      } else {
        expect(normalized[i]).toBeCloseTo(normalized[i - 1]);
      }
    }
  });

  it('full pipeline: CSV -> parse -> normalize -> wavetable processor', () => {
    // Load the wavetable processor
    const processorCode = fs.readFileSync(
      path.join(__dirname, '..', 'docs', 'worklet', 'wavetable-processor.js'),
      'utf-8'
    );
    let ProcessorClass;
    const procContext = {
      AudioWorkletProcessor: class {
        constructor() { this.port = { onmessage: null }; }
      },
      registerProcessor: (_, cls) => { ProcessorClass = cls; },
      sampleRate: 44100,
      Float32Array: Float32Array,
      Math: Math,
    };
    vm.createContext(procContext);
    vm.runInContext(processorCode, procContext);

    // Run the full pipeline
    const closes = parseCSV(csvText);
    const normalized = normalize(closes);

    const processor = new ProcessorClass();
    processor.port.onmessage({
      data: { type: 'wavetable', samples: Array.from(normalized) },
    });

    // Generate a buffer of audio at 440Hz
    const output = new Float32Array(512);
    const result = processor.process([], [[output]], { frequency: [440] });

    expect(result).toBe(true);
    expect(output.some(v => v !== 0)).toBe(true);
    expect(output.every(v => isFinite(v))).toBe(true);

    // Output should be bounded by the wavetable range (with interpolation, stays in [-1, 1])
    for (const v of output) {
      expect(v).toBeGreaterThanOrEqual(-1.001);
      expect(v).toBeLessThanOrEqual(1.001);
    }
  });
});
