import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { observable, makeObservable, action } from 'mobx';
import './audio-recorder';
import './waveform-display';
import './control-panel';
import './info-panel';
import './layout-grid';
import './spectrogram-display';
import './vocal-tract-3d';
import './resizable-splitter';
import type { AudioRecorder } from './audio-recorder';
import type { WaveformDisplay } from './waveform-display';
import type { ControlPanel, ControlSettings } from './control-panel';
import type { InfoPanel, AnalysisInfo } from './info-panel';
import type { SpectrogramDisplay } from './spectrogram-display';
import type { VocalTract3DComponent } from './vocal-tract-3d';
import { FeatureExtractor } from '../audio/FeatureExtractor';
import { AudioBufferProcessor } from '../audio/AudioBuffer';

interface AppState {
  isRecording: boolean;
  selectedView: 'realtime' | 'synthesis' | 'spectrogram';
  sampleRate: number;
  error: string | null;
}

@customElement('vocal-tract-app')
export class VocalTractApp extends LitElement {
  @state() private appState: AppState = {
    isRecording: false,
    selectedView: 'realtime',
    sampleRate: 44100,
    error: null
  };

  @query('audio-recorder') audioRecorder!: AudioRecorder;
  @query('waveform-display') waveformDisplay!: WaveformDisplay;
  @query('control-panel') controlPanel!: ControlPanel;
  @query('info-panel') infoPanel!: InfoPanel;
  @query('spectrogram-display') spectrogramDisplay!: SpectrogramDisplay;
  @query('vocal-tract-3d') vocalTract3D!: VocalTract3DComponent;

  private featureExtractor: FeatureExtractor | null = null;
  private audioProcessor: AudioBufferProcessor | null = null;
  private analysisIntervalId: number | null = null;
  private analysisLogCount = 0;

  constructor() {
    super();
    makeObservable(this.appState, {
      isRecording: observable,
      selectedView: observable,
      sampleRate: observable,
      error: observable
    });
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100vh;
    }

    .app-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    header {
      background-color: var(--surface-color);
      box-shadow: var(--shadow-sm);
      padding: var(--spacing-xs) var(--spacing-md);
      z-index: 10;
      flex-shrink: 0;
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
    }

    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
      color: var(--text-primary);
    }

    main {
      flex: 1;
      overflow: hidden;
      position: relative;
      background-color: var(--background-color);
    }

    .content-area {
      height: 100%;
      padding: var(--spacing-sm);
    }

    .error-banner {
      background-color: var(--error-color);
      color: white;
      padding: var(--spacing-sm) var(--spacing-md);
      text-align: center;
      font-size: 14px;
    }

    /* Splitter layout */
    resizable-splitter {
      height: 100%;
    }

    .sidebar-panel {
      height: 100%;
      overflow-y: auto;
      padding: var(--spacing-sm);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }

    .main-panel {
      height: 100%;
      padding: var(--spacing-sm);
    }

    .visualization-panel {
      width: 100%;
      height: 100%;
    }

    .spectrogram-panel {
      width: 100%;
      height: 100%;
    }

    waveform-display,
    vocal-tract-3d,
    spectrogram-display {
      width: 100%;
      height: 100%;
    }

    control-panel,
    info-panel {
      flex-shrink: 0;
    }

    /* Reset button */
    .reset-layout-btn {
      position: fixed;
      bottom: var(--spacing-md);
      right: var(--spacing-md);
      padding: var(--spacing-xs) var(--spacing-sm);
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      font-size: 12px;
      color: var(--text-secondary);
      cursor: pointer;
      z-index: 1000;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .reset-layout-btn:hover {
      opacity: 1;
      background: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }
  `;

  render() {
    return html`
      <div class="app-container">
        ${this.appState.error ? html`
          <div class="error-banner" role="alert">
            ${this.appState.error}
          </div>
        ` : ''}
        
        <header>
          <div class="header-content">
            <h1>Vocal Tract Visualizer</h1>
            <audio-recorder
              .sampleRate=${this.appState.sampleRate}
              @recording-start=${this.handleRecordingStart}
              @recording-stop=${this.handleRecordingStop}
              style="margin: 0;"
            ></audio-recorder>
          </div>
        </header>

        <main>
          <div class="content-area" role="tabpanel">
            ${this.renderContent()}
          </div>
        </main>
      </div>
    `;
  }

  private renderContent() {
    return html`
      <!-- Main horizontal splitter: Sidebar | Main content -->
      <resizable-splitter
        direction="horizontal"
        storageKey="main-sidebar"
        .defaultRatio=${0.22}
        .minSize=${180}
        @splitter-resize=${this.handleSplitterResize}
      >
        <!-- Sidebar -->
        <div slot="first" class="sidebar-panel">
          <control-panel
            @settings-changed=${this.handleSettingsChanged}
          ></control-panel>
          <info-panel></info-panel>
        </div>

        <!-- Main content area -->
        <div slot="second" class="main-panel">
          <!-- Vertical splitter: Visualization | Spectrogram -->
          <resizable-splitter
            direction="vertical"
            storageKey="main-vertical"
            .defaultRatio=${0.65}
            .minSize=${100}
            @splitter-resize=${this.handleSplitterResize}
          >
            <!-- Upper: Waveform and 3D model -->
            <div slot="first" class="visualization-panel">
              <!-- Horizontal splitter: Waveform | 3D Vocal Tract -->
              <resizable-splitter
                direction="horizontal"
                storageKey="visualization"
                .defaultRatio=${0.4}
                .minSize=${150}
                @splitter-resize=${this.handleSplitterResize}
              >
                <waveform-display slot="first"></waveform-display>
                <vocal-tract-3d slot="second"></vocal-tract-3d>
              </resizable-splitter>
            </div>

            <!-- Lower: Spectrogram -->
            <div slot="second" class="spectrogram-panel">
              <spectrogram-display></spectrogram-display>
            </div>
          </resizable-splitter>
        </div>
      </resizable-splitter>

      <button class="reset-layout-btn" @click=${this.resetLayout}>
        レイアウトをリセット
      </button>
    `;
  }

  private handleSplitterResize() {
    // Trigger resize events for child components
    window.dispatchEvent(new Event('resize'));
  }

  private resetLayout() {
    // Clear all saved splitter positions
    localStorage.removeItem('splitter-main-sidebar');
    localStorage.removeItem('splitter-main-vertical');
    localStorage.removeItem('splitter-visualization');
    // Reload the page to apply default layout
    window.location.reload();
  }

  @action
  private selectView(view: 'realtime' | 'synthesis' | 'spectrogram') {
    this.appState.selectedView = view;
    this.requestUpdate();
  }

  @action
  private setError(error: string | null) {
    this.appState.error = error;
    this.requestUpdate();
    
    if (error) {
      setTimeout(() => {
        this.setError(null);
      }, 5000);
    }
  }

  firstUpdated() {
    // 少し遅延させて、全てのコンポーネントが確実に初期化されるようにする
    setTimeout(() => {
      console.log('VocalTractApp firstUpdated - initializing components');
      console.log('Components available:', {
        audioRecorder: !!this.audioRecorder,
        waveformDisplay: !!this.waveformDisplay,
        infoPanel: !!this.infoPanel,
        vocalTract3D: !!this.vocalTract3D
      });
      
      this.setupAudioProcessing();
      this.initializeAnalysis();
    }, 100);
  }

  connectedCallback() {
    super.connectedCallback();
    console.log('Vocal Tract App component mounted');
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    console.log('Vocal Tract App component unmounted');
    this.waveformDisplay?.stopAnimation();
    this.stopAnalysis();
  }

  private setupAudioProcessing() {
    console.log('setupAudioProcessing called', {
      selectedView: this.appState.selectedView,
      audioRecorder: !!this.audioRecorder,
      waveformDisplay: !!this.waveformDisplay,
      spectrogramDisplay: !!this.spectrogramDisplay
    });
    
    if (this.appState.selectedView === 'realtime' && this.audioRecorder && this.waveformDisplay) {
      // 波形表示のアニメーションを設定
      this.waveformDisplay.animateWaveform(() => {
        if (this.appState.isRecording) {
          // AudioRecorderから直接音声データを取得
          const frames = this.audioRecorder.getAudioFrames();
          if (frames.length > 0) {
            // 最新のフレームを返す
            return frames[frames.length - 1];
          }
        }
        return null;
      });

      // 音声データのコールバックを設定
      let dataCallbackCount = 0;
      this.audioRecorder.setDataCallback((data) => {
        // デバッグ: 最初の数回だけログ
        if (dataCallbackCount < 3) {
          console.log('Audio data received in app:', data.length, 'max:', Math.max(...data));
          dataCallbackCount++;
        }
        
        // スペクトログラムの更新
        if (this.spectrogramDisplay && this.appState.isRecording) {
          this.spectrogramDisplay.updateAudioData(data);
        }
      });
    }
  }

  private handleRecordingStart(event: CustomEvent) {
    this.appState.isRecording = true;
    console.log('Recording started:', event.detail);
    this.setupAudioProcessing();
    this.startAnalysis();
  }

  private handleRecordingStop() {
    this.appState.isRecording = false;
    console.log('Recording stopped');
    this.waveformDisplay?.clear();
    this.spectrogramDisplay?.clear();
    this.stopAnalysis();
  }

  private handleSettingsChanged(event: CustomEvent<ControlSettings>) {
    console.log('Settings changed:', event.detail);
    // 設定変更に応じた処理
    const settings = event.detail;
    
    if (this.featureExtractor) {
      this.featureExtractor.updateParameters({
        frameSize: settings.windowSize,
        lpcOrder: settings.lpcOrder
      });
    }
    
    if (this.audioProcessor) {
      this.audioProcessor = new AudioBufferProcessor(
        16384, // より小さなバッファサイズ（約0.4秒）
        settings.windowSize,
        settings.hopSize
      );
    }
  }

  private initializeAnalysis() {
    // 特徴抽出器の初期化
    this.featureExtractor = new FeatureExtractor(
      this.appState.sampleRate,
      2048,
      14
    );
    
    // 音声バッファプロセッサの初期化
    this.audioProcessor = new AudioBufferProcessor(
      16384, // より小さなバッファサイズ（約0.4秒）
      2048,
      512
    );
  }

  private startAnalysis() {
    if (!this.audioRecorder || !this.featureExtractor || !this.audioProcessor) {
      console.log('Analysis components not ready');
      return;
    }
    
    console.log('Starting audio analysis...');
    
    // 定期的に音声解析を実行
    this.analysisIntervalId = window.setInterval(() => {
      const frames = this.audioRecorder.getAudioFrames();
      
      if (frames.length > 0) {
        // 最新のフレームを解析
        const latestFrame = frames[frames.length - 1];
        
        // 十分な音声レベルがある場合のみ解析
        const maxValue = Math.max(...latestFrame.map(Math.abs));
        if (maxValue > 0.01) {
          try {
            const features = this.featureExtractor!.extractFeatures(latestFrame);
            
            // 解析結果を情報パネルに反映
            if (this.infoPanel) {
              const analysisInfo: AnalysisInfo = {
                fundamentalFrequency: features.fundamentalFrequency,
                formants: features.formants,
                intensity: features.intensity,
                spectralCentroid: features.spectralCentroid,
                voiceQuality: features.voiceQuality
              };
              this.infoPanel.updateAnalysisInfo(analysisInfo);
            }
            
            // 3D声道モデルの更新（すべての音声で更新）
            if (this.vocalTract3D && 
                features.vocalTractAreas && 
                features.vocalTractAreas.length > 0) {
              // 最初の数回だけ詳細ログ
              if (this.analysisLogCount < 3) {
                console.log('Updating 3D vocal tract with areas:', {
                  length: features.vocalTractAreas.length,
                  values: Array.from(features.vocalTractAreas).map(v => v.toFixed(3)),
                  formants: features.formants.map(f => f.toFixed(1)),
                  voiceQuality: features.voiceQuality,
                  intensity: features.intensity
                });
                this.analysisLogCount++;
              }
              this.vocalTract3D.updateVocalTract(features.vocalTractAreas);
            }
          } catch (error) {
            console.error('Analysis error:', error);
          }
        }
      }
    }, 100); // 10Hz (100ms間隔)で更新
  }

  private stopAnalysis() {
    if (this.analysisIntervalId !== null) {
      clearInterval(this.analysisIntervalId);
      this.analysisIntervalId = null;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vocal-tract-app': VocalTractApp;
  }
}