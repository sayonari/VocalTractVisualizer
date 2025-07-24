export class CircularBuffer {
  private buffer: Float32Array | null = null;
  private writeIndex: number = 0;
  private readIndex: number = 0;
  private size: number = 0; // 初期化を追加
  private filled: boolean = false;

  constructor(size: number) {
    // より小さな初期サイズから開始
    const sizes = [size, 8192, 4096, 2048, 1024, 512];
    
    for (const trySize of sizes) {
      if (trySize > size) continue;
      
      try {
        this.buffer = new Float32Array(trySize);
        this.size = trySize;
        console.log(`CircularBuffer allocated with size: ${trySize}`);
        break;
      } catch (error) {
        console.warn(`Failed to allocate ${trySize} samples, trying smaller...`);
      }
    }
    
    // それでも失敗した場合は、最小限の配列を作成
    if (!this.buffer) {
      this.size = 256;
      this.buffer = new Float32Array(this.size);
      console.warn(`Using minimum buffer size: ${this.size}`);
    }
  }

  write(data: Float32Array): void {
    if (!this.buffer) return;
    
    for (let i = 0; i < data.length; i++) {
      this.buffer[this.writeIndex] = data[i];
      this.writeIndex = (this.writeIndex + 1) % this.size;
      
      if (this.writeIndex === this.readIndex) {
        this.filled = true;
        this.readIndex = (this.readIndex + 1) % this.size;
      }
    }
  }

  read(length: number): Float32Array {
    const result = new Float32Array(length);
    if (!this.buffer) return result;
    
    for (let i = 0; i < length; i++) {
      if (!this.filled && this.readIndex === this.writeIndex) {
        // バッファが空の場合は0で埋める
        result[i] = 0;
      } else {
        result[i] = this.buffer[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.size;
        
        if (this.readIndex === this.writeIndex) {
          this.filled = false;
        }
      }
    }
    
    return result;
  }

  // 最新のデータを取得（読み取り位置を変更しない）
  peek(length: number, offset: number = 0): Float32Array {
    const result = new Float32Array(length);
    if (!this.buffer) return result;
    
    let peekIndex = (this.writeIndex - length - offset + this.size) % this.size;
    
    for (let i = 0; i < length; i++) {
      result[i] = this.buffer[peekIndex];
      peekIndex = (peekIndex + 1) % this.size;
    }
    
    return result;
  }

  clear(): void {
    if (this.buffer) {
      this.buffer.fill(0);
    }
    this.writeIndex = 0;
    this.readIndex = 0;
    this.filled = false;
  }

  getAvailableData(): number {
    if (this.filled) {
      return this.size;
    }
    
    if (this.writeIndex >= this.readIndex) {
      return this.writeIndex - this.readIndex;
    } else {
      return this.size - this.readIndex + this.writeIndex;
    }
  }

  isFull(): boolean {
    return this.filled;
  }
}

export class AudioBufferProcessor {
  private inputBuffer: CircularBuffer;
  private frameSize: number;
  private hopSize: number;
  private windowFunction: Float32Array;
  private overlapBuffer: Float32Array;

  constructor(bufferSize: number, frameSize: number, hopSize: number) {
    // パラメータの検証
    const validBufferSize = Math.max(2048, Math.min(bufferSize, 65536));
    const validFrameSize = Math.max(256, Math.min(frameSize, 4096));
    const validHopSize = Math.max(128, Math.min(hopSize, validFrameSize));
    
    this.inputBuffer = new CircularBuffer(validBufferSize);
    this.frameSize = validFrameSize;
    this.hopSize = validHopSize;
    this.windowFunction = this.createWindow(validFrameSize);
    this.overlapBuffer = new Float32Array(validFrameSize);
  }

  // Blackman窓関数の生成
  private createWindow(size: number): Float32Array {
    const window = new Float32Array(size);
    const a0 = 0.42;
    const a1 = 0.5;
    const a2 = 0.08;
    
    for (let i = 0; i < size; i++) {
      const x = (2 * Math.PI * i) / (size - 1);
      window[i] = a0 - a1 * Math.cos(x) + a2 * Math.cos(2 * x);
    }
    
    return window;
  }

  // Hamming窓関数
  createHammingWindow(size: number): Float32Array {
    const window = new Float32Array(size);
    
    for (let i = 0; i < size; i++) {
      window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (size - 1));
    }
    
    return window;
  }

  // Hann窓関数
  createHannWindow(size: number): Float32Array {
    const window = new Float32Array(size);
    
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    }
    
    return window;
  }

  // 音声データの追加
  addAudioData(data: Float32Array): void {
    this.inputBuffer.write(data);
  }

  // フレーム単位でのデータ取得（オーバーラップあり）
  getFrames(): Float32Array[] {
    const frames: Float32Array[] = [];
    const availableData = this.inputBuffer.getAvailableData();
    
    // 単純に最新のデータを返す（波形表示用）
    if (availableData >= this.frameSize) {
      const frame = this.inputBuffer.peek(this.frameSize);
      frames.push(new Float32Array(frame));
    }
    
    return frames;
  }
  
  // 解析用のウィンドウ処理されたフレームを取得
  getWindowedFrames(): Float32Array[] {
    const frames: Float32Array[] = [];
    const availableData = this.inputBuffer.getAvailableData();
    
    while (availableData >= this.frameSize) {
      const frame = this.inputBuffer.peek(this.frameSize);
      const windowedFrame = new Float32Array(this.frameSize);
      
      // 窓関数の適用
      for (let i = 0; i < this.frameSize; i++) {
        windowedFrame[i] = frame[i] * this.windowFunction[i];
      }
      
      frames.push(windowedFrame);
      
      // ホップサイズ分だけ進める
      this.inputBuffer.read(this.hopSize);
    }
    
    return frames;
  }

  // プリエンファシスフィルタ
  applyPreemphasis(data: Float32Array, alpha: number = 0.97): Float32Array {
    const output = new Float32Array(data.length);
    output[0] = data[0];
    
    for (let i = 1; i < data.length; i++) {
      output[i] = data[i] - alpha * data[i - 1];
    }
    
    return output;
  }

  // サンプルレート変換（簡易版）
  resample(data: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) {
      return data;
    }
    
    const ratio = toRate / fromRate;
    const newLength = Math.floor(data.length * ratio);
    const output = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i / ratio;
      const srcIndexInt = Math.floor(srcIndex);
      const fraction = srcIndex - srcIndexInt;
      
      if (srcIndexInt < data.length - 1) {
        // 線形補間
        output[i] = data[srcIndexInt] * (1 - fraction) + 
                   data[srcIndexInt + 1] * fraction;
      } else {
        output[i] = data[data.length - 1];
      }
    }
    
    return output;
  }

  clear(): void {
    this.inputBuffer.clear();
    this.overlapBuffer.fill(0);
  }
}