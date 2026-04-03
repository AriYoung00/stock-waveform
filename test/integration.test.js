const fs = require('fs');
const path = require('path');
const { loadAppFunctions, loadWavetableProcessor } = require('./helpers');

const CSV_PATH = path.join(__dirname, '..', 'stock.csv');
const csvExists = fs.existsSync(CSV_PATH);

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
    const ProcessorClass = loadWavetableProcessor();
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
