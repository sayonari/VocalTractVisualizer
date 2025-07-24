import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

type LayoutType = 'single' | 'sidebar-left' | 'sidebar-right' | 'two-column' | 'three-column';

@customElement('layout-grid')
export class LayoutGrid extends LitElement {
  @property({ type: String }) layout: LayoutType = 'sidebar-left';
  @property({ type: String }) gap = 'var(--spacing-md)';

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }

    .grid-container {
      display: grid;
      height: 100%;
      gap: var(--spacing-md);
    }

    /* Single column layout */
    .grid-container.single {
      grid-template-columns: 1fr;
    }

    /* Sidebar left layout */
    .grid-container.sidebar-left {
      grid-template-columns: 300px 1fr;
      grid-template-areas: "sidebar main";
    }

    /* Sidebar right layout */
    .grid-container.sidebar-right {
      grid-template-columns: 1fr 300px;
      grid-template-areas: "main sidebar";
    }

    /* Two column layout */
    .grid-container.two-column {
      grid-template-columns: 1fr 1fr;
    }

    /* Three column layout */
    .grid-container.three-column {
      grid-template-columns: 1fr 2fr 1fr;
      grid-template-areas: "left center right";
    }

    ::slotted([slot="sidebar"]) {
      grid-area: sidebar;
      overflow-y: auto;
    }

    ::slotted([slot="main"]) {
      grid-area: main;
      overflow-y: auto;
    }

    ::slotted([slot="left"]) {
      grid-area: left;
      overflow-y: auto;
    }

    ::slotted([slot="center"]) {
      grid-area: center;
      overflow-y: auto;
    }

    ::slotted([slot="right"]) {
      grid-area: right;
      overflow-y: auto;
    }

    /* Responsive breakpoints */
    @media (max-width: 1024px) {
      .grid-container.sidebar-left,
      .grid-container.sidebar-right {
        grid-template-columns: 250px 1fr;
      }

      .grid-container.three-column {
        grid-template-columns: 1fr;
        grid-template-areas: 
          "left"
          "center"
          "right";
      }
    }

    @media (max-width: 768px) {
      .grid-container.sidebar-left,
      .grid-container.sidebar-right,
      .grid-container.two-column {
        grid-template-columns: 1fr;
        grid-template-areas: 
          "sidebar"
          "main";
      }

      ::slotted([slot="sidebar"]) {
        max-height: 300px;
      }
    }

    /* Collapsible sidebar support */
    :host([collapsed]) .grid-container.sidebar-left {
      grid-template-columns: 60px 1fr;
    }

    :host([collapsed]) .grid-container.sidebar-right {
      grid-template-columns: 1fr 60px;
    }

    /* Custom gap support */
    .grid-container {
      gap: var(--grid-gap, var(--spacing-md));
    }
  `;

  render() {
    return html`
      <div class="grid-container ${this.layout}" style="--grid-gap: ${this.gap}">
        ${this.renderSlots()}
      </div>
    `;
  }

  private renderSlots() {
    switch (this.layout) {
      case 'single':
        return html`<slot></slot>`;
      case 'sidebar-left':
      case 'sidebar-right':
        return html`
          <slot name="sidebar"></slot>
          <slot name="main"></slot>
        `;
      case 'two-column':
        return html`
          <slot name="left"></slot>
          <slot name="right"></slot>
        `;
      case 'three-column':
        return html`
          <slot name="left"></slot>
          <slot name="center"></slot>
          <slot name="right"></slot>
        `;
      default:
        return html`<slot></slot>`;
    }
  }

  setLayout(layout: LayoutType) {
    this.layout = layout;
  }

  toggleCollapse() {
    this.toggleAttribute('collapsed');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'layout-grid': LayoutGrid;
  }
}