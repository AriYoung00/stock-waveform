const vm = require('vm');
const fs = require('fs');
const path = require('path');

/**
 * Loads normalize() and parseCSV() from docs/app.js by running it in a
 * sandboxed vm context with minimal DOM stubs.
 *
 * Coupling note: if app.js starts using globals not listed below (e.g. fetch,
 * URL, setTimeout), this loader will throw. Add the missing global to the
 * context object when that happens.
 */
function loadAppFunctions() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'docs', 'app.js'), 'utf-8');

  const mockElement = {
    addEventListener: () => {},
    value: '',
    files: [],
    textContent: '',
    dataset: {},
    getContext: () => ({
      fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '',
      fillRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
      stroke: () => {}, fillText: () => {},
    }),
    width: 800,
    height: 200,
  };

  const context = {
    StockSynth: class { init() {} setWavetable() {} setParam() {} playNote() {} stopNote() {} },
    document: {
      getElementById: () => mockElement,
      addEventListener: () => {},
      querySelectorAll: () => [],
    },
    window: {},
    Set: Set,
    Float32Array: Float32Array,
    Math: Math,
    console: console,
    isNaN: isNaN,
    parseFloat: parseFloat,
    Date: Date,
  };

  vm.createContext(context);
  vm.runInContext(code, context);

  if (typeof context.normalize !== 'function' || typeof context.parseCSV !== 'function' || typeof context.filterByRange !== 'function') {
    throw new Error(
      'Failed to load functions from app.js — the file likely uses a global ' +
      'not present in the test vm context. Check test/helpers.js.'
    );
  }

  return {
    normalize: context.normalize,
    parseCSV: context.parseCSV,
    filterByRange: context.filterByRange,
  };
}

/**
 * Loads WavetableProcessor from docs/worklet/wavetable-processor.js via vm.
 *
 * Same coupling caveat as loadAppFunctions — if the worklet starts using new
 * globals, add them to the context below.
 */
function loadWavetableProcessor() {
  const code = fs.readFileSync(
    path.join(__dirname, '..', 'docs', 'worklet', 'wavetable-processor.js'),
    'utf-8'
  );

  let registeredClass;
  const context = {
    AudioWorkletProcessor: class {
      constructor() { this.port = { onmessage: null }; }
    },
    registerProcessor: (_, cls) => { registeredClass = cls; },
    sampleRate: 44100,
    Float32Array: Float32Array,
    Math: Math,
  };

  vm.createContext(context);
  vm.runInContext(code, context);

  if (!registeredClass) {
    throw new Error(
      'Failed to load WavetableProcessor — registerProcessor was never called. ' +
      'Check test/helpers.js.'
    );
  }

  return registeredClass;
}

module.exports = { loadAppFunctions, loadWavetableProcessor };
