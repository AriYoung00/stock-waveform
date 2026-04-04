const { loadAppFunctions } = require('./helpers');

const { normalize, parseCSV, filterByRange } = loadAppFunctions();

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
  it('parses columnar CSV with Close header and returns dates', () => {
    const csv = 'Date,Open,Close,Volume\n2024-01-01,100,105,1000\n2024-01-02,106,110,2000';
    const result = parseCSV(csv);
    expect(result.closes).toEqual([105, 110]);
    expect(result.dates).toEqual(['2024-01-01', '2024-01-02']);
  });

  it('parses columnar CSV with Adj Close header', () => {
    const csv = 'Date,Open,Adj Close\n2024-01-01,100,99\n2024-01-02,102,101';
    const { closes } = parseCSV(csv);
    expect(closes).toEqual([99, 101]);
  });

  it('is case-insensitive for headers', () => {
    const csv = 'date,CLOSE\n2024-01-01,50\n2024-01-02,55';
    const { closes } = parseCSV(csv);
    expect(closes).toEqual([50, 55]);
  });

  it('parses one-number-per-line format with empty dates', () => {
    const csv = '100\n200\n300';
    const result = parseCSV(csv);
    expect(result.closes).toEqual([100, 200, 300]);
    expect(result.dates).toEqual([]);
  });

  it('skips non-numeric header in simple format', () => {
    const csv = 'Price\n10\n20\n30';
    const { closes } = parseCSV(csv);
    expect(closes).toEqual([10, 20, 30]);
  });

  it('skips NaN values in columnar CSV', () => {
    const csv = 'Date,Close\n2024-01-01,100\n2024-01-02,bad\n2024-01-03,200';
    const { closes } = parseCSV(csv);
    expect(closes).toEqual([100, 200]);
  });

  it('returns empty arrays for empty input', () => {
    const result = parseCSV('');
    expect(result.closes).toEqual([]);
    expect(result.dates).toEqual([]);
  });

  it('handles Windows-style line endings', () => {
    const csv = 'Date,Close\r\n2024-01-01,42\r\n2024-01-02,43';
    const { closes } = parseCSV(csv);
    expect(closes).toEqual([42, 43]);
  });

  it('handles quoted headers', () => {
    const csv = '"Date","Close"\n2024-01-01,77';
    const { closes } = parseCSV(csv);
    expect(closes).toEqual([77]);
  });
});

describe('filterByRange', () => {
  const dates = [
    '2024-01-15', '2024-02-15', '2024-03-15', '2024-04-15',
    '2024-05-15', '2024-06-15', '2024-07-15', '2024-08-15',
    '2024-09-15', '2024-10-15', '2024-11-15', '2024-12-15',
  ];
  const closes = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];

  it('returns last 1 month of data', () => {
    const result = filterByRange(dates, closes, '1mo');
    expect(result).toEqual([120]);
  });

  it('returns last 3 months of data', () => {
    const result = filterByRange(dates, closes, '3mo');
    expect(result).toEqual([100, 110, 120]);
  });

  it('returns last 6 months of data', () => {
    const result = filterByRange(dates, closes, '6mo');
    expect(result).toEqual([70, 80, 90, 100, 110, 120]);
  });

  it('returns last 1 year of data', () => {
    const result = filterByRange(dates, closes, '1y');
    expect(result).toEqual(closes);
  });

  it('returns all data when range exceeds available data', () => {
    const result = filterByRange(dates, closes, '5y');
    expect(result).toEqual(closes);
  });

  it('returns all closes when no dates are available', () => {
    const result = filterByRange([], closes, '1mo');
    expect(result).toEqual(closes);
  });

  it('returns all closes for unknown range value', () => {
    const result = filterByRange(dates, closes, 'invalid');
    expect(result).toEqual(closes);
  });
});
