/**
 * Linear Predictive Coding (LPC) analysis
 * Implementation of Levinson-Durbin algorithm
 */

export interface LPCResult {
  coefficients: Float32Array;  // LPC係数 (a[1] to a[p])
  reflectionCoefficients: Float32Array;  // 反射係数 (PARCOR係数)
  predictionError: number;  // 予測誤差
  gain: number;  // ゲイン
}

export class LPC {
  /**
   * 自己相関関数の計算
   * @param signal 入力信号
   * @param maxLag 最大ラグ（通常はLPC次数+1）
   * @returns 自己相関関数
   */
  static autocorrelation(signal: Float32Array, maxLag: number): Float32Array {
    const N = signal.length;
    const r = new Float32Array(maxLag);
    
    for (let lag = 0; lag < maxLag; lag++) {
      let sum = 0;
      for (let n = 0; n < N - lag; n++) {
        sum += signal[n] * signal[n + lag];
      }
      r[lag] = sum;
    }
    
    return r;
  }

  /**
   * Levinson-Durbinアルゴリズムによ��LPC解析
   * @param autocorr 自己相関関数
   * @param order LPC次数
   * @returns LPC解析結果
   */
  static levinsonDurbin(autocorr: Float32Array, order: number): LPCResult {
    // 初期化
    const a = new Float32Array(order + 1);  // LPC係数
    const k = new Float32Array(order);      // 反射係数
    const atemp = new Float32Array(order + 1);
    
    // 初期値
    let E = autocorr[0];  // 予測誤差
    
    // Levinson-Durbin再帰
    for (let i = 0; i < order; i++) {
      // 反射係数の計算
      let sum = 0;
      for (let j = 0; j < i; j++) {
        sum += a[j + 1] * autocorr[i - j];
      }
      k[i] = (autocorr[i + 1] - sum) / E;
      
      // LPC係数の更新
      a[i + 1] = k[i];
      for (let j = 0; j < i; j++) {
        atemp[j + 1] = a[j + 1] - k[i] * a[i - j];
      }
      for (let j = 0; j < i; j++) {
        a[j + 1] = atemp[j + 1];
      }
      
      // 予測誤差の更新
      E = E * (1 - k[i] * k[i]);
      
      // 安定性チェック
      if (E <= 0) {
        console.warn('LPC: Prediction error became non-positive');
        break;
      }
    }
    
    // 結果を返す（a[0] = 1は含めない）
    const coefficients = new Float32Array(order);
    for (let i = 0; i < order; i++) {
      coefficients[i] = a[i + 1];
    }
    
    return {
      coefficients,
      reflectionCoefficients: k,
      predictionError: E,
      gain: Math.sqrt(E)
    };
  }

  /**
   * LPC解析のメイン関数
   * @param signal 入力信号
   * @param order LPC次数
   * @param preEmphasis プリエンファシス係数（0-1、通常0.97）
   * @returns LPC解析結果
   */
  static analyze(signal: Float32Array, order: number, preEmphasis: number = 0.97): LPCResult {
    // プリエンファシスフィルタの適用
    const filtered = this.applyPreEmphasis(signal, preEmphasis);
    
    // 自己相関関数の計算
    const autocorr = this.autocorrelation(filtered, order + 1);
    
    // Levinson-Durbinアルゴリズム
    return this.levinsonDurbin(autocorr, order);
  }

  /**
   * プリエンファシスフィルタ
   * @param signal 入力信号
   * @param alpha プリエンファシス係数
   * @returns フィルタ後の信号
   */
  static applyPreEmphasis(signal: Float32Array, alpha: number): Float32Array {
    const output = new Float32Array(signal.length);
    output[0] = signal[0];
    
    for (let i = 1; i < signal.length; i++) {
      output[i] = signal[i] - alpha * signal[i - 1];
    }
    
    return output;
  }

  /**
   * 反射係数から声道面積関数への変換
   * @param reflectionCoeffs 反射係数
   * @returns 正規化された声道面積関数
   */
  static reflectionToArea(reflectionCoeffs: Float32Array): Float32Array {
    const n = reflectionCoeffs.length;
    const areas = new Float32Array(n + 1);
    
    // 声門側の面積を1に正規化
    areas[0] = 1.0;
    
    // 反射係数から面積比を計算
    for (let i = 0; i < n; i++) {
      // 反射係数を安全な範囲にクリップ（-0.99 to 0.99）
      const k = Math.max(-0.99, Math.min(0.99, reflectionCoeffs[i]));
      // 反射係数kから面積比を計算: A[i+1]/A[i] = (1-k)/(1+k)
      areas[i + 1] = areas[i] * ((1 - k) / (1 + k));
    }
    
    return areas;
  }

  /**
   * 声道面積関数を対数スケールに変換
   * @param areas 声道面積関数
   * @returns 対数面積関数
   */
  static areaToLogArea(areas: Float32Array): Float32Array {
    const logAreas = new Float32Array(areas.length);
    
    for (let i = 0; i < areas.length; i++) {
      // 小さい値でのlog計算を避けるため、最小値を設定
      const area = Math.max(areas[i], 1e-6);
      logAreas[i] = Math.log(area);
    }
    
    return logAreas;
  }

  /**
   * LPC係数から周波数応答を計算
   * @param coefficients LPC係数
   * @param nfft FFTサイズ
   * @returns 周波数応答の振幅（dB）
   */
  static lpcFrequencyResponse(coefficients: Float32Array, nfft: number = 512): Float32Array {
    const response = new Float32Array(nfft / 2 + 1);
    
    for (let k = 0; k <= nfft / 2; k++) {
      const omega = 2 * Math.PI * k / nfft;
      
      // H(z) = 1 / (1 + sum(a[i] * z^(-i)))
      let real = 1;
      let imag = 0;
      
      for (let i = 0; i < coefficients.length; i++) {
        const angle = -omega * (i + 1);
        real += coefficients[i] * Math.cos(angle);
        imag += coefficients[i] * Math.sin(angle);
      }
      
      // 振幅をdBに変換
      const magnitude = Math.sqrt(real * real + imag * imag);
      response[k] = -20 * Math.log10(magnitude + 1e-12);
    }
    
    return response;
  }

  /**
   * LPC係数からフォルマント周波数を推定
   * @param coefficients LPC係数
   * @param sampleRate サンプリングレート
   * @param numFormants 検出するフォルマント数
   * @returns フォルマント周波数の配列
   */
  static estimateFormants(
    coefficients: Float32Array, 
    sampleRate: number, 
    numFormants: number = 5
  ): number[] {
    // 多項式の根を求める（簡易版）
    // 実際の実装では、より高度な根探索アルゴリズムが必要
    const formants: number[] = [];
    const response = this.lpcFrequencyResponse(coefficients, 4096);
    
    // ピーク検出
    for (let i = 1; i < response.length - 1; i++) {
      if (response[i] > response[i - 1] && response[i] > response[i + 1]) {
        const freq = i * sampleRate / (2 * (response.length - 1));
        if (freq > 90 && freq < sampleRate / 2) {  // 90Hz以上
          formants.push(freq);
          if (formants.length >= numFormants) break;
        }
      }
    }
    
    return formants;
  }

  /**
   * ケプストラム分析によるLPC
   * @param signal 入力信号
   * @param order LPC次数
   * @returns LPC係数
   */
  static cepstralLPC(signal: Float32Array, order: number): Float32Array {
    // この実装は簡易版です
    // 実際にはFFT→log→IFFT→窓関数→FFTの処理が必要
    console.warn('Cepstral LPC is not fully implemented yet');
    return new Float32Array(order);
  }

  /**
   * LPC合成フィルタ
   * @param excitation 励振信号
   * @param coefficients LPC係数
   * @param gain ゲイン
   * @returns 合成音声
   */
  static synthesize(
    excitation: Float32Array, 
    coefficients: Float32Array, 
    gain: number
  ): Float32Array {
    const output = new Float32Array(excitation.length);
    const order = coefficients.length;
    
    for (let n = 0; n < excitation.length; n++) {
      output[n] = gain * excitation[n];
      
      for (let i = 0; i < order; i++) {
        if (n - i - 1 >= 0) {
          output[n] -= coefficients[i] * output[n - i - 1];
        }
      }
    }
    
    return output;
  }
}

/**
 * リアルタイムLPC解析器
 */
export class RealtimeLPCAnalyzer {
  private order: number;
  private preEmphasis: number;
  private frameSize: number;
  private sampleRate: number;

  constructor(
    order: number = 14,
    preEmphasis: number = 0.97,
    frameSize: number = 512,
    sampleRate: number = 8000
  ) {
    this.order = order;
    this.preEmphasis = preEmphasis;
    this.frameSize = frameSize;
    this.sampleRate = sampleRate;
  }

  /**
   * フレーム単位でLPC解析を実行
   * @param frame 音声フレーム
   * @returns LPC解析結果と声道面積関数
   */
  analyzeFrame(frame: Float32Array): {
    lpc: LPCResult;
    areas: Float32Array;
    logAreas: Float32Array;
    formants: number[];
  } {
    // LPC解析
    const lpc = LPC.analyze(frame, this.order, this.preEmphasis);
    
    // 声道面積関数の計算
    const areas = LPC.reflectionToArea(lpc.reflectionCoefficients);
    const logAreas = LPC.areaToLogArea(areas);
    
    // フォルマント推定
    const formants = LPC.estimateFormants(lpc.coefficients, this.sampleRate, 5);
    
    return {
      lpc,
      areas,
      logAreas,
      formants
    };
  }

  updateParameters(params: {
    order?: number;
    preEmphasis?: number;
    frameSize?: number;
    sampleRate?: number;
  }) {
    if (params.order !== undefined) this.order = params.order;
    if (params.preEmphasis !== undefined) this.preEmphasis = params.preEmphasis;
    if (params.frameSize !== undefined) this.frameSize = params.frameSize;
    if (params.sampleRate !== undefined) this.sampleRate = params.sampleRate;
  }
}