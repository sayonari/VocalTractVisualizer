import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { AudioManager } from '../audio/AudioManager';
import { AudioBufferProcessor } from '../audio/AudioBuffer';

@customElement('audio-recorder')
export class AudioRecorder extends LitElement {
  @property({ type: Boolean }) recording = false;
  @property({ type: Number }) sampleRate = 44100;
  @state() private audioLevel = 0;
  @state() private error: string | null = null;

  private audioManager: AudioManager | null = null;
  private bufferProcessor: AudioBufferProcessor | null = null;
  private animationFrameId: number | null = null;
  private onDataCallback: ((data: Float32Array) => void) | null = null;

  static styles = css`
    :host {
      display: block;
      padding: 0;
    }

    .recorder-container {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-xs) var(--spacing-sm);
      background: transparent;
      border-radius: var(--radius-md);
    }

    .record-button {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      position: relative;
    }

    .record-button.recording {
      background-color: var(--error-color);
    }

    .record-button:not(.recording) {
      background-color: var(--primary-color);
    }

    .record-icon {
      width: 16px;
      height: 16px;
      background: white;
      border-radius: 50%;
      transition: all 0.3s ease;
    }

    .record-button.recording .record-icon {
      border-radius: 2px;
      width: 12px;
      height: 12px;
    }

    .level-meter {
      flex: 1;
      height: 4px;
      background: var(--border-color);
      border-radius: 2px;
      overflow: hidden;
      position: relative;
      max-width: 150px;
    }

    .level-bar {
      height: 100%;
      background: var(--success-color);
      transition: width 0.1s ease;
      transform-origin: left;
    }

    .status-text {
      font-size: 12px;
      color: var(--text-secondary);
      min-width: 180px;
      white-space: nowrap;
    }

    .error-message {
      color: var(--error-color);
      font-size: 14px;
      margin-top: var(--spacing-sm);
    }

    .pulse-ring {
      position: absolute;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid var(--error-color);
      animation: pulse-ring 1.5s infinite;
      pointer-events: none;
    }

    @keyframes pulse-ring {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      100% {
        transform: scale(1.5);
        opacity: 0;
      }
    }

    .permissions-info {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm);
      background: var(--primary-color);
      color: white;
      border-radius: var(--radius-sm);
      font-size: 14px;
      margin-bottom: var(--spacing-md);
    }

    @media (max-width: 768px) {
      .recorder-container {
        flex-direction: column;
      }

      .level-meter {
        width: 100%;
      }
    }
  `;

  render() {
    return html`
      ${this.error ? html`
        <div class="error-message" role="alert">
          ${this.error}
        </div>
      ` : ''}

      ${!this.recording && !this.audioManager ? html`
        <div class="permissions-info">
          <span>マイクへのアクセスを許可してください</span>
        </div>
      ` : ''}

      <div class="recorder-container">
        <button 
          class="record-button ${this.recording ? 'recording' : ''}"
          @click=${this.toggleRecording}
          aria-label=${this.recording ? '録音停止' : '録音開始'}
          aria-pressed=${this.recording}
        >
          ${this.recording ? html`<div class="pulse-ring"></div>` : ''}
          <div class="record-icon"></div>
        </button>

        <div class="level-meter" role="progressbar" 
             aria-valuenow=${Math.round(this.audioLevel * 100)}
             aria-valuemin="0" 
             aria-valuemax="100">
          <div class="level-bar" style="width: ${this.audioLevel * 100}%"></div>
        </div>

        <div class="status-text">
          ${this.recording ? '← 録音停止ボタン：録音中...' : '← 録音開始ボタン：待機中'}
        </div>
      </div>
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    this.initializeAudio();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanup();
  }

  private async initializeAudio() {
    try {
      this.audioManager = new AudioManager({
        sampleRate: this.sampleRate,
        bufferSize: 2048,
        channelCount: 1
      });

      await this.audioManager.initialize();

      this.bufferProcessor = new AudioBufferProcessor(
        16384, // より小さなバッファサイズ（約0.4秒）
        2048, // フレームサイズ
        512   // ホップサイズ
      );

      let inputLogCount = 0;
      this.audioManager.setProcessorCallback((input, output, sampleRate) => {
        // デバッグ: 入力データの確認（最初の数回のみ）
        const maxValue = Math.max(...input);
        if (maxValue > 0.01 && inputLogCount < 5) {
          console.log('Audio input detected:', maxValue);
          inputLogCount++;
        }
        
        // 入力データをバッファに追加
        this.bufferProcessor?.addAudioData(input);

        // コールバックがある場合はデータを渡す
        if (this.onDataCallback) {
          this.onDataCallback(input);
        }

        // 出力はミュート（エコーを防ぐ）
        output.fill(0);
      });

    } catch (error) {
      this.error = `マイクの初期化に失敗しました: ${error}`;
      console.error('Audio initialization failed:', error);
    }
  }

  private async toggleRecording() {
    if (!this.audioManager) {
      await this.initializeAudio();
    }

    if (this.recording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  private startRecording() {
    if (!this.audioManager) return;

    try {
      this.audioManager.start();
      this.recording = true;
      this.error = null;
      this.startLevelMonitoring();

      this.dispatchEvent(new CustomEvent('recording-start', {
        detail: { sampleRate: this.sampleRate }
      }));
    } catch (error) {
      this.error = `録音の開始に失敗しました: ${error}`;
      console.error('Failed to start recording:', error);
    }
  }

  private stopRecording() {
    if (!this.audioManager) return;

    this.audioManager.stop();
    this.recording = false;
    this.stopLevelMonitoring();

    this.dispatchEvent(new CustomEvent('recording-stop'));
  }

  private startLevelMonitoring() {
    let frameCount = 0;
    const updateLevel = () => {
      if (this.audioManager && this.recording) {
        this.audioLevel = this.audioManager.getAudioLevel();
        
        // デバッグ: 最初の数フレームでレベルをログ
        if (frameCount < 10 && frameCount % 2 === 0) {
          console.log('Audio level:', this.audioLevel.toFixed(4));
          frameCount++;
        }
        
        this.animationFrameId = requestAnimationFrame(updateLevel);
      }
    };
    updateLevel();
  }

  private stopLevelMonitoring() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      this.audioLevel = 0;
    }
  }

  private cleanup() {
    this.stopRecording();
    this.audioManager?.dispose();
    this.audioManager = null;
    this.bufferProcessor?.clear();
    this.bufferProcessor = null;
  }

  // 外部からデータコールバックを設定
  setDataCallback(callback: (data: Float32Array) => void) {
    this.onDataCallback = callback;
  }

  // 音声データの取得
  getAudioFrames(): Float32Array[] {
    return this.bufferProcessor?.getFrames() || [];
  }

  // 周波数データの取得
  getFrequencyData(): Uint8Array | null {
    return this.audioManager?.getFrequencyData() || null;
  }

  // 時間領域データの取得
  getTimeDomainData(): Uint8Array | null {
    return this.audioManager?.getTimeDomainData() || null;
  }

  // AnalyserNodeの取得
  getAnalyserNode(): AnalyserNode | null {
    return this.audioManager?.getAnalyserNode() || null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'audio-recorder': AudioRecorder;
  }
}