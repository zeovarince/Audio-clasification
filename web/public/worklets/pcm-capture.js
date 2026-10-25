/**
 * AudioWorkletProcessor untuk mengumpulkan sampel PCM mono.
 * Berjalan di audio thread, mengirim buffer ke main thread.
 */

class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._targetSR = 22050;
    this._sourceSR = sampleRate; // global dari AudioWorklet scope
    this._ratio = this._sourceSR / this._targetSR;
    this._accumulator = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];

    // Downsampling sederhana jika browser sample rate != 22050
    if (Math.abs(this._ratio - 1.0) < 0.001) {
      // Sample rate cocok, kirim langsung
      this._buffer.push(...channelData);
    } else {
      // Downsample dengan linear interpolation
      for (let i = 0; i < channelData.length; i++) {
        this._accumulator += 1;
        if (this._accumulator >= this._ratio) {
          this._accumulator -= this._ratio;
          this._buffer.push(channelData[i]);
        }
      }
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
