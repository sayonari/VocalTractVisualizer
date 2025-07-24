import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getSystemInfo, formatBytes } from '../utils/system-check';

@customElement('debug-info')
export class DebugInfo extends LitElement {
  @state() private systemInfo = getSystemInfo();
  @state() private audioStatus = {
    isRecording: false,
    bufferSize: 0,
    sampleRate: 0,
    latency: 0
  };

  static styles = css`
    :host {
      display: block;
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      max-width: 300px;
      z-index: 1000;
    }

    .title {
      font-weight: bold;
      margin-bottom: 5px;
      color: #4CAF50;
    }

    .info-row {
      margin: 2px 0;
    }

    .label {
      color: #888;
    }

    .value {
      color: #fff;
    }

    .warning {
      color: #ff9800;
    }

    .error {
      color: #f44336;
    }

    .close-button {
      position: absolute;
      top: 5px;
      right: 5px;
      cursor: pointer;
      color: #888;
    }

    .close-button:hover {
      color: #fff;
    }
  `;

  render() {
    const memory = this.systemInfo.memory;
    
    return html`
      <div class="close-button" @click=${this.hide}>×</div>
      <div class="title">Debug Info</div>
      
      ${memory ? html`
        <div class="info-row">
          <span class="label">Memory:</span>
          <span class="value">
            ${formatBytes(memory.usedJSHeapSize)} / 
            ${formatBytes(memory.jsHeapSizeLimit)}
          </span>
        </div>
      ` : ''}
      
      <div class="info-row">
        <span class="label">Buffer:</span>
        <span class="value">${this.audioStatus.bufferSize} samples</span>
      </div>
      
      <div class="info-row">
        <span class="label">Sample Rate:</span>
        <span class="value">${this.audioStatus.sampleRate} Hz</span>
      </div>
      
      <div class="info-row">
        <span class="label">Recording:</span>
        <span class="value ${this.audioStatus.isRecording ? 'warning' : ''}">
          ${this.audioStatus.isRecording ? 'ON' : 'OFF'}
        </span>
      </div>
      
      <div class="info-row">
        <span class="label">Cores:</span>
        <span class="value">${this.systemInfo.cores}</span>
      </div>
    `;
  }

  updateAudioStatus(status: Partial<typeof this.audioStatus>) {
    this.audioStatus = { ...this.audioStatus, ...status };
  }

  private hide() {
    this.style.display = 'none';
  }

  show() {
    this.style.display = 'block';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'debug-info': DebugInfo;
  }
}