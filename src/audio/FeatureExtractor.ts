import { FFT, STFT } from '../utils/fft';
import { LPC, RealtimeLPCAnalyzer } from '../utils/lpc';

export interface AudioFeatures {
  // 基本的な特徴
  fundamentalFrequency: number | null;  // F0 (Hz)
  intensity: number;  // 音圧レベル (0-1)
  voiceQuality: 'voiced' | 'unvoiced' | 'silent';
  
  // スペクトル特徴
  spectralCentroid: number;  // スペクトル重心 (Hz)
  spectralSpread: number;    // スペクトルの広がり
  spectralFlux: number;      // スペクトル変化量
  spectralRolloff: number;   // スペクトルロールオフ
  
  // 音声特徴
  formants: number[];        // フォルマント周波数
  zeroCrossingRate: number;  // ゼロ交差率
  
  // LPC関連
  lpcCoefficients: Float32Array;
  reflectionCoefficients: Float32Array;
  vocalTractAreas: Float32Array;
  logVocalTractAreas: Float32Array;
}

export class FeatureExtractor {
  private sampleRate: number;
  private frameSize: number;
  private lpcAnalyzer: RealtimeLPCAnalyzer;
  private previousSpectrum: Float32Array | null = null;

  constructor(
    sampleRate: number = 44100,
    frameSize: number = 2048,
    lpcOrder: number = 14
  ) {
    this.sampleRate = sampleRate;
    this.frameSize = frameSize;
    
    // 8kHzでのLPC解析用
    this.lpcAnalyzer = new RealtimeLPCAnalyzer(
      lpcOrder,
      0.97,
      frameSize,
      8000  // LPC解析は8kHzで行う
    );
  }

  /**
   * 音声フレームから特徴を抽出
   * @param frame 音声フレーム
   * @returns 抽出された特徴
   */
  extractFeatures(frame: Float32Array): AudioFeatures {
    // 基本的な特徴
    const intensity = this.calculateIntensity(frame);
    const zcr = this.calculateZeroCrossingRate(frame);
    
    // FFT解析
    const windowedFrame = FFT.applyWindow(frame, 'hamming');
    const spectrum = FFT.powerSpectrum(windowedFrame);
    const frequencies = FFT.getFrequencyBins(this.frameSize, this.sampleRate);
    
    // スペクトル特徴
    const spectralCentroid = this.calculateSpectralCentroid(spectrum, frequencies);
    const spectralSpread = this.calculateSpectralSpread(spectrum, frequencies, spectralCentroid);
    const spectralFlux = this.calculateSpectralFlux(spectrum);
    const spectralRolloff = this.calculateSpectralRolloff(spectrum, frequencies);
    
    // 基本周波数推定
    const f0 = this.estimatePitch(frame);
    
    // 音声/無音声判定
    const voiceQuality = this.detectVoiceQuality(intensity, zcr, f0);
    
    // LPC解析（8kHzにダウンサンプリング）
    const downsampled = this.downsample(frame, this.sampleRate, 8000);
    const lpcResult = this.lpcAnalyzer.analyzeFrame(downsampled);
    
    return {
      fundamentalFrequency: f0,
      intensity,
      voiceQuality,
      spectralCentroid,
      spectralSpread,
      spectralFlux,
      spectralRolloff,
      formants: lpcResult.formants,
      zeroCrossingRate: zcr,
      lpcCoefficients: lpcResult.lpc.coefficients,
      reflectionCoefficients: lpcResult.lpc.reflectionCoefficients,
      vocalTractAreas: lpcResult.areas,
      logVocalTractAreas: lpcResult.logAreas
    };
  }

  /**
   * 音圧レベルの計算 (RMS)
   */
  private calculateIntensity(frame: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) {
      sum += frame[i] * frame[i];
    }
    return Math.sqrt(sum / frame.length);
  }

  /**
   * ゼロ交差率の計算
   */
  private calculateZeroCrossingRate(frame: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < frame.length; i++) {
      if ((frame[i] >= 0) !== (frame[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / (frame.length - 1);
  }

  /**
   * スペクトル重心の計算
   */
  private calculateSpectralCentroid(
    spectrum: Float32Array, 
    frequencies: Float32Array
  ): number {
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      weightedSum += frequencies[i] * spectrum[i];
      magnitudeSum += spectrum[i];
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  /**
   * スペクトルの広がりの計算
   */
  private calculateSpectralSpread(
    spectrum: Float32Array,
    frequencies: Float32Array,
    centroid: number
  ): number {
    let weightedVariance = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      const deviation = frequencies[i] - centroid;
      weightedVariance += deviation * deviation * spectrum[i];
      magnitudeSum += spectrum[i];
    }
    
    return magnitudeSum > 0 ? Math.sqrt(weightedVariance / magnitudeSum) : 0;
  }

  /**
   * スペクトル変化量の計算
   */
  private calculateSpectralFlux(spectrum: Float32Array): number {
    if (!this.previousSpectrum) {
      this.previousSpectrum = new Float32Array(spectrum);
      return 0;
    }
    
    let flux = 0;
    for (let i = 0; i < spectrum.length; i++) {
      const diff = spectrum[i] - this.previousSpectrum[i];
      if (diff > 0) {
        flux += diff;
      }
    }
    
    this.previousSpectrum.set(spectrum);
    return flux;
  }

  /**
   * スペクトルロールオフの計算
   */
  private calculateSpectralRolloff(
    spectrum: Float32Array,
    frequencies: Float32Array,
    threshold: number = 0.85
  ): number {
    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
    const targetEnergy = totalEnergy * threshold;
    
    let cumulativeEnergy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      cumulativeEnergy += spectrum[i];
      if (cumulativeEnergy >= targetEnergy) {
        return frequencies[i];
      }
    }
    
    return frequencies[frequencies.length - 1];
  }

  /**
   * 基本周波数（ピッチ）推定 - 自己相関法
   */
  private estimatePitch(frame: Float32Array): number | null {
    const minPeriod = Math.floor(this.sampleRate / 500);  // 500Hz max
    const maxPeriod = Math.floor(this.sampleRate / 50);   // 50Hz min
    
    // 自己相関の計算
    const autocorr = new Float32Array(maxPeriod);
    for (let lag = minPeriod; lag < maxPeriod; lag++) {
      let sum = 0;
      for (let i = 0; i < frame.length - lag; i++) {
        sum += frame[i] * frame[i + lag];
      }
      autocorr[lag] = sum;
    }
    
    // ピーク検出
    let maxValue = 0;
    let maxIndex = 0;
    for (let i = minPeriod; i < maxPeriod; i++) {
      if (autocorr[i] > maxValue) {
        maxValue = autocorr[i];
        maxIndex = i;
      }
    }
    
    // 閾値チェック
    const threshold = autocorr[0] * 0.3;
    if (maxValue < threshold) {
      return null;  // 無声音
    }
    
    // 周波数に変換
    return this.sampleRate / maxIndex;
  }

  /**
   * 音声/無音声判定
   */
  private detectVoiceQuality(
    intensity: number,
    zcr: number,
    f0: number | null
  ): 'voiced' | 'unvoiced' | 'silent' {
    // 無音判定（より高い閾値）
    if (intensity < 0.02) {
      return 'silent';
    }
    
    // 有声音判定（より厳密な条件）
    if (f0 !== null && f0 > 50 && f0 < 500 && zcr < 0.3 && intensity > 0.03) {
      return 'voiced';
    }
    
    // 無声音
    return 'unvoiced';
  }

  /**
   * ダウンサンプリング
   */
  private downsample(
    signal: Float32Array,
    fromRate: number,
    toRate: number
  ): Float32Array {
    if (fromRate === toRate) {
      return signal;
    }
    
    const ratio = fromRate / toRate;
    const newLength = Math.floor(signal.length / ratio);
    const output = new Float32Array(newLength);
    
    // 簡易的な線形補間
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexInt = Math.floor(srcIndex);
      const fraction = srcIndex - srcIndexInt;
      
      if (srcIndexInt < signal.length - 1) {
        output[i] = signal[srcIndexInt] * (1 - fraction) + 
                   signal[srcIndexInt + 1] * fraction;
      } else {
        output[i] = signal[signal.length - 1];
      }
    }
    
    return output;
  }

  /**
   * メル周波数ケプストラム係数 (MFCC) の計算
   * @param frame 音声フレーム
   * @param numCoeffs 係数の数
   * @returns MFCC係数
   */
  calculateMFCC(frame: Float32Array, numCoeffs: number = 13): Float32Array {
    // この実装は簡易版です
    // 実際にはメルフィルタバンク→DCT処理が必要
    console.warn('MFCC calculation is not fully implemented yet');
    return new Float32Array(numCoeffs);
  }

  /**
   * パラメータの更新
   */
  updateParameters(params: {
    sampleRate?: number;
    frameSize?: number;
    lpcOrder?: number;
  }) {
    if (params.sampleRate !== undefined) {
      this.sampleRate = params.sampleRate;
    }
    if (params.frameSize !== undefined) {
      this.frameSize = params.frameSize;
    }
    if (params.lpcOrder !== undefined) {
      this.lpcAnalyzer.updateParameters({ order: params.lpcOrder });
    }
  }

  /**
   * リセット
   */
  reset() {
    this.previousSpectrum = null;
  }
}

/**
 * バッチ処理用の特徴抽出
 */
export class BatchFeatureExtractor {
  private extractor: FeatureExtractor;
  private windowSize: number;
  private hopSize: number;

  constructor(
    sampleRate: number = 44100,
    windowSize: number = 2048,
    hopSize: number = 512,
    lpcOrder: number = 14
  ) {
    this.extractor = new FeatureExtractor(sampleRate, windowSize, lpcOrder);
    this.windowSize = windowSize;
    this.hopSize = hopSize;
  }

  /**
   * 音声信号全体から特徴を抽出
   * @param signal 音声信号
   * @returns フレームごとの特徴配列
   */
  extract(signal: Float32Array): AudioFeatures[] {
    const features: AudioFeatures[] = [];
    const numFrames = Math.floor((signal.length - this.windowSize) / this.hopSize) + 1;
    
    for (let i = 0; i < numFrames; i++) {
      const start = i * this.hopSize;
      const end = start + this.windowSize;
      const frame = signal.slice(start, end);
      
      features.push(this.extractor.extractFeatures(frame));
    }
    
    return features;
  }
}