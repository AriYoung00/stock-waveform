class WavetableProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.wavetable = null;
    this.phase = 0;
    this.port.onmessage = (e) => {
      if (e.data.type === 'wavetable') {
        this.wavetable = new Float32Array(e.data.samples);
      }
    };
  }

  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 440, minValue: 20, maxValue: 20000, automationRate: 'a-rate' },
    ];
  }

  process(inputs, outputs, parameters) {
    if (!this.wavetable || this.wavetable.length === 0) return true;

    const output = outputs[0][0];
    const freqParam = parameters.frequency;
    const tableLen = this.wavetable.length;

    for (let i = 0; i < output.length; i++) {
      const freq = freqParam.length > 1 ? freqParam[i] : freqParam[0];
      const phaseIncrement = (tableLen * freq) / sampleRate;

      const i0 = Math.floor(this.phase) % tableLen;
      const i1 = (i0 + 1) % tableLen;
      const frac = this.phase - Math.floor(this.phase);
      output[i] = this.wavetable[i0] * (1 - frac) + this.wavetable[i1] * frac;

      this.phase = (this.phase + phaseIncrement) % tableLen;
    }

    return true;
  }
}

registerProcessor('wavetable-processor', WavetableProcessor);
