import { LitElement, html, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

@customElement('waveform-display')
export class WaveformDisplay extends LitElement {
  @property({ type: Number }) width = 400;
  @property({ type: Number }) height = 200;
  @property({ type: String }) strokeColor = '#2196F3';
  @property({ type: Number }) lineWidth = 2;
  @property({ type: Boolean }) showGrid = true;

  @query('canvas') canvas!: HTMLCanvasElement;

  private context: CanvasRenderingContext2D | null = null;
  private animationId: number | null = null;
  private waveformData: Float32Array = new Float32Array(2048);
  private resizeObserver: ResizeObserver | null = null;

  static styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
    }

    .waveform-container {
      background: var(--surface-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      padding: var(--spacing-md);
      position: relative;
      overflow: hidden;
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
      background: #fafafa;
      border-radius: var(--radius-sm);
    }

    .waveform-label {
      position: absolute;
      top: var(--spacing-sm);
      left: var(--spacing-sm);
      font-size: 12px;
      color: var(--text-secondary);
      background: rgba(255, 255, 255, 0.8);
      padding: 2px 6px;
      border-radius: var(--radius-sm);
    }

    .no-data {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: var(--text-secondary);
      font-size: 14px;
    }
  `;

  render() {
    return html`
      <div class="waveform-container">
        <div class="canvas-wrapper">
          <canvas
            width=${this.width}
            height=${this.height}
            role="img"
            aria-label="音声波形"
          ></canvas>
          <div class="waveform-label">波形</div>
        </div>
      </div>
    `;
  }

  firstUpdated() {
    this.setupCanvas();
    this.setupResizeObserver();
  }

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('width') || changedProperties.has('height')) {
      this.setupCanvas();
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
          this.setupCanvas();
        }
      }
    });
    this.resizeObserver.observe(canvasWrapper);
  }

  private setupCanvas() {
    if (!this.canvas) return;

    this.context = this.canvas.getContext('2d');
    if (!this.context) return;

    // デバイスピクセル比に対応
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.context.scale(dpr, dpr);

    this.drawBackground();
  }

  private drawBackground() {
    if (!this.context) return;

    this.context.clearRect(0, 0, this.width, this.height);

    if (this.showGrid) {
      this.drawGrid();
    }

    // 中心線
    this.context.strokeStyle = '#e0e0e0';
    this.context.lineWidth = 1;
    this.context.beginPath();
    this.context.moveTo(0, this.height / 2);
    this.context.lineTo(this.width, this.height / 2);
    this.context.stroke();
  }

  private drawGrid() {
    if (!this.context) return;

    this.context.strokeStyle = '#f0f0f0';
    this.context.lineWidth = 0.5;

    // 垂直グリッド線
    const verticalSpacing = 50;
    for (let x = 0; x < this.width; x += verticalSpacing) {
      this.context.beginPath();
      this.context.moveTo(x, 0);
      this.context.lineTo(x, this.height);
      this.context.stroke();
    }

    // 水平グリッド線
    const horizontalSpacing = this.height / 4;
    for (let y = horizontalSpacing; y < this.height; y += horizontalSpacing) {
      this.context.beginPath();
      this.context.moveTo(0, y);
      this.context.lineTo(this.width, y);
      this.context.stroke();
    }
  }

  updateWaveform(data: Float32Array | Uint8Array) {
    if (data instanceof Uint8Array) {
      // Uint8Arrayの場合は正規化
      this.waveformData = new Float32Array(data.length);
      for (let i = 0; i < data.length; i++) {
        this.waveformData[i] = (data[i] - 128) / 128;
      }
    } else {
      this.waveformData = data;
    }

    this.drawWaveform();
  }

  private drawWaveform() {
    if (!this.context) return;

    this.drawBackground();

    this.context.strokeStyle = this.strokeColor;
    this.context.lineWidth = this.lineWidth;
    this.context.beginPath();

    const sliceWidth = this.width / this.waveformData.length;
    let x = 0;

    // 最大値を計算して自動ゲイン調整
    const maxValue = Math.max(...this.waveformData.map(Math.abs));
    let amplification = 1.0;
    
    if (maxValue > 0) {
      // 最大値が画面の80%に収まるように調整
      amplification = 0.8 / maxValue;
      // 増幅率を制限（最小1倍、最大20倍）
      amplification = Math.max(1.0, Math.min(20.0, amplification));
    }

    for (let i = 0; i < this.waveformData.length; i++) {
      const v = Math.max(-1, Math.min(1, this.waveformData[i] * amplification));
      const y = (v + 1) * this.height / 2;

      if (i === 0) {
        this.context.moveTo(x, y);
      } else {
        this.context.lineTo(x, y);
      }

      x += sliceWidth;
    }

    this.context.stroke();
  }

  // アニメーション付き更新
  animateWaveform(getDataCallback: () => Float32Array | Uint8Array | null) {
    let frameCount = 0;
    const animate = () => {
      const data = getDataCallback();
      if (data) {
        // デバッグ: 最初の数フレームでデータをログ
        if (frameCount < 5) {
          const maxValue = data instanceof Uint8Array 
            ? Math.max(...data) / 255 
            : Math.max(...Array.from(data).map(Math.abs));
          console.log('WaveformDisplay: received data', {
            frame: frameCount,
            dataLength: data.length,
            maxValue,
            dataType: data.constructor.name
          });
          frameCount++;
        }
        this.updateWaveform(data);
      }
      this.animationId = requestAnimationFrame(animate);
    };

    animate();
  }

  stopAnimation() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  clear() {
    this.waveformData.fill(0);
    this.drawBackground();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopAnimation();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  // スクリーンショット機能
  async saveAsImage(): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'waveform-display': WaveformDisplay;
  }
}