/**
 * Fast Fourier Transform (FFT) implementation
 * Cooley-Tukey algorithm for power-of-2 sizes
 */

export class Complex {
  constructor(public real: number, public imag: number) {}

  add(other: Complex): Complex {
    return new Complex(this.real + other.real, this.imag + other.imag);
  }

  subtract(other: Complex): Complex {
    return new Complex(this.real - other.real, this.imag - other.imag);
  }

  multiply(other: Complex): Complex {
    return new Complex(
      this.real * other.real - this.imag * other.imag,
      this.real * other.imag + this.imag * other.real
    );
  }

  magnitude(): number {
    return Math.sqrt(this.real * this.real + this.imag * this.imag);
  }

  phase(): number {
    return Math.atan2(this.imag, this.real);
  }
}

export class FFT {
  private static bitReverse(n: number, bits: number): number {
    let reversed = 0;
    for (let i = 0; i < bits; i++) {
      reversed = (reversed << 1) | (n & 1);
      n >>= 1;
    }
    return reversed;
  }

  private static isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }

  private static nextPowerOfTwo(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }

  /**
   * Compute FFT of real signal
   * @param signal Input signal (real values)
   * @returns Complex FFT result
   */
  static fft(signal: Float32Array): Complex[] {
    const N = signal.length;
    
    if (!this.isPowerOfTwo(N)) {
      throw new Error('FFT size must be a power of 2');
    }

    // Convert real signal to complex
    const complex: Complex[] = new Array(N);
    for (let i = 0; i < N; i++) {
      complex[i] = new Complex(signal[i], 0);
    }

    // Bit reversal
    const bits = Math.log2(N);
    for (let i = 0; i < N; i++) {
      const j = this.bitReverse(i, bits);
      if (i < j) {
        [complex[i], complex[j]] = [complex[j], complex[i]];
      }
    }

    // Cooley-Tukey FFT
    for (let stage = 1; stage <= bits; stage++) {
      const m = 1 << stage;
      const m2 = m >> 1;
      const theta = -2 * Math.PI / m;

      for (let k = 0; k < N; k += m) {
        for (let j = 0; j < m2; j++) {
          const twiddle = new Complex(
            Math.cos(j * theta),
            Math.sin(j * theta)
          );
          
          const t = complex[k + j + m2].multiply(twiddle);
          const u = complex[k + j];
          
          complex[k + j] = u.add(t);
          complex[k + j + m2] = u.subtract(t);
        }
      }
    }

    return complex;
  }

  /**
   * Compute inverse FFT
   * @param complex Complex FFT data
   * @returns Real signal
   */
  static ifft(complex: Complex[]): Float32Array {
    const N = complex.length;
    
    // Conjugate the complex numbers
    const conjugated = complex.map(c => new Complex(c.real, -c.imag));
    
    // Forward FFT
    const result = this.fft(new Float32Array(conjugated.map(c => c.real)));
    
    // Conjugate and scale
    const signal = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      signal[i] = result[i].real / N;
    }
    
    return signal;
  }

  /**
   * Compute real FFT (more efficient for real signals)
   * Returns only positive frequencies
   */
  static rfft(signal: Float32Array): Complex[] {
    const fftResult = this.fft(signal);
    const N = signal.length;
    return fftResult.slice(0, Math.floor(N / 2) + 1);
  }

  /**
   * Compute power spectrum
   * @param signal Input signal
   * @returns Power spectrum (magnitude squared)
   */
  static powerSpectrum(signal: Float32Array): Float32Array {
    const fftResult = this.rfft(signal);
    const spectrum = new Float32Array(fftResult.length);
    
    for (let i = 0; i < fftResult.length; i++) {
      const mag = fftResult[i].magnitude();
      spectrum[i] = mag * mag;
    }
    
    return spectrum;
  }

  /**
   * Compute magnitude spectrum in dB
   * @param signal Input signal
   * @param reference Reference value for dB calculation
   * @returns Magnitude spectrum in dB
   */
  static magnitudeSpectrumdB(signal: Float32Array, reference: number = 1): Float32Array {
    const powerSpec = this.powerSpectrum(signal);
    const dBSpec = new Float32Array(powerSpec.length);
    
    for (let i = 0; i < powerSpec.length; i++) {
      dBSpec[i] = 10 * Math.log10(powerSpec[i] / (reference * reference) + 1e-12);
    }
    
    return dBSpec;
  }

  /**
   * Zero-pad signal to next power of 2
   */
  static zeroPad(signal: Float32Array): Float32Array {
    const N = signal.length;
    const paddedSize = this.nextPowerOfTwo(N);
    
    if (N === paddedSize) {
      return signal;
    }
    
    const padded = new Float32Array(paddedSize);
    padded.set(signal);
    return padded;
  }

  /**
   * Apply window function to signal
   */
  static applyWindow(signal: Float32Array, windowType: 'hamming' | 'hann' | 'blackman' = 'hamming'): Float32Array {
    const N = signal.length;
    const windowed = new Float32Array(N);
    
    for (let i = 0; i < N; i++) {
      let window = 1;
      
      switch (windowType) {
        case 'hamming':
          window = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
          break;
        case 'hann':
          window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
          break;
        case 'blackman':
          const a0 = 0.42;
          const a1 = 0.5;
          const a2 = 0.08;
          const x = 2 * Math.PI * i / (N - 1);
          window = a0 - a1 * Math.cos(x) + a2 * Math.cos(2 * x);
          break;
      }
      
      windowed[i] = signal[i] * window;
    }
    
    return windowed;
  }

  /**
   * Compute frequency bins for FFT result
   * @param fftSize Size of FFT
   * @param sampleRate Sample rate in Hz
   * @returns Array of frequency values in Hz
   */
  static getFrequencyBins(fftSize: number, sampleRate: number): Float32Array {
    const numBins = Math.floor(fftSize / 2) + 1;
    const bins = new Float32Array(numBins);
    
    for (let i = 0; i < numBins; i++) {
      bins[i] = i * sampleRate / fftSize;
    }
    
    return bins;
  }
}

/**
 * Short-Time Fourier Transform (STFT)
 */
export class STFT {
  private windowSize: number;
  private hopSize: number;
  private windowType: 'hamming' | 'hann' | 'blackman';
  private fftSize: number;

  constructor(
    windowSize: number = 2048,
    hopSize: number = 512,
    windowType: 'hamming' | 'hann' | 'blackman' = 'hamming'
  ) {
    this.windowSize = windowSize;
    this.hopSize = hopSize;
    this.windowType = windowType;
    this.fftSize = FFT.nextPowerOfTwo(windowSize);
  }

  /**
   * Compute STFT of signal
   * @param signal Input signal
   * @returns 2D array of complex spectrogram
   */
  process(signal: Float32Array): Complex[][] {
    const numFrames = Math.floor((signal.length - this.windowSize) / this.hopSize) + 1;
    const spectrogram: Complex[][] = [];

    for (let frame = 0; frame < numFrames; frame++) {
      const start = frame * this.hopSize;
      const end = start + this.windowSize;
      
      // Extract frame
      const frameData = signal.slice(start, end);
      
      // Apply window
      const windowed = FFT.applyWindow(frameData, this.windowType);
      
      // Zero-pad if necessary
      const padded = this.fftSize > this.windowSize 
        ? FFT.zeroPad(windowed)
        : windowed;
      
      // Compute FFT
      const fftFrame = FFT.fft(padded);
      
      // Store positive frequencies only
      spectrogram.push(fftFrame.slice(0, Math.floor(this.fftSize / 2) + 1));
    }

    return spectrogram;
  }

  /**
   * Compute magnitude spectrogram
   */
  magnitudeSpectrogram(signal: Float32Array): Float32Array[] {
    const complexSpec = this.process(signal);
    const magSpec: Float32Array[] = [];

    for (const frame of complexSpec) {
      const magFrame = new Float32Array(frame.length);
      for (let i = 0; i < frame.length; i++) {
        magFrame[i] = frame[i].magnitude();
      }
      magSpec.push(magFrame);
    }

    return magSpec;
  }

  /**
   * Compute power spectrogram in dB
   */
  powerSpectrogramdB(signal: Float32Array, reference: number = 1): Float32Array[] {
    const complexSpec = this.process(signal);
    const dBSpec: Float32Array[] = [];

    for (const frame of complexSpec) {
      const dBFrame = new Float32Array(frame.length);
      for (let i = 0; i < frame.length; i++) {
        const power = frame[i].magnitude() ** 2;
        dBFrame[i] = 10 * Math.log10(power / (reference * reference) + 1e-12);
      }
      dBSpec.push(dBFrame);
    }

    return dBSpec;
  }
}