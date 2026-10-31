/**
 * Modul penangkapan audio dari mikrofon browser.
 * Mengelola getUserMedia, AudioContext, AnalyserNode, dan AudioWorklet.
 */

import { SAMPLE_RATE, WINDOW_SECONDS, HOP_SECONDS, DEFAULT_MIC_GAIN } from "./config";
import { predict, type PredictResponse } from "./api";

export interface AudioCaptureCallbacks {
  onAnalyser: (analyser: AnalyserNode) => void;
  onPrediction: (result: PredictResponse) => void;
  onError: (error: Error) => void;
}

export interface AudioCapture {
  start: () => Promise<void>;
  stop: () => void;
  isActive: () => boolean;
  setGain: (gain: number) => void;
}

export function createAudioCapture(
  callbacks: AudioCaptureCallbacks,
  initialGain: number = DEFAULT_MIC_GAIN
): AudioCapture {
  let audioContext: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let analyser: AnalyserNode | null = null;
  let active = false;
  let currentGain = initialGain;

  // Ring buffer untuk menyimpan WINDOW_SECONDS sampel terakhir
  const bufferSize = Math.ceil(SAMPLE_RATE * WINDOW_SECONDS);
  let ringBuffer = new Float32Array(bufferSize);
  let writePos = 0;
  let totalSamplesReceived = 0;

  // Timer pengiriman
  let sendInterval: ReturnType<typeof setInterval> | null = null;
  let pendingRequest = false;

  function reset() {
    ringBuffer = new Float32Array(bufferSize);
    writePos = 0;
    totalSamplesReceived = 0;
    pendingRequest = false;
  }

  async function start() {
    if (active) return;

    try {
      // Pertahankan dinamika mikrofon agar tidak mengubah fitur energi model.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      // Minta browser mengonversi input device ke sample rate model.
      try {
        audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      } catch {
        throw new Error("Browser ini tidak mendukung pemrosesan audio 22050 Hz.");
      }
      if (audioContext.sampleRate !== SAMPLE_RATE) {
        const actualSampleRate = audioContext.sampleRate;
        await audioContext.close();
        audioContext = null;
        throw new Error(
          `Sample rate browser ${actualSampleRate} Hz tidak cocok dengan model (${SAMPLE_RATE} Hz).`
        );
      }

      // Pastikan AudioContext aktif (tidak tersuspensi oleh browser)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);

      // Setup AnalyserNode untuk waveform (berjalan independen dari prediksi)
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      callbacks.onAnalyser(analyser);

      // Setup AudioWorklet untuk PCM capture
      await audioContext.audioWorklet.addModule("/worklets/pcm-capture.js");
      workletNode = new AudioWorkletNode(audioContext, "pcm-capture");

      workletNode.port.onmessage = (event) => {
        if (event.data.type === "pcm") {
          const samples: Float32Array = event.data.samples;
          // Tulis ke ring buffer
          for (let i = 0; i < samples.length; i++) {
            ringBuffer[writePos] = samples[i];
            writePos = (writePos + 1) % bufferSize;
            totalSamplesReceived++;
          }
        }
      };

      source.connect(workletNode);
      // Worklet tidak perlu output
      workletNode.connect(audioContext.destination);

      // Kirim audio ke backend setiap HOP_SECONDS
      sendInterval = setInterval(() => {
        if (!active || pendingRequest) return;

        // Pastikan sudah cukup sampel terkumpul
        if (totalSamplesReceived < bufferSize) return;

        // Ambil WINDOW_SECONDS terakhir dari ring buffer
        const windowSamples = new Float32Array(bufferSize);
        for (let i = 0; i < bufferSize; i++) {
          windowSamples[i] = ringBuffer[(writePos + i) % bufferSize];
        }

        // Konversi Float32 ke Int16 dengan penguatan sensitivitas gain
        const int16 = new Int16Array(bufferSize);
        for (let i = 0; i < bufferSize; i++) {
          const s = Math.max(-1, Math.min(1, windowSamples[i] * currentGain));
          int16[i] = s < 0 ? s * 32768 : s * 32767;
        }

        pendingRequest = true;
        predict(int16.buffer)
          .then((result) => {
            if (active) {
              callbacks.onPrediction(result);
            }
          })
          .catch((err) => {
            if (active) {
              callbacks.onError(
                err instanceof Error ? err : new Error(String(err))
              );
            }
          })
          .finally(() => {
            pendingRequest = false;
          });
      }, HOP_SECONDS * 1000);

      active = true;
    } catch (err) {
      stop();
      throw err;
    }
  }

  function stop() {
    active = false;

    if (sendInterval) {
      clearInterval(sendInterval);
      sendInterval = null;
    }

    if (workletNode) {
      workletNode.disconnect();
      workletNode.port.close();
      workletNode = null;
    }

    if (analyser) {
      analyser.disconnect();
      analyser = null;
    }

    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }

    reset();
  }

  return {
    start,
    stop,
    isActive: () => active,
    setGain: (gain: number) => {
      currentGain = Math.max(0.5, Math.min(10, gain));
    },
  };
}
