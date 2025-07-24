import { STFT } from '../utils/fft';

export interface SpectrogramConfig {
  windowSize: number;
  hopSize: number;
  sampleRate: number;
  minFrequency: number;
  maxFrequency: number;
  dynamicRange: number;
  colorMap: 'viridis' | 'plasma' | 'hot' | 'cool' | 'gray';
}

export class Spectrogram {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private config: SpectrogramConfig;
  private stft: STFT;
  private spectrogramData: Float32Array[] = [];
  private maxFrames: number;
  private imageData: ImageData;
  private colorMapCache: Uint8ClampedArray;

  constructor(
    canvas: HTMLCanvasElement,
    config: Partial<SpectrogramConfig> = {}
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.context = ctx;

    this.config = {
      windowSize: 2048,
      hopSize: 512,
      sampleRate: 44100,
      minFrequency: 0,
      maxFrequency: 8000,
      dynamicRange: 54,    // デフォルトを54dBに
      colorMap: 'hot',      // デフォルトをhotに
      ...config
    };

    this.stft = new STFT(
      this.config.windowSize,
      this.config.hopSize,
      'hamming'
    );

    this.maxFrames = Math.floor(this.canvas.width);
    
    // ImageDataの初期化
    try {
      this.imageData = this.context.createImageData(this.canvas.width, this.canvas.height);
    } catch (error) {
      console.error('Failed to create initial ImageData:', error);
      // デフォルトの小さなサイズで作成
      this.imageData = this.context.createImageData(1, 1);
    }
    
    this.colorMapCache = this.createColorMap(this.config.colorMap);
    
    this.clear();
  }

  /**
   * カラーマップの作成
   */
  private createColorMap(type: string): Uint8ClampedArray {
    const size = 256;
    const colorMap = new Uint8ClampedArray(size * 4);

    for (let i = 0; i < size; i++) {
      const value = i / 255;
      let r = 0, g = 0, b = 0;

      switch (type) {
        case 'viridis':
          r = Math.floor(255 * (0.267 + 0.004 * i - 0.329 * value * value + 0.449 * value * value * value));
          g = Math.floor(255 * (0.328 + 1.784 * value - 0.852 * value * value));
          b = Math.floor(255 * (0.335 + 0.484 * value - 2.019 * value * value + 2.568 * value * value * value));
          break;
        
        case 'plasma':
          r = Math.floor(255 * (0.050 + 2.215 * value - 1.663 * value * value));
          g = Math.floor(255 * (0.029 + 0.253 * value + 0.612 * value * value));
          b = Math.floor(255 * (0.528 + 1.098 * value - 1.035 * value * value));
          break;
        
        case 'hot':
          r = Math.floor(255 * Math.min(1, value * 2.5));
          g = Math.floor(255 * Math.max(0, Math.min(1, (value - 0.4) * 2.5)));
          b = Math.floor(255 * Math.max(0, (value - 0.8) * 5));
          break;
        
        case 'cool':
          r = Math.floor(255 * value);
          g = Math.floor(255 * (1 - value));
          b = Math.floor(255);
          break;
        
        case 'gray':
        default:
          r = g = b = Math.floor(255 * value);
          break;
      }

      colorMap[i * 4] = Math.max(0, Math.min(255, r));
      colorMap[i * 4 + 1] = Math.max(0, Math.min(255, g));
      colorMap[i * 4 + 2] = Math.max(0, Math.min(255, b));
      colorMap[i * 4 + 3] = 255;
    }

    return colorMap;
  }

  /**
   * 周波数からピクセル位置への変換
   */
  private frequencyToPixel(frequency: number): number {
    const nyquist = this.config.sampleRate / 2;
    const minFreq = Math.max(0, this.config.minFrequency);
    const maxFreq = Math.min(nyquist, this.config.maxFrequency);
    
    if (frequency <= minFreq) return this.canvas.height - 1;
    if (frequency >= maxFreq) return 0;
    
    const ratio = (frequency - minFreq) / (maxFreq - minFreq);
    return Math.floor((1 - ratio) * (this.canvas.height - 1));
  }

  /**
   * 音声データの更新
   */
  updateAudioData(audioData: Float32Array): void {
    // STFTの計算
    const powerSpec = this.stft.powerSpectrogramdB(audioData);
    
    if (powerSpec.length === 0) return;

    // 最新のフレームを追加
    for (const frame of powerSpec) {
      this.spectrogramData.push(frame);
      if (this.spectrogramData.length > this.maxFrames) {
        this.spectrogramData.shift();
      }
    }

    this.render();
  }

  /**
   * スペクトログラムの描画
   */
  private render(): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const freqBins = this.spectrogramData[0]?.length || 0;
    
    if (freqBins === 0) return;

    // 画像データの更新
    for (let x = 0; x < width; x++) {
      const frameIndex = Math.floor(x * this.spectrogramData.length / width);
      if (frameIndex >= this.spectrogramData.length) continue;
      
      const frame = this.spectrogramData[frameIndex];
      const binHeight = this.config.sampleRate / (2 * freqBins);
      
      for (let y = 0; y < height; y++) {
        const pixelFreq = this.config.minFrequency + 
          (1 - y / height) * (this.config.maxFrequency - this.config.minFrequency);
        const binIndex = Math.floor(pixelFreq / binHeight);
        
        if (binIndex >= 0 && binIndex < frame.length) {
          const value = frame[binIndex];
          const normalized = Math.max(0, Math.min(1, 
            (value + this.config.dynamicRange) / this.config.dynamicRange));
          const colorIndex = Math.floor(normalized * 255);
          
          const pixelIndex = (y * width + x) * 4;
          this.imageData.data[pixelIndex] = this.colorMapCache[colorIndex * 4];
          this.imageData.data[pixelIndex + 1] = this.colorMapCache[colorIndex * 4 + 1];
          this.imageData.data[pixelIndex + 2] = this.colorMapCache[colorIndex * 4 + 2];
          this.imageData.data[pixelIndex + 3] = 255;
        }
      }
    }

    this.context.putImageData(this.imageData, 0, 0);
    this.drawFrequencyScale();
  }

  /**
   * 周波数スケールの描画
   */
  private drawFrequencyScale(): void {
    const ctx = this.context;
    ctx.save();

    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 50, this.canvas.height);

    // スケール
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';

    const freqSteps = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000];
    for (const freq of freqSteps) {
      if (freq >= this.config.minFrequency && freq <= this.config.maxFrequency) {
        const y = this.frequencyToPixel(freq);
        
        ctx.beginPath();
        ctx.moveTo(45, y);
        ctx.lineTo(50, y);
        ctx.stroke();
        
        ctx.fillText(`${freq / 1000}k`, 40, y + 3);
      }
    }

    ctx.restore();
  }

  /**
   * キャンバスのクリア
   */
  clear(): void {
    this.spectrogramData = [];
    this.context.fillStyle = '#000000';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawFrequencyScale();
  }

  /**
   * 設定の更新
   */
  updateConfig(config: Partial<SpectrogramConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.windowSize || config.hopSize) {
      this.stft = new STFT(
        this.config.windowSize,
        this.config.hopSize,
        'hamming'
      );
    }
    
    if (config.colorMap) {
      this.colorMapCache = this.createColorMap(config.colorMap);
    }
    
    this.render();
  }

  /**
   * キャンバスサイズの更新
   */
  resize(width: number, height: number): void {
    try {
      // サイズを制限
      const maxWidth = 1024;
      const maxHeight = 512;
      width = Math.min(width, maxWidth);
      height = Math.min(height, maxHeight);
      
      this.canvas.width = width;
      this.canvas.height = height;
      this.maxFrames = Math.floor(width);
      
      // ImageDataの作成を試みる
      try {
        this.imageData = this.context.createImageData(width, height);
      } catch (error) {
        console.error('Failed to create ImageData, using smaller size:', error);
        // さらに小さいサイズで再試行
        width = Math.min(width, 400);
        height = Math.min(height, 200);
        this.canvas.width = width;
        this.canvas.height = height;
        this.imageData = this.context.createImageData(width, height);
      }
      
      this.render();
    } catch (error) {
      console.error('Spectrogram resize failed:', error);
    }
  }

  /**
   * スクリーンショットの取得
   */
  async getScreenshot(): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.canvas.toBlob(
        (blob) => resolve(blob),
        'image/png'
      );
    });
  }
}