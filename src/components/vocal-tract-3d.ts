import { LitElement, html, css } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { VocalTract3D, VocalTract3DConfig } from '../visualization/VocalTract3D';

@customElement('vocal-tract-3d')
export class VocalTract3DComponent extends LitElement {
  @property({ type: Number }) width = 400;
  @property({ type: Number }) height = 200;
  @property({ type: Boolean }) wireframe = true;  // デフォルトをワイヤーフレームに
  @property({ type: String }) color = '#ff6b6b';
  @property({ type: Number }) opacity = 0.9;
  
  @state() private autoRotate = false;
  
  @query('.three-container') container!: HTMLDivElement;
  
  private vocalTract3D: VocalTract3D | null = null;
  private areas: Float32Array = new Float32Array(15).fill(1.0);

  static styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
    }

    .vocal-tract-container {
      background: var(--surface-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      padding: var(--spacing-md);
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
    }

    .three-container {
      flex: 1;
      position: relative;
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: #f5f5f5;
      min-height: 0;
      width: 100%;
      box-sizing: border-box;
    }

    .info-panel {
      position: absolute;
      top: var(--spacing-md);
      left: var(--spacing-md);
      background: rgba(255, 255, 255, 0.9);
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--radius-sm);
      font-size: 12px;
      color: var(--text-secondary);
      pointer-events: none;
    }

    .legend {
      position: absolute;
      bottom: var(--spacing-md);
      left: var(--spacing-md);
      display: flex;
      gap: var(--spacing-md);
      font-size: 12px;
      color: var(--text-secondary);
      background: rgba(255, 255, 255, 0.9);
      padding: var(--spacing-xs) var(--spacing-sm);
      border-radius: var(--radius-sm);
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
    }

    .legend-color {
      width: 60px;
      height: 4px;
      border-radius: 2px;
    }

    @media (max-width: 768px) {
      .controls {
        flex-direction: column;
        align-items: stretch;
      }

      .control-group {
        justify-content: space-between;
      }
    }
  `;

  render() {
    return html`
      <div class="vocal-tract-container">
        <div class="three-container">
          <div class="info-panel">
            3D声道モデル<br>
            マウスでドラッグして回転
          </div>
          
          <div class="legend">
            <div class="legend-item">
              <div class="legend-color" style="background: linear-gradient(to right, #ff0000, #0000ff);"></div>
              <span>狭窄部（赤） → 開放部（青）</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  firstUpdated() {
    this.setup3DVisualization();
  }

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('width') || changedProperties.has('height')) {
      // リサイズは自動的にhandleResizeで処理される
    }
  }

  private setup3DVisualization() {
    if (!this.container) return;

    // コンテナのサイズはCSSで管理
    this.vocalTract3D = new VocalTract3D(this.container, {
      wireframe: this.wireframe,
      color: this.color,
      opacity: this.opacity,
      numSections: 15
    });
  }

  /**
   * 声道面積の更新
   * @param areas 各セクションの面積（正規化済み）
   */
  updateVocalTract(areas: Float32Array) {
    this.areas = areas;
    this.vocalTract3D?.updateVocalTract(areas);
  }

  /**
   * 対数声道面積から通常の面積への変換
   */
  updateFromLogAreas(logAreas: Float32Array) {
    const areas = new Float32Array(logAreas.length);
    for (let i = 0; i < logAreas.length; i++) {
      areas[i] = Math.exp(logAreas[i]);
    }
    
    // 正規化
    const maxArea = Math.max(...areas);
    if (maxArea > 0) {
      for (let i = 0; i < areas.length; i++) {
        areas[i] /= maxArea;
      }
    }
    
    this.updateVocalTract(areas);
  }


  disconnectedCallback() {
    super.disconnectedCallback();
    this.vocalTract3D?.dispose();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vocal-tract-3d': VocalTract3DComponent;
  }
}