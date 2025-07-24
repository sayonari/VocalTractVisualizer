import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface ControlSettings {
  windowSize: number;
  hopSize: number;
  lpcOrder: number;
  preEmphasis: number;
  fftSize: number;
}

@customElement('control-panel')
export class ControlPanel extends LitElement {
  @property({ type: Object }) settings: ControlSettings = {
    windowSize: 2048,
    hopSize: 512,
    lpcOrder: 14,
    preEmphasis: 0.97,
    fftSize: 2048
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

    .control-group {
      margin-bottom: var(--spacing-md);
    }

    .control-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: var(--spacing-xs);
    }

    .control-value {
      font-weight: 500;
      color: var(--text-primary);
    }

    input[type="range"] {
      width: 100%;
      margin: var(--spacing-xs) 0;
      cursor: pointer;
    }

    input[type="range"]::-webkit-slider-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--primary-color);
      cursor: pointer;
      -webkit-appearance: none;
    }

    input[type="range"]::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--primary-color);
      cursor: pointer;
      border: none;
    }

    input[type="range"]::-webkit-slider-runnable-track {
      height: 4px;
      background: var(--border-color);
      border-radius: 2px;
    }

    input[type="range"]::-moz-range-track {
      height: 4px;
      background: var(--border-color);
      border-radius: 2px;
    }

    .preset-buttons {
      display: flex;
      gap: var(--spacing-sm);
      margin-top: var(--spacing-md);
    }

    .preset-button {
      flex: 1;
      font-size: 12px;
      padding: var(--spacing-xs) var(--spacing-sm);
    }

    .divider {
      height: 1px;
      background: var(--border-color);
      margin: var(--spacing-md) 0;
    }

    @media (max-width: 768px) {
      :host {
        padding: var(--spacing-sm);
      }

      .panel-header {
        font-size: 14px;
      }
    }
  `;

  render() {
    return html`
      <div class="panel-header">解析パラメータ</div>

      <div class="control-group">
        <div class="control-label">
          <span>ウィンドウサイズ</span>
          <span class="control-value">${this.settings.windowSize}</span>
        </div>
        <input
          type="range"
          min="512"
          max="4096"
          step="512"
          .value=${String(this.settings.windowSize)}
          @input=${(e: Event) => this.updateSetting('windowSize', Number((e.target as HTMLInputElement).value))}
        />
      </div>

      <div class="control-group">
        <div class="control-label">
          <span>ホップサイズ</span>
          <span class="control-value">${this.settings.hopSize}</span>
        </div>
        <input
          type="range"
          min="128"
          max="1024"
          step="128"
          .value=${String(this.settings.hopSize)}
          @input=${(e: Event) => this.updateSetting('hopSize', Number((e.target as HTMLInputElement).value))}
        />
      </div>

      <div class="control-group">
        <div class="control-label">
          <span>LPC次数</span>
          <span class="control-value">${this.settings.lpcOrder}</span>
        </div>
        <input
          type="range"
          min="8"
          max="24"
          step="1"
          .value=${String(this.settings.lpcOrder)}
          @input=${(e: Event) => this.updateSetting('lpcOrder', Number((e.target as HTMLInputElement).value))}
        />
      </div>

      <div class="control-group">
        <div class="control-label">
          <span>プリエンファシス係数</span>
          <span class="control-value">${this.settings.preEmphasis.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          .value=${String(this.settings.preEmphasis)}
          @input=${(e: Event) => this.updateSetting('preEmphasis', Number((e.target as HTMLInputElement).value))}
        />
      </div>

      <div class="divider"></div>

      <div class="preset-buttons">
        <button class="preset-button" @click=${() => this.applyPreset('narrow')}>
          狭帯域
        </button>
        <button class="preset-button" @click=${() => this.applyPreset('wide')}>
          広帯域
        </button>
        <button class="preset-button" @click=${() => this.applyPreset('default')}>
          デフォルト
        </button>
      </div>
    `;
  }

  private updateSetting(key: keyof ControlSettings, value: number) {
    this.settings = {
      ...this.settings,
      [key]: value
    };
    
    this.dispatchEvent(new CustomEvent('settings-changed', {
      detail: this.settings,
      bubbles: true,
      composed: true
    }));
  }

  private applyPreset(preset: 'narrow' | 'wide' | 'default') {
    switch (preset) {
      case 'narrow':
        this.settings = {
          windowSize: 4096,
          hopSize: 512,
          lpcOrder: 16,
          preEmphasis: 0.97,
          fftSize: 4096
        };
        break;
      case 'wide':
        this.settings = {
          windowSize: 512,
          hopSize: 128,
          lpcOrder: 12,
          preEmphasis: 0.95,
          fftSize: 1024
        };
        break;
      case 'default':
        this.settings = {
          windowSize: 2048,
          hopSize: 512,
          lpcOrder: 14,
          preEmphasis: 0.97,
          fftSize: 2048
        };
        break;
    }

    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('settings-changed', {
      detail: this.settings,
      bubbles: true,
      composed: true
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'control-panel': ControlPanel;
  }
}