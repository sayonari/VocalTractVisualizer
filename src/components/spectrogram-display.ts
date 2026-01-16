import { LitElement, html, css } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { Spectrogram, SpectrogramConfig } from '../visualization/Spectrogram';

@customElement('spectrogram-display')
export class SpectrogramDisplay extends LitElement {
  @property({ type: Number }) width = 800;
  @property({ type: Number }) height = 200;
  @property({ type: String }) colorMap: SpectrogramConfig['colorMap'] = 'hot';
  @property({ type: Number }) dynamicRange = 54;
  @property({ type: Number }) minFrequency = 0;
  @property({ type: Number }) maxFrequency = 8000;

  @state() private isRunning = false;

  @query('canvas') canvas!: HTMLCanvasElement;
  @query('.spectrogram-container') container!: HTMLDivElement;

  private spectrogram: Spectrogram | null = null;
  private animationId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  static styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
    }

    .spectrogram-container {
      background: var(--surface-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      padding: var(--spacing-md);
      position: relative;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
    }

    .canvas-wrapper {
      flex: 1;
      min-height: 0;
      position: relative;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
      background: #000;
      border-radius: var(--radius-sm);
      cursor: crosshair;
    }

    .controls {
      display: flex;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-md);
      flex-wrap: wrap;
    }

    .control-group {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }

    .control-label {
      font-size: 12px;
      color: var(--text-secondary);
      text-transform: uppercase;
    }

    select, input[type="range"] {
      height: 32px;
      padding: 0 var(--spacing-sm);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      background: var(--surface-color);
      font-size: 14px;
    }

    input[type="range"] {
      width: 120px;
    }

    .frequency-info {
      position: absolute;
      bottom: var(--spacing-md);
      right: var(--spacing-md);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: var(--spacing-xs) var(--spacing-sm);
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-family: monospace;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .frequency-info.visible {
      opacity: 1;
    }

    .spectrogram-label {
      position: absolute;
      top: 60px;
      left: 60px;
      font-size: 12px;
      color: var(--text-secondary);
      background: rgba(255, 255, 255, 0.9);
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      z-index: 10;
    }

    .color-map-preview {
      display: flex;
      height: 20px;
      width: 100px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }

    .color-map-preview span {
      flex: 1;
    }

    @media (max-width: 768px) {
      .controls {
        flex-direction: column;
      }
    }
  `;

  render() {
    return html`
      <div class="spectrogram-container">
        <div class="controls">
          <div class="control-group">
            <span class="control-label">ダイナミックレンジ (${this.dynamicRange} dB)</span>
            <input
              type="range"
              min="40"
              max="120"
              .value=${String(this.dynamicRange)}
              @input=${this.handleDynamicRangeChange}
            />
          </div>

          <div class="control-group">
            <span class="control-label">最大周波数 (${this.maxFrequency} Hz)</span>
            <input
              type="range"
              min="2000"
              max="22000"
              step="1000"
              .value=${String(this.maxFrequency)}
              @input=${this.handleMaxFrequencyChange}
            />
          </div>
        </div>

        <div class="canvas-wrapper">
          <canvas
            width=${this.width}
            height=${this.height}
            @mousemove=${this.handleMouseMove}
            @mouseleave=${this.handleMouseLeave}
          ></canvas>

          <div class="spectrogram-label">スペクトログラム</div>

          <div class="frequency-info" id="frequency-info">
            <span id="frequency-value">0 Hz</span> |
            <span id="time-value">0 ms</span>
          </div>
        </div>
      </div>
    `;
  }

  firstUpdated() {
    this.setupSpectrogram();
    this.setupResizeObserver();
  }

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('width') || changedProperties.has('height')) {
      this.spectrogram?.resize(this.width, this.height);
    }
  }

  private setupResizeObserver() {
    const canvasWrapper = this.shadowRoot?.querySelector('.canvas-wrapper');
    if (!canvasWrapper) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this.width = Math.floor(width);
          this.height = Math.floor(height);
          this.spectrogram?.resize(this.width, this.height);
        }
      }
    });
    this.resizeObserver.observe(canvasWrapper);
  }

  private setupSpectrogram() {
    if (!this.canvas) return;

    this.spectrogram = new Spectrogram(this.canvas, {
      colorMap: this.colorMap,
      dynamicRange: this.dynamicRange,
      minFrequency: this.minFrequency,
      maxFrequency: this.maxFrequency,
      sampleRate: 44100
    });
  }

  updateAudioData(audioData: Float32Array) {
    this.spectrogram?.updateAudioData(audioData);
  }

  start() {
    this.isRunning = true;
  }

  stop() {
    this.isRunning = false;
    this.spectrogram?.clear();
  }

  clear() {
    this.spectrogram?.clear();
  }

  private handleColorMapChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    this.colorMap = select.value as SpectrogramConfig['colorMap'];
    this.spectrogram?.updateConfig({ colorMap: this.colorMap });
  }

  private handleDynamicRangeChange(e: Event) {
    const input = e.target as HTMLInputElement;
    this.dynamicRange = Number(input.value);
    this.spectrogram?.updateConfig({ dynamicRange: this.dynamicRange });
  }

  private handleMaxFrequencyChange(e: Event) {
    const input = e.target as HTMLInputElement;
    this.maxFrequency = Number(input.value);
    this.spectrogram?.updateConfig({ maxFrequency: this.maxFrequency });
  }

  private handleMouseMove(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const frequency = this.maxFrequency * (1 - y / this.height);
    const time = (x / this.width) * 2000; // Assuming 2 seconds of data
    
    const freqInfo = this.shadowRoot?.getElementById('frequency-info');
    const freqValue = this.shadowRoot?.getElementById('frequency-value');
    const timeValue = this.shadowRoot?.getElementById('time-value');
    
    if (freqInfo && freqValue && timeValue) {
      freqInfo.classList.add('visible');
      freqValue.textContent = `${Math.round(frequency)} Hz`;
      timeValue.textContent = `${Math.round(time)} ms`;
    }
  }

  private handleMouseLeave() {
    const freqInfo = this.shadowRoot?.getElementById('frequency-info');
    if (freqInfo) {
      freqInfo.classList.remove('visible');
    }
  }

  updateConfig(config: Partial<SpectrogramConfig>) {
    this.spectrogram?.updateConfig(config);
  }

  async saveAsImage(): Promise<Blob | null> {
    return this.spectrogram?.getScreenshot() || null;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'spectrogram-display': SpectrogramDisplay;
  }
}