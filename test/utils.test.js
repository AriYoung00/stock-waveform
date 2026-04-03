const { loadAppFunctions } = require('./helpers');

const { normalize, parseCSV } = loadAppFunctions();

describe('normalize', () => {
  it('maps values to [-1, 1] range', () => {
    const result = normalize([0, 50, 100]);
    expect(result[0]).toBeCloseTo(-1);
    expect(result[1]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(1);
  });

  it('returns Float32Array', () => {
    const result = normalize([10, 20]);
    expect(result).toBeInstanceOf(Float32Array);
  });

  it('handles equal values without dividing by zero', () => {
    const result = normalize([5, 5, 5]);
    // When min === max, range defaults to 1
    // All values map to 2*(5-5)/1 - 1 = -1
    expect(result[0]).toBeCloseTo(-1);
    expect(result[1]).toBeCloseTo(-1);
  });

  it('handles two values', () => {
    const result = normalize([10, 20]);
    expect(result[0]).toBeCloseTo(-1);
    expect(result[1]).toBeCloseTo(1);
  });

  it('handles negative values', () => {
    const result = normalize([-100, 0, 100]);
    expect(result[0]).toBeCloseTo(-1);
    expect(result[1]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(1);
  });
});

describe('parseCSV', () => {
  it('parses columnar CSV with Close header', () => {
    const csv = 'Date,Open,Close,Volume\n2024-01-01,100,105,1000\n2024-01-02,106,110,2000';
    const result = parseCSV(csv);
    expect(result).toEqual([105, 110]);
  });

  it('parses columnar CSV with Adj Close header', () => {
    const csv = 'Date,Open,Adj Close\n2024-01-01,100,99\n2024-01-02,102,101';
    const result = parseCSV(csv);
    expect(result).toEqual([99, 101]);
  });

  it('is case-insensitive for headers', () => {
    const csv = 'date,CLOSE\n2024-01-01,50\n2024-01-02,55';
    const result = parseCSV(csv);
    expect(result).toEqual([50, 55]);
  });

  it('parses one-number-per-line format', () => {
    const csv = '100\n200\n300';
    const result = parseCSV(csv);
    expect(result).toEqual([100, 200, 300]);
  });

  it('skips non-numeric header in simple format', () => {
    const csv = 'Price\n10\n20\n30';
    const result = parseCSV(csv);
    expect(result).toEqual([10, 20, 30]);
  });

  it('skips NaN values in columnar CSV', () => {
    const csv = 'Date,Close\n2024-01-01,100\n2024-01-02,bad\n2024-01-03,200';
    const result = parseCSV(csv);
    expect(result).toEqual([100, 200]);
  });

  it('returns empty array for empty input', () => {
    expect(parseCSV('')).toEqual([]);
  });

  it('handles Windows-style line endings', () => {
    const csv = 'Date,Close\r\n2024-01-01,42\r\n2024-01-02,43';
    const result = parseCSV(csv);
    expect(result).toEqual([42, 43]);
  });

  it('handles quoted headers', () => {
    const csv = '"Date","Close"\n2024-01-01,77';
    const result = parseCSV(csv);
    expect(result).toEqual([77]);
  });
});
