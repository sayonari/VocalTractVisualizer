import { describe, it, expect } from 'vitest';
import { FFT, Complex, STFT } from '../src/utils/fft';

describe('FFT', () => {
  describe('Complex number operations', () => {
    it('should add complex numbers correctly', () => {
      const a = new Complex(3, 4);
      const b = new Complex(1, 2);
      const result = a.add(b);
      expect(result.real).toBe(4);
      expect(result.imag).toBe(6);
    });

    it('should calculate magnitude correctly', () => {
      const c = new Complex(3, 4);
      expect(c.magnitude()).toBe(5);
    });
  });

  describe('FFT computation', () => {
    it('should compute FFT of DC signal', () => {
      const signal = new Float32Array(8).fill(1);
      const result = FFT.fft(signal);
      
      expect(result[0].real).toBeCloseTo(8);
      expect(result[0].imag).toBeCloseTo(0);
      
      for (let i = 1; i < result.length; i++) {
        expect(result[i].magnitude()).toBeCloseTo(0, 5);
      }
    });

    it('should compute FFT of sine wave', () => {
      const N = 64;
      const signal = new Float32Array(N);
      const freq = 8; // 8 cycles in N samples
      
      for (let i = 0; i < N; i++) {
        signal[i] = Math.sin(2 * Math.PI * freq * i / N);
      }
      
      const result = FFT.fft(signal);
      
      // Peak should be at bin 8
      expect(result[freq].magnitude()).toBeGreaterThan(N / 2 - 1);
      
      // Other bins should be near zero
      expect(result[0].magnitude()).toBeCloseTo(0, 5);
      expect(result[freq + 1].magnitude()).toBeLessThan(1);
    });

    it('should handle non-power-of-2 sizes with error', () => {
      const signal = new Float32Array(10);
      expect(() => FFT.fft(signal)).toThrow();
    });
  });

  describe('Window functions', () => {
    it('should apply Hamming window', () => {
      const signal = new Float32Array(8).fill(1);
      const windowed = FFT.applyWindow(signal, 'hamming');
      
      expect(windowed[0]).toBeCloseTo(0.08);
      expect(windowed[4]).toBeCloseTo(1.0, 1);
    });

    it('should apply Blackman window', () => {
      const signal = new Float32Array(8).fill(1);
      const windowed = FFT.applyWindow(signal, 'blackman');
      
      expect(windowed[0]).toBeCloseTo(0);
      expect(windowed[4]).toBeCloseTo(1.0, 1);
    });
  });

  describe('Power spectrum', () => {
    it('should compute power spectrum correctly', () => {
      const signal = new Float32Array(16);
      signal[0] = 1; // Impulse
      
      const spectrum = FFT.powerSpectrum(signal);
      
      // All frequencies should have equal power for impulse
      for (let i = 0; i < spectrum.length; i++) {
        expect(spectrum[i]).toBeCloseTo(1, 5);
      }
    });
  });

  describe('Frequency bins', () => {
    it('should calculate frequency bins correctly', () => {
      const fftSize = 1024;
      const sampleRate = 44100;
      const bins = FFT.getFrequencyBins(fftSize, sampleRate);
      
      expect(bins[0]).toBe(0);
      expect(bins[1]).toBeCloseTo(sampleRate / fftSize);
      expect(bins[bins.length - 1]).toBeCloseTo(sampleRate / 2);
    });
  });
});

describe('STFT', () => {
  it('should compute STFT with correct dimensions', () => {
    const signal = new Float32Array(4096);
    const stft = new STFT(512, 256);
    const result = stft.process(signal);
    
    const expectedFrames = Math.floor((4096 - 512) / 256) + 1;
    expect(result.length).toBe(expectedFrames);
    expect(result[0].length).toBe(257); // 512/2 + 1
  });

  it('should compute magnitude spectrogram', () => {
    const signal = new Float32Array(1024);
    // Create a chirp signal
    for (let i = 0; i < 1024; i++) {
      const freq = 10 + i * 0.1;
      signal[i] = Math.sin(2 * Math.PI * freq * i / 1024);
    }
    
    const stft = new STFT(256, 128);
    const magSpec = stft.magnitudeSpectrogram(signal);
    
    expect(magSpec.length).toBeGreaterThan(0);
    expect(magSpec[0].length).toBe(129);
  });
});