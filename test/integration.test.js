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
  let filterByRange;

  beforeAll(() => {
    csvText = fs.readFileSync(CSV_PATH, 'utf-8');
    ({ parseCSV, normalize, filterByRange } = loadAppFunctions());
  });

  it('parseCSV extracts closing prices from the real CSV', () => {
    const { closes } = parseCSV(csvText);
    expect(closes.length).toBeGreaterThan(100);
    closes.forEach(v => {
      expect(typeof v).toBe('number');
      expect(isFinite(v)).toBe(true);
    });
  });

  it('parseCSV extracts dates from the real CSV', () => {
    const { dates, closes } = parseCSV(csvText);
    expect(dates.length).toBe(closes.length);
    // Dates should be YYYY-MM-DD format
    expect(dates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dates[dates.length - 1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Dates should be chronologically ordered
    expect(dates[0] < dates[dates.length - 1]).toBe(true);
  });

  it('all closing prices are positive', () => {
    const { closes } = parseCSV(csvText);
    closes.forEach(v => {
      expect(v).toBeGreaterThan(0);
    });
  });

  it('filterByRange reduces data for short ranges', () => {
    const { dates, closes } = parseCSV(csvText);
    const oneMonth = filterByRange(dates, closes, '1mo');
    const oneYear = filterByRange(dates, closes, '1y');
    const fiveYear = filterByRange(dates, closes, '5y');

    expect(oneMonth.length).toBeLessThan(oneYear.length);
    expect(oneYear.length).toBeLessThan(fiveYear.length);
    // The filtered data should be a suffix of the full closes array
    expect(closes.slice(-oneMonth.length)).toEqual(oneMonth);
  });

  it('normalize produces values strictly within [-1, 1]', () => {
    const { closes } = parseCSV(csvText);
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
    const { closes } = parseCSV(csvText);
    const normalized = normalize(closes);

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

  it('full pipeline: CSV -> parse -> filterByRange -> normalize -> wavetable processor', () => {
    const ProcessorClass = loadWavetableProcessor();
    const { dates, closes } = parseCSV(csvText);
    const filtered = filterByRange(dates, closes, '1y');
    const normalized = normalize(filtered);

    const processor = new ProcessorClass();
    processor.port.onmessage({
      data: { type: 'wavetable', samples: Array.from(normalized) },
    });

    const output = new Float32Array(512);
    const result = processor.process([], [[output]], { frequency: [440] });

    expect(result).toBe(true);
    expect(output.some(v => v !== 0)).toBe(true);
    expect(output.every(v => isFinite(v))).toBe(true);

    for (const v of output) {
      expect(v).toBeGreaterThanOrEqual(-1.001);
      expect(v).toBeLessThanOrEqual(1.001);
    }
  });
});
