import { Component } from '@theme/component';

/**
 * @typedef {Object} TabbedCollectionRefs
 * @property {HTMLElement} tabsContainer - Container where tab buttons are injected
 * @property {HTMLElement} panelsContainer - Container wrapper of theme block panels
 */

/**
 * Tabbed Collection Component
 *
 * @extends {Component<TabbedCollectionRefs>}
 */
class TabbedCollectionComponent extends Component {
  requiredRefs = ['tabsContainer', 'panelsContainer'];

  /** @type {HTMLElement[]} */
  panels = [];

  /** @type {HTMLButtonElement[]} */
  tabButtons = [];

  connectedCallback() {
    super.connectedCallback();

    const { tabsContainer, panelsContainer } = this.refs;

    // Find all panels that are registered as tabpanels
    const panels = Array.from(panelsContainer.querySelectorAll('[role="tabpanel"]'));
    this.panels = panels;

    if (panels.length === 0) return;

    // Clear any existing buttons to avoid duplicate rendering (e.g. during Editor updates)
    tabsContainer.innerHTML = '';
    this.tabButtons = [];

    // Create buttons dynamically based on panels metadata
    panels.forEach((panel, index) => {
      const title = panel.getAttribute('data-tab-title') || `Tab ${index + 1}`;

      const btn = this.ownerDocument.createElement('button');
      btn.type = 'button';
      btn.className = 'tabbed-collection__tab-btn';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(index === 0));
      btn.setAttribute('aria-controls', panel.id);
      btn.id = `tab-btn-${panel.id}`;
      btn.textContent = title;

      if (index === 0) {
        btn.classList.add('active');
        panel.classList.add('active');
        panel.style.display = 'block';
      } else {
        panel.classList.remove('active');
        panel.style.display = 'none';
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectTab(index);
      });

      tabsContainer.appendChild(btn);
      this.tabButtons.push(btn);
    });

    // Handle Theme Editor block selection
    this.ownerDocument.addEventListener('shopify:block:select', this.#handleBlockSelect);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.ownerDocument.removeEventListener('shopify:block:select', this.#handleBlockSelect);
  }

  /**
   * Switches the active tab to the specified index.
   *
   * @param {number} targetIndex - The index of the tab to activate
   */
  selectTab(targetIndex) {
    if (targetIndex < 0 || targetIndex >= this.panels.length) return;

    this.tabButtons.forEach((btn, index) => {
      const isActive = index === targetIndex;
      btn.setAttribute('aria-selected', String(isActive));
      btn.classList.toggle('active', isActive);
    });

    this.panels.forEach((panel, index) => {
      const isActive = index === targetIndex;
      panel.classList.toggle('active', isActive);
      if (isActive) {
        panel.style.display = 'block';

        // Find slideshow/carousel instances in the newly active panel and select first slide
        const slideshow = panel.querySelector('slideshow-component');
        if (slideshow && typeof slideshow.select === 'function') {
          slideshow.select(0, undefined, { animate: false });
        }
      } else {
        panel.style.display = 'none';
      }
    });

    // Dispatch a global resize event so that any active or hidden carousels / sliders recalculate their layout
    window.dispatchEvent(new Event('resize'));
  }

  /**
   * Handles Shopify Theme Editor block selection
   *
   * @param {Event} event
   */
  #handleBlockSelect = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    // Check if the selected element is the panel or nested inside a panel
    const panel = target.closest('[role="tabpanel"]');
    if (panel) {
      const index = this.panels.indexOf(panel);
      if (index !== -1) {
        this.selectTab(index);
      }
    }
  };
}

if (!customElements.get('tabbed-collection-component')) {
  customElements.define('tabbed-collection-component', TabbedCollectionComponent);
}
