import { describe, it, expect } from 'vitest';
import { LPC, RealtimeLPCAnalyzer } from '../src/utils/lpc';

describe('LPC', () => {
  describe('Autocorrelation', () => {
    it('should compute autocorrelation correctly', () => {
      const signal = new Float32Array([1, 0, -1, 0, 1, 0, -1, 0]);
      const r = LPC.autocorrelation(signal, 5);
      
      // r[0] should be the energy
      expect(r[0]).toBeCloseTo(4);
      
      // r[1] should be near zero for this alternating signal
      expect(r[1]).toBeCloseTo(0);
      
      // r[2] should be negative (anti-correlation)
      expect(r[2]).toBeLessThan(0);
    });

    it('should handle DC signal', () => {
      const signal = new Float32Array(10).fill(2);
      const r = LPC.autocorrelation(signal, 3);
      
      expect(r[0]).toBeCloseTo(40); // 10 * 2^2
      expect(r[1]).toBeCloseTo(36); // 9 * 2^2
      expect(r[2]).toBeCloseTo(32); // 8 * 2^2
    });
  });

  describe('Pre-emphasis filter', () => {
    it('should apply pre-emphasis correctly', () => {
      const signal = new Float32Array([1, 2, 3, 4]);
      const alpha = 0.95;
      const filtered = LPC.applyPreEmphasis(signal, alpha);
      
      expect(filtered[0]).toBe(1);
      expect(filtered[1]).toBeCloseTo(2 - 0.95 * 1);
      expect(filtered[2]).toBeCloseTo(3 - 0.95 * 2);
      expect(filtered[3]).toBeCloseTo(4 - 0.95 * 3);
    });
  });

  describe('Levinson-Durbin algorithm', () => {
    it('should compute LPC coefficients for simple signal', () => {
      // Create a simple AR signal
      const signal = new Float32Array(100);
      signal[0] = 1;
      for (let i = 1; i < 100; i++) {
        signal[i] = 0.5 * signal[i - 1] + (Math.random() - 0.5) * 0.1;
      }
      
      const r = LPC.autocorrelation(signal, 3);
      const result = LPC.levinsonDurbin(r, 2);
      
      expect(result.coefficients.length).toBe(2);
      expect(result.reflectionCoefficients.length).toBe(2);
      expect(result.predictionError).toBeGreaterThan(0);
      expect(result.gain).toBeGreaterThan(0);
    });

    it('should handle zero signal gracefully', () => {
      const r = new Float32Array(5); // All zeros
      const result = LPC.levinsonDurbin(r, 4);
      
      expect(result.predictionError).toBe(0);
      expect(result.coefficients.every(c => c === 0)).toBe(true);
    });
  });

  describe('Reflection to area conversion', () => {
    it('should convert reflection coefficients to areas', () => {
      const k = new Float32Array([0.5, -0.3, 0.2]);
      const areas = LPC.reflectionToArea(k);
      
      expect(areas.length).toBe(4);
      expect(areas[0]).toBe(1); // Normalized glottis area
      
      // Check area ratios
      expect(areas[1]).toBeCloseTo((1 - 0.5) / (1 + 0.5));
      expect(areas[2]).toBeCloseTo(areas[1] * (1 - (-0.3)) / (1 + (-0.3)));
    });

    it('should handle zero reflection coefficients', () => {
      const k = new Float32Array(3); // All zeros
      const areas = LPC.reflectionToArea(k);
      
      expect(areas.every(a => a === 1)).toBe(true);
    });
  });

  describe('Log area conversion', () => {
    it('should convert areas to log scale', () => {
      const areas = new Float32Array([1, 2, 0.5, 0.1]);
      const logAreas = LPC.areaToLogArea(areas);
      
      expect(logAreas[0]).toBeCloseTo(0);
      expect(logAreas[1]).toBeCloseTo(Math.log(2));
      expect(logAreas[2]).toBeCloseTo(Math.log(0.5));
      expect(logAreas[3]).toBeCloseTo(Math.log(0.1));
    });

    it('should handle very small areas', () => {
      const areas = new Float32Array([1, 1e-10, 0]);
      const logAreas = LPC.areaToLogArea(areas);
      
      expect(logAreas[0]).toBeCloseTo(0);
      expect(logAreas[1]).toBeCloseTo(Math.log(1e-6));
      expect(logAreas[2]).toBeCloseTo(Math.log(1e-6));
    });
  });

  describe('LPC frequency response', () => {
    it('should compute frequency response', () => {
      const coeffs = new Float32Array([0.5, -0.3]);
      const response = LPC.lpcFrequencyResponse(coeffs, 128);
      
      expect(response.length).toBe(65); // 128/2 + 1
      expect(response[0]).toBeGreaterThan(-20); // DC response
    });
  });

  describe('Full LPC analysis', () => {
    it('should perform complete LPC analysis', () => {
      // Generate a vowel-like signal
      const sampleRate = 8000;
      const duration = 0.1;
      const f1 = 700, f2 = 1220, f3 = 2600;
      const signal = new Float32Array(sampleRate * duration);
      
      for (let i = 0; i < signal.length; i++) {
        const t = i / sampleRate;
        signal[i] = Math.sin(2 * Math.PI * f1 * t) * 0.5 +
                   Math.sin(2 * Math.PI * f2 * t) * 0.3 +
                   Math.sin(2 * Math.PI * f3 * t) * 0.2;
      }
      
      const result = LPC.analyze(signal, 14, 0.97);
      
      expect(result.coefficients.length).toBe(14);
      expect(result.reflectionCoefficients.length).toBe(14);
      expect(result.predictionError).toBeGreaterThan(0);
      
      // Check stability (all reflection coefficients should be < 1)
      expect(result.reflectionCoefficients.every(k => Math.abs(k) < 1)).toBe(true);
    });
  });
});

describe('RealtimeLPCAnalyzer', () => {
  it('should analyze frame and return vocal tract areas', () => {
    const analyzer = new RealtimeLPCAnalyzer(10, 0.97, 512, 8000);
    const frame = new Float32Array(512);
    
    // Create a simple signal
    for (let i = 0; i < 512; i++) {
      frame[i] = Math.sin(2 * Math.PI * 200 * i / 8000);
    }
    
    const result = analyzer.analyzeFrame(frame);
    
    expect(result.lpc).toBeDefined();
    expect(result.areas.length).toBe(11); // order + 1
    expect(result.logAreas.length).toBe(11);
    expect(result.formants).toBeDefined();
    expect(Array.isArray(result.formants)).toBe(true);
  });

  it('should update parameters correctly', () => {
    const analyzer = new RealtimeLPCAnalyzer();
    
    analyzer.updateParameters({
      order: 16,
      preEmphasis: 0.95,
      sampleRate: 16000
    });
    
    const frame = new Float32Array(512);
    const result = analyzer.analyzeFrame(frame);
    
    expect(result.lpc.coefficients.length).toBe(16);
  });
});