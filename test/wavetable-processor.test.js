const { loadWavetableProcessor } = require('./helpers');

const WavetableProcessor = loadWavetableProcessor();

describe('WavetableProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new WavetableProcessor();
  });

  describe('parameterDescriptors', () => {
    it('declares a frequency parameter', () => {
      const descriptors = WavetableProcessor.parameterDescriptors;
      expect(descriptors).toHaveLength(1);
      expect(descriptors[0].name).toBe('frequency');
      expect(descriptors[0].defaultValue).toBe(440);
      expect(descriptors[0].minValue).toBe(20);
      expect(descriptors[0].maxValue).toBe(20000);
    });
  });

  describe('process', () => {
    it('returns true when no wavetable is loaded', () => {
      const output = new Float32Array(128);
      const result = processor.process([], [[output]], { frequency: [440] });
      expect(result).toBe(true);
      // Output should remain zeros
      expect(output.every(v => v === 0)).toBe(true);
    });

    it('generates output when wavetable is set', () => {
      // Simulate receiving a wavetable via message
      processor.port.onmessage({
        data: { type: 'wavetable', samples: [0, 0.5, 1, 0.5, 0, -0.5, -1, -0.5] },
      });

      const output = new Float32Array(128);
      const result = processor.process([], [[output]], { frequency: [440] });

      expect(result).toBe(true);
      // Output should have non-zero values
      const hasNonZero = output.some(v => v !== 0);
      expect(hasNonZero).toBe(true);
    });

    it('interpolates between wavetable samples', () => {
      // Simple two-sample wavetable: [0, 1]
      processor.port.onmessage({
        data: { type: 'wavetable', samples: [0, 1] },
      });

      const output = new Float32Array(8);
      // Very low frequency so phase advances slowly, allowing interpolation
      processor.process([], [[output]], { frequency: [1] });

      // First sample should be 0 (start of table)
      expect(output[0]).toBeCloseTo(0, 1);
    });

    it('uses per-sample frequency when array length > 1', () => {
      processor.port.onmessage({
        data: { type: 'wavetable', samples: [0, 0.5, 1, 0.5, 0, -0.5, -1, -0.5] },
      });

      // Provide per-sample frequency values
      const freqs = new Float32Array(128).fill(440);
      freqs[64] = 880; // double frequency halfway through

      const output = new Float32Array(128);
      processor.process([], [[output]], { frequency: freqs });

      expect(output.some(v => v !== 0)).toBe(true);
    });

    it('wraps phase around the wavetable', () => {
      // 4-sample wavetable
      const samples = [1, 0, -1, 0];
      processor.port.onmessage({ data: { type: 'wavetable', samples } });

      // Process enough samples that phase wraps around
      const output = new Float32Array(256);
      processor.process([], [[output]], { frequency: [440] });

      // Should still produce valid output (no NaN or Infinity)
      const allFinite = output.every(v => isFinite(v));
      expect(allFinite).toBe(true);
    });
  });
});
