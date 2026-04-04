# Stock Waveform

A creative wavetable synthesizer that converts stock price history into audio waveforms. Load stock data from Yahoo Finance or upload a CSV file, then play the price history as a musical waveform using your keyboard.

## Demo

🎹 Try it live: https://AriYoung00.github.io/stock-waveform/

## Features

- **Stock data loading**: Fetch historical prices from Yahoo Finance API for any ticker
- **CSV upload**: Load custom stock data or any price history from CSV files
- **Range selection**: Choose time periods (1 month, 3 months, 6 months, 1 year, 2 years, 5 years)
- **CSV range filtering**: When loading CSV, the range picker applies backwards from the most recent date
- **Real-time synthesis**: Play waveforms using QWERTY keyboard mapping (two octaves)
- **Customizable ADSR**: Adjust attack, decay, sustain, and release envelope parameters
- **Canvas visualization**: Watch the waveform as you interact with it

## Getting Started

### Online (No setup required)
Visit https://AriYoung00.github.io/stock-waveform/ and start playing!

### Local Development

```bash
npm install
npm start
```

Then open http://localhost:3000 in your browser.

### Run Tests

```bash
npm test
```

## How to Play

1. Enter a stock ticker (e.g., AAPL, GOOGL) or upload a CSV file
2. Optionally select a time range
3. Click outside input fields
4. Use the QWERTY keyboard to play:
   - Lower octave: Z–M keys map to C3–B3
   - Upper octave: Q–U keys map to C4–B4
5. Adjust synth parameters to customize the sound

## CSV Format

Supports standard OHLCV (Date, Open, High, Low, Close, Volume) format or simple numeric price lists:

```csv
Date,Open,High,Low,Close,Volume
2024-01-01,100,105,99,102,1000000
2024-01-02,102,108,101,107,1500000
```

Or just prices:
```
150.25
151.50
152.00
```

## Technology

- **Frontend**: Vanilla JavaScript, Web Audio API, AudioWorklet
- **Backend**: Express.js (serves static files + Yahoo Finance proxy)
- **Testing**: Jest with supertest for integration testing

## Notes

- The app works offline with CSV files (no server needed)
- Stock data is live from Yahoo Finance when using the API
- Each note is a voice, supporting polyphonic playback
