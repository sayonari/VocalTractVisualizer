import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface AnalysisInfo {
  fundamentalFrequency: number | null;
  formants: number[];
  intensity: number;
  spectralCentroid: number;
  voiceQuality: 'voiced' | 'unvoiced' | 'silent';
}

@customElement('info-panel')
export class InfoPanel extends LitElement {
  @property({ type: Object }) analysisInfo: AnalysisInfo = {
    fundamentalFrequency: null,
    formants: [],
    intensity: 0,
    spectralCentroid: 0,
    voiceQuality: 'silent'
  };

  static styles = css`
    :host {
      display: block;
      background: var(--surface-color);
      border-radius: var(--radius-md);
      padding: var(--spacing-md);
      box-shadow: var(--shadow-sm);
    }

    .panel-header {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: var(--spacing-md);
      color: var(--text-primary);
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: var(--spacing-md);
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }

    .info-label {
      font-size: 12px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .info-value {
      font-size: 18px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .info-unit {
      font-size: 14px;
      color: var(--text-secondary);
      margin-left: 4px;
    }

    .voice-quality {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-xs);
      padding: var(--spacing-xs) var(--spacing-sm);
      border-radius: var(--radius-sm);
      font-size: 14px;
      font-weight: 500;
    }

    .voice-quality.voiced {
      background: #E8F5E9;
      color: #2E7D32;
    }

    .voice-quality.unvoiced {
      background: #FFF3E0;
      color: #E65100;
    }

    .voice-quality.silent {
      background: #F5F5F5;
      color: #616161;
    }

    .formant-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }

    .formant-item {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
    }

    .formant-label {
      color: var(--text-secondary);
    }

    .formant-value {
      font-weight: 500;
      color: var(--text-primary);
    }

    .intensity-bar {
      width: 100%;
      height: 8px;
      background: var(--border-color);
      border-radius: 4px;
      overflow: hidden;
      margin-top: var(--spacing-xs);
    }

    .intensity-fill {
      height: 100%;
      background: linear-gradient(to right, 
        var(--success-color) 0%, 
        var(--secondary-color) 50%, 
        var(--error-color) 100%);
      transition: width 0.2s ease;
    }

    .divider {
      height: 1px;
      background: var(--border-color);
      margin: var(--spacing-md) 0;
    }

    @media (max-width: 768px) {
      .info-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    return html`
      <div class="panel-header">解析結果</div>

      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">基本周波数 (F0)</div>
          <div class="info-value">
            ${this.analysisInfo.fundamentalFrequency 
              ? html`${this.analysisInfo.fundamentalFrequency.toFixed(1)}<span class="info-unit">Hz</span>`
              : html`<span style="color: var(--text-secondary)">—</span>`
            }
          </div>
        </div>

        <div class="info-item">
          <div class="info-label">音声タイプ</div>
          <div class="voice-quality ${this.analysisInfo.voiceQuality}">
            ${this.getVoiceQualityLabel(this.analysisInfo.voiceQuality)}
          </div>
        </div>

        <div class="info-item">
          <div class="info-label">スペクトル重心</div>
          <div class="info-value">
            ${this.analysisInfo.spectralCentroid.toFixed(0)}<span class="info-unit">Hz</span>
          </div>
        </div>

        <div class="info-item">
          <div class="info-label">音圧レベル</div>
          <div class="info-value">
            ${(this.analysisInfo.intensity * 100).toFixed(0)}<span class="info-unit">%</span>
          </div>
          <div class="intensity-bar">
            <div class="intensity-fill" style="width: ${this.analysisInfo.intensity * 100}%"></div>
          </div>
        </div>
      </div>

      ${this.analysisInfo.formants.length > 0 ? html`
        <div class="divider"></div>
        
        <div class="formant-list">
          <div class="info-label">フォルマント周波数</div>
          ${this.analysisInfo.formants.slice(0, 5).map((freq, index) => html`
            <div class="formant-item">
              <span class="formant-label">F${index + 1}</span>
              <span class="formant-value">${freq.toFixed(0)} Hz</span>
            </div>
          `)}
        </div>
      ` : ''}
    `;
  }

  private getVoiceQualityLabel(quality: 'voiced' | 'unvoiced' | 'silent'): string {
    switch (quality) {
      case 'voiced':
        return '有声音';
      case 'unvoiced':
        return '無声音';
      case 'silent':
        return '無音';
    }
  }

  updateAnalysisInfo(info: Partial<AnalysisInfo>) {
    this.analysisInfo = {
      ...this.analysisInfo,
      ...info
    };
    this.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'info-panel': InfoPanel;
  }
}