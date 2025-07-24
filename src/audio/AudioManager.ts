export interface AudioConfig {
  sampleRate: number;
  bufferSize: number;
  channelCount: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface AudioProcessorCallback {
  (inputBuffer: Float32Array, outputBuffer: Float32Array, sampleRate: number): void;
}

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private isInitialized = false;
  private processorCallback: AudioProcessorCallback | null = null;
  private logCount = 0;
  
  private config: AudioConfig = {
    sampleRate: 44100,
    bufferSize: 2048,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  };

  constructor(config?: Partial<AudioConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('AudioManager is already initialized');
      return;
    }

    try {
      // AudioContextの作成
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API is not supported');
      }

      this.audioContext = new AudioContextClass({
        sampleRate: this.config.sampleRate
      });

      // マイクアクセスの要求
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: this.config.channelCount },
          echoCancellation: false,  // エコーキャンセレーションを無効化
          noiseSuppression: false,  // ノイズ抑制を無効化
          autoGainControl: false,   // 自動ゲイン制御を無効化
          sampleRate: { ideal: this.config.sampleRate }
        },
        video: false
      });
      
      console.log('MediaStream tracks:', this.mediaStream.getTracks().map(track => ({
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState
      })));

      // ノードの作成と接続
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // ScriptProcessorNode (deprecated but still widely supported)
      this.scriptProcessor = this.audioContext.createScriptProcessor(
        this.config.bufferSize,
        this.config.channelCount,
        this.config.channelCount
      );

      // AnalyserNode for frequency analysis
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // ノードの接続
      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.scriptProcessor);
      
      // 音声処理のイベントハンドラ
      this.scriptProcessor.onaudioprocess = (event) => {
        if (this.processorCallback) {
          const inputData = event.inputBuffer.getChannelData(0);
          const outputData = event.outputBuffer.getChannelData(0);
          
          // デバッグ: 音声データの詳細ログ（最初の数回のみ）
          if (this.logCount < 5) {
            const maxValue = Math.max(...inputData);
            const avgValue = inputData.reduce((sum, val) => sum + Math.abs(val), 0) / inputData.length;
            if (maxValue > 0.001) {
              console.log('AudioManager: Audio data received', {
                maxValue,
                avgValue,
                bufferLength: inputData.length
              });
              this.logCount++;
            }
          }
          
          this.processorCallback(inputData, outputData, this.audioContext!.sampleRate);
        }
      };

      this.isInitialized = true;
      console.log('AudioManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AudioManager:', error);
      throw error;
    }
  }

  setProcessorCallback(callback: AudioProcessorCallback): void {
    this.processorCallback = callback;
  }

  start(): void {
    if (!this.isInitialized) {
      throw new Error('AudioManager is not initialized');
    }

    if (this.scriptProcessor && this.audioContext) {
      this.scriptProcessor.connect(this.audioContext.destination);
      console.log('AudioManager started, context state:', this.audioContext.state);
      
      // AudioContextがsuspended状態の場合、resumeする
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('AudioContext resumed');
        });
      }
    }
  }

  stop(): void {
    if (this.scriptProcessor && this.audioContext) {
      this.scriptProcessor.disconnect();
    }
  }

  getFrequencyData(): Uint8Array | null {
    if (!this.analyserNode) return null;

    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyserNode.getByteFrequencyData(dataArray);
    return dataArray;
  }

  getTimeDomainData(): Uint8Array | null {
    if (!this.analyserNode) return null;

    const bufferLength = this.analyserNode.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    this.analyserNode.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  getSampleRate(): number {
    return this.audioContext?.sampleRate || this.config.sampleRate;
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  async dispose(): Promise<void> {
    this.stop();

    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.isInitialized = false;
    this.processorCallback = null;
  }

  // 音声レベルの取得（0-1の範囲）
  getAudioLevel(): number {
    if (!this.analyserNode) return 0;

    // 周波数データから音声レベルを計算
    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyserNode.getByteFrequencyData(dataArray);
    
    // 平均値を計算
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    
    // 0-1の範囲に正規化
    return (sum / bufferLength) / 255;
  }

  // AudioWorklet対応（将来的な実装のため）
  async initializeWithWorklet(): Promise<void> {
    if (!this.audioContext || !this.audioContext.audioWorklet) {
      throw new Error('AudioWorklet is not supported');
    }

    // AudioWorkletの実装は別途必要
    console.warn('AudioWorklet implementation is not yet available');
  }
}