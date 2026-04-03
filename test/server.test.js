const request = require('supertest');
const app = require('../server');

// Mock global fetch used by the server
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('GET /api/stock/:ticker', () => {
  it('returns parsed stock data on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            meta: { symbol: 'AAPL', longName: 'Apple Inc.' },
            timestamp: [1700000000, 1700086400, 1700172800],
            indicators: {
              quote: [{ close: [150.0, 152.5, null] }],
            },
          }],
        },
      }),
    });

    const res = await request(app).get('/api/stock/AAPL?range=1mo');

    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe('AAPL');
    expect(res.body.name).toBe('Apple Inc.');
    expect(res.body.prices).toHaveLength(2); // null close is filtered
    expect(res.body.prices[0]).toHaveProperty('date');
    expect(res.body.prices[0]).toHaveProperty('close', 150.0);
  });

  it('falls back to shortName if longName is missing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            meta: { symbol: 'X', shortName: 'X Corp' },
            timestamp: [1700000000],
            indicators: { quote: [{ close: [10] }] },
          }],
        },
      }),
    });

    const res = await request(app).get('/api/stock/X');
    expect(res.body.name).toBe('X Corp');
  });

  it('falls back to symbol if no name fields exist', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            meta: { symbol: 'Z' },
            timestamp: [1700000000],
            indicators: { quote: [{ close: [10] }] },
          }],
        },
      }),
    });

    const res = await request(app).get('/api/stock/Z');
    expect(res.body.name).toBe('Z');
  });

  it('returns 404 when no chart result', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ chart: { result: [] } }),
    });

    const res = await request(app).get('/api/stock/FAKE');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no data/i);
  });

  it('forwards Yahoo Finance error status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });

    const res = await request(app).get('/api/stock/AAPL');
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/429/);
  });

  it('returns 500 on fetch failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network down'));

    const res = await request(app).get('/api/stock/AAPL');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Network down');
  });

  it('encodes ticker and range in the Yahoo URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            meta: { symbol: 'BRK.B' },
            timestamp: [1700000000],
            indicators: { quote: [{ close: [350] }] },
          }],
        },
      }),
    });

    await request(app).get('/api/stock/BRK.B?range=5y');

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('BRK.B');
    expect(calledUrl).toContain('range=5y');
  });

  it('safely encodes special characters in ticker', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            meta: { symbol: 'X' },
            timestamp: [1700000000],
            indicators: { quote: [{ close: [10] }] },
          }],
        },
      }),
    });

    // Ticker with characters that need URI encoding
    await request(app).get('/api/stock/' + encodeURIComponent('<script>alert(1)</script>'));

    const calledUrl = global.fetch.mock.calls[0][0];
    // The ticker should be URI-encoded in the outbound URL, not passed raw
    expect(calledUrl).not.toContain('<script>');
    expect(calledUrl).toContain(encodeURIComponent('<script>alert(1)</script>'));
  });

  it('defaults range to 1y when not specified', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            meta: { symbol: 'T' },
            timestamp: [1700000000],
            indicators: { quote: [{ close: [20] }] },
          }],
        },
      }),
    });

    await request(app).get('/api/stock/T');

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('range=1y');
  });
});
