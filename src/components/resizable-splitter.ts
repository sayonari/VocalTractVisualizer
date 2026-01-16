import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export interface PanelSizes {
  [key: string]: number;
}

@customElement('resizable-splitter')
export class ResizableSplitter extends LitElement {
  @property({ type: String }) direction: 'horizontal' | 'vertical' = 'horizontal';
  @property({ type: String }) storageKey = '';
  @property({ type: Number }) minSize = 100;
  @property({ type: Number }) defaultRatio = 0.5;

  @state() private ratio = 0.5;
  @state() private isDragging = false;

  private startPos = 0;
  private startRatio = 0;

  static styles = css`
    :host {
      display: flex;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    :host([direction="horizontal"]) {
      flex-direction: row;
    }

    :host([direction="vertical"]) {
      flex-direction: column;
    }

    .panel {
      overflow: hidden;
      position: relative;
    }

    .panel-first {
      flex-shrink: 0;
    }

    .panel-second {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    .splitter {
      flex-shrink: 0;
      background: var(--border-color, #e0e0e0);
      position: relative;
      z-index: 100;
      transition: background-color 0.15s ease;
    }

    :host([direction="horizontal"]) .splitter {
      width: 6px;
      cursor: col-resize;
    }

    :host([direction="vertical"]) .splitter {
      height: 6px;
      cursor: row-resize;
    }

    .splitter:hover,
    .splitter.dragging {
      background: var(--primary-color, #2196F3);
    }

    .splitter::before {
      content: '';
      position: absolute;
      background: var(--text-secondary, #666);
      border-radius: 2px;
      opacity: 0.5;
    }

    :host([direction="horizontal"]) .splitter::before {
      width: 2px;
      height: 30px;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
    }

    :host([direction="vertical"]) .splitter::before {
      width: 30px;
      height: 2px;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
    }

    .splitter:hover::before,
    .splitter.dragging::before {
      background: white;
      opacity: 1;
    }

    /* Prevent text selection during drag */
    :host(.dragging) {
      user-select: none;
    }

    :host(.dragging) ::slotted(*) {
      pointer-events: none;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadSavedRatio();
    this.setAttribute('direction', this.direction);
  }

  private loadSavedRatio() {
    if (this.storageKey) {
      const saved = localStorage.getItem(`splitter-${this.storageKey}`);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed > 0 && parsed < 1) {
          this.ratio = parsed;
          return;
        }
      }
    }
    this.ratio = this.defaultRatio;
  }

  private saveRatio() {
    if (this.storageKey) {
      localStorage.setItem(`splitter-${this.storageKey}`, this.ratio.toString());
    }
  }

  private handleMouseDown(e: MouseEvent) {
    e.preventDefault();
    this.isDragging = true;
    this.classList.add('dragging');
    this.startPos = this.direction === 'horizontal' ? e.clientX : e.clientY;
    this.startRatio = this.ratio;

    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;

    const rect = this.getBoundingClientRect();
    const totalSize = this.direction === 'horizontal' ? rect.width : rect.height;
    const currentPos = this.direction === 'horizontal' ? e.clientX : e.clientY;
    const startOffset = this.direction === 'horizontal' ? rect.left : rect.top;

    const newFirstSize = currentPos - startOffset;
    let newRatio = newFirstSize / totalSize;

    // Apply min size constraints
    const minRatio = this.minSize / totalSize;
    const maxRatio = 1 - minRatio;
    newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio));

    this.ratio = newRatio;
    this.requestUpdate();
  };

  private handleMouseUp = () => {
    this.isDragging = false;
    this.classList.remove('dragging');
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    this.saveRatio();

    // Dispatch event for child components to handle resize
    this.dispatchEvent(new CustomEvent('splitter-resize', {
      detail: { ratio: this.ratio },
      bubbles: true,
      composed: true
    }));
  };

  // Touch support
  private handleTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    this.isDragging = true;
    this.classList.add('dragging');
    const touch = e.touches[0];
    this.startPos = this.direction === 'horizontal' ? touch.clientX : touch.clientY;
    this.startRatio = this.ratio;

    document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd);
  }

  private handleTouchMove = (e: TouchEvent) => {
    if (!this.isDragging || e.touches.length !== 1) return;
    e.preventDefault();

    const touch = e.touches[0];
    const rect = this.getBoundingClientRect();
    const totalSize = this.direction === 'horizontal' ? rect.width : rect.height;
    const currentPos = this.direction === 'horizontal' ? touch.clientX : touch.clientY;
    const startOffset = this.direction === 'horizontal' ? rect.left : rect.top;

    const newFirstSize = currentPos - startOffset;
    let newRatio = newFirstSize / totalSize;

    const minRatio = this.minSize / totalSize;
    const maxRatio = 1 - minRatio;
    newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio));

    this.ratio = newRatio;
    this.requestUpdate();
  };

  private handleTouchEnd = () => {
    this.isDragging = false;
    this.classList.remove('dragging');
    document.removeEventListener('touchmove', this.handleTouchMove);
    document.removeEventListener('touchend', this.handleTouchEnd);
    this.saveRatio();

    this.dispatchEvent(new CustomEvent('splitter-resize', {
      detail: { ratio: this.ratio },
      bubbles: true,
      composed: true
    }));
  };

  render() {
    const firstSize = `${this.ratio * 100}%`;

    const firstStyle = this.direction === 'horizontal'
      ? `width: calc(${firstSize} - 3px);`
      : `height: calc(${firstSize} - 3px);`;

    return html`
      <div class="panel panel-first" style=${firstStyle}>
        <slot name="first"></slot>
      </div>
      <div
        class="splitter ${this.isDragging ? 'dragging' : ''}"
        @mousedown=${this.handleMouseDown}
        @touchstart=${this.handleTouchStart}
      ></div>
      <div class="panel panel-second">
        <slot name="second"></slot>
      </div>
    `;
  }

  // Public method to reset to default
  resetToDefault() {
    this.ratio = this.defaultRatio;
    this.saveRatio();
    this.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'resizable-splitter': ResizableSplitter;
  }
}
