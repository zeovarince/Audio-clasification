/**
 * AudioWorkletProcessor untuk mengumpulkan sampel PCM mono.
 * Berjalan di audio thread, mengirim buffer ke main thread.
 */

class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._targetSR = 22050;
  }

  process(inputs) {
    const channels = inputs[0];
    if (!channels || channels.length === 0) return true;

    // Samakan ke mono seperti saat audio training dimuat dengan librosa.
    const frameCount = channels[0].length;
    for (let frame = 0; frame < frameCount; frame++) {
      let monoSample = 0;
      for (let channel = 0; channel < channels.length; channel++) {
        monoSample += channels[channel][frame] ?? 0;
      }
      this._buffer.push(monoSample / channels.length);
    }

    // Kirim ke main thread setiap kali buffer cukup (setiap ~100ms untuk responsivitas)
    if (this._buffer.length >= this._targetSR * 0.1) {
      this.port.postMessage({
        type: "pcm",
        samples: new Float32Array(this._buffer),
      });
      this._buffer = [];
    }

    return true;
  }
}

registerProcessor("pcm-capture", PCMCaptureProcessor);
