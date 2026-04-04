class StockSynth {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.wavetable = null;
    this.voices = new Map(); // midi note -> voice
    this.ready = false;

    // ADSR defaults
    this.attack = 0.01;
    this.decay = 0.1;
    this.sustain = 0.7;
    this.release = 0.3;
    this.gain = 0.5;
  }

  async init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    await this.ctx.audioWorklet.addModule('worklet/wavetable-processor.js');
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.gain;
    this.masterGain.connect(this.ctx.destination);
    this.ready = true;
  }

  setWavetable(samples) {
    this.wavetable = samples; // Float32Array normalized to [-1, 1]
  }

  setParam(name, value) {
    const v = parseFloat(value);
    if (isNaN(v)) return;
    switch (name) {
      case 'attack':  this.attack  = Math.max(0.001, Math.min(2.0, v)); break;
      case 'decay':   this.decay   = Math.max(0.001, Math.min(2.0, v)); break;
      case 'sustain': this.sustain = Math.max(0.0,   Math.min(1.0, v)); break;
      case 'release': this.release = Math.max(0.001, Math.min(5.0, v)); break;
      case 'gain':
        this.gain = Math.max(0.0, Math.min(1.0, v));
        if (this.masterGain) this.masterGain.gain.value = this.gain;
        break;
    }
  }

  playNote(midiNote) {
    if (!this.ready || !this.wavetable) return;
    if (this.voices.has(midiNote)) return; // already playing

    // Resume context if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const now = this.ctx.currentTime;

    // Create worklet node
    const worklet = new AudioWorkletNode(this.ctx, 'wavetable-processor');
    worklet.port.postMessage({ type: 'wavetable', samples: Array.from(this.wavetable) });
    worklet.parameters.get('frequency').value = freq;

    // Envelope gain node
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1.0, now + this.attack);
    env.gain.linearRampToValueAtTime(this.sustain, now + this.attack + this.decay);

    worklet.connect(env);
    env.connect(this.masterGain);

    this.voices.set(midiNote, { worklet, env });
  }

  stopNote(midiNote) {
    const voice = this.voices.get(midiNote);
    if (!voice) return;
    this.voices.delete(midiNote);

    const now = this.ctx.currentTime;
    const { env, worklet } = voice;

    env.gain.cancelScheduledValues(now);
    env.gain.setValueAtTime(env.gain.value, now);
    env.gain.linearRampToValueAtTime(0, now + this.release);

    // Disconnect after release envelope completes to prevent node accumulation
    setTimeout(() => {
      worklet.disconnect();
      env.disconnect();
    }, (this.release + 0.05) * 1000);
  }
}

window.StockSynth = StockSynth;
