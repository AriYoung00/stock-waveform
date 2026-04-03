const vm = require('vm');
const fs = require('fs');
const path = require('path');

function loadStockSynth() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'docs', 'synth.js'), 'utf-8');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.window.StockSynth;
}

const StockSynth = loadStockSynth();

describe('StockSynth', () => {
  let synth;

  beforeEach(() => {
    synth = new StockSynth();
  });

  describe('constructor defaults', () => {
    it('initializes with default ADSR values', () => {
      expect(synth.attack).toBe(0.01);
      expect(synth.decay).toBe(0.1);
      expect(synth.sustain).toBe(0.7);
      expect(synth.release).toBe(0.3);
      expect(synth.gain).toBe(0.5);
    });

    it('starts with no audio context', () => {
      expect(synth.ctx).toBeNull();
      expect(synth.ready).toBe(false);
    });

    it('starts with empty voices map', () => {
      expect(synth.voices.size).toBe(0);
      expect(typeof synth.voices.get).toBe('function');
      expect(typeof synth.voices.set).toBe('function');
    });
  });

  describe('setWavetable', () => {
    it('stores the provided samples', () => {
      const samples = new Float32Array([0, 0.5, 1, -1]);
      synth.setWavetable(samples);
      expect(synth.wavetable).toBe(samples);
    });
  });

  describe('setParam', () => {
    it('sets attack within bounds', () => {
      synth.setParam('attack', '0.5');
      expect(synth.attack).toBe(0.5);
    });

    it('clamps attack to minimum 0.001', () => {
      synth.setParam('attack', '0');
      expect(synth.attack).toBe(0.001);
    });

    it('clamps attack to maximum 2.0', () => {
      synth.setParam('attack', '10');
      expect(synth.attack).toBe(2.0);
    });

    it('sets decay within bounds', () => {
      synth.setParam('decay', '0.5');
      expect(synth.decay).toBe(0.5);
    });

    it('clamps decay to min 0.001 and max 2.0', () => {
      synth.setParam('decay', '-1');
      expect(synth.decay).toBe(0.001);
      synth.setParam('decay', '99');
      expect(synth.decay).toBe(2.0);
    });

    it('sets sustain within bounds', () => {
      synth.setParam('sustain', '0.8');
      expect(synth.sustain).toBe(0.8);
    });

    it('clamps sustain to [0, 1]', () => {
      synth.setParam('sustain', '-0.5');
      expect(synth.sustain).toBe(0.0);
      synth.setParam('sustain', '1.5');
      expect(synth.sustain).toBe(1.0);
    });

    it('sets release within bounds', () => {
      synth.setParam('release', '1.0');
      expect(synth.release).toBe(1.0);
    });

    it('clamps release to min 0.001 and max 5.0', () => {
      synth.setParam('release', '0');
      expect(synth.release).toBe(0.001);
      synth.setParam('release', '100');
      expect(synth.release).toBe(5.0);
    });

    it('sets gain and updates masterGain if available', () => {
      synth.setParam('gain', '0.8');
      expect(synth.gain).toBe(0.8);
    });

    it('clamps gain to [0, 1]', () => {
      synth.setParam('gain', '-1');
      expect(synth.gain).toBe(0.0);
      synth.setParam('gain', '2');
      expect(synth.gain).toBe(1.0);
    });

    it('updates masterGain.value when masterGain exists', () => {
      synth.masterGain = { gain: { value: 0 } };
      synth.setParam('gain', '0.6');
      expect(synth.masterGain.gain.value).toBe(0.6);
    });

    it('ignores NaN values', () => {
      synth.setParam('attack', 'not-a-number');
      expect(synth.attack).toBe(0.01); // unchanged from default
    });

    it('ignores unknown parameter names', () => {
      synth.setParam('unknown', '1.0');
      // should not throw, no change
      expect(synth.attack).toBe(0.01);
    });
  });

  describe('playNote/stopNote without init', () => {
    it('playNote does nothing when not ready', () => {
      synth.playNote(60);
      expect(synth.voices.size).toBe(0);
    });

    it('stopNote does nothing for unknown note', () => {
      expect(() => synth.stopNote(60)).not.toThrow();
    });
  });
});
