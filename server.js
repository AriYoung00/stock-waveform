const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'docs')));

app.get('/api/stock/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const range = req.query.range || '1y';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${encodeURIComponent(range)}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      return res.status(resp.status).json({ error: `Yahoo Finance returned ${resp.status}` });
    }

    const data = await resp.json();
    const result = data.chart.result?.[0];
    if (!result) {
      return res.status(404).json({ error: 'No data found for ticker' });
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators.quote[0].close || [];
    const prices = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] != null) {
        prices.push({
          date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
          close: closes[i],
        });
      }
    }

    res.json({
      symbol: result.meta.symbol,
      name: result.meta.longName || result.meta.shortName || result.meta.symbol,
      prices,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Stock Waveform running at http://localhost:${PORT}`);
});
