import { isMobileBreakpoint } from '@theme/utilities';

class ProductTabs extends HTMLElement {
  #controller = new AbortController();

  get displayStyle() {
    return this.dataset.displayStyle || 'tabs';
  }

  get nav() {
    return this.querySelector('.product-tabs__nav');
  }

  get accordions() {
    return this.querySelectorAll('.product-tabs__accordion-item');
  }

  connectedCallback() {
    const accordions = this.accordions;
    if (accordions.length === 0) return;

    const { signal } = this.#controller;

    // If display style is accordion, skip tabs initialization.
    // Native <accordion-custom> elements handle all expand/collapse behavior.
    if (this.displayStyle === 'accordion') {
      this.ownerDocument.addEventListener('shopify:block:select', this.#handleBlockSelectAccordion.bind(this), { signal });
      return;
    }

    // Create the navigation buttons
    this.#setupNavigation(accordions);

    // Initial switch to first tab
    this.switchTab(0);

    // Sync mobile accordion click with desktop active tab
    accordions.forEach((acc, index) => {
      const details = acc.querySelector('details');
      if (details) {
        details.addEventListener('toggle', () => {
          if (details.open && isMobileBreakpoint()) {
            this.#updateActiveTabState(index);
          }
        }, { signal });
      }
    });

    // Theme editor integrations
    this.ownerDocument.addEventListener('shopify:block:select', this.#handleBlockSelect.bind(this), { signal });
  }

  disconnectedCallback() {
    this.#controller.abort();
  }

  #handleBlockSelectAccordion(event) {
    const blockId = event.detail.blockId;
    const accordions = this.accordions;

    const targetAccordion = Array.from(accordions).find(
      (acc) => acc.dataset.blockId === blockId
    );

    if (targetAccordion) {
      const details = targetAccordion.querySelector('details');
      if (details && !details.open) {
        const summary = details.querySelector('summary');
        if (summary) summary.click();
      }
    }
  }

  #setupNavigation(accordions) {
    const nav = this.nav;
    if (!nav) return;

    nav.innerHTML = '';

    accordions.forEach((acc, index) => {
      const summary = acc.querySelector('summary');
      const heading = summary ? summary.textContent.trim() : `Tab ${index + 1}`;
      const blockId = acc.dataset.blockId || index;

      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'tab';
      button.className = 'product-tabs__btn';
      button.id = `ProductTab-${blockId}`;
      button.setAttribute('aria-controls', `ProductTabPanel-${blockId}`);
      button.textContent = heading;

      button.addEventListener('click', () => this.switchTab(index));
      button.addEventListener('keydown', (e) => this.#handleKeyDown(e, index));

      nav.appendChild(button);
    });
  }

  switchTab(index) {
    const buttons = this.querySelectorAll('.product-tabs__btn');
    const accordions = this.accordions;

    buttons.forEach((btn, idx) => {
      const active = idx === index;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.setAttribute('tabindex', active ? '0' : '-1');
    });

    accordions.forEach((acc, idx) => {
      const active = idx === index;
      acc.classList.toggle('is-active', active);
      
      const details = acc.querySelector('details');
      if (details) {
        // Toggle the open attribute based on active state on desktop
        if (!isMobileBreakpoint()) {
          if (active) {
            details.setAttribute('open', '');
          } else {
            details.removeAttribute('open');
          }
        }
      }
    });
  }

  #updateActiveTabState(index) {
    const buttons = this.querySelectorAll('.product-tabs__btn');
    const accordions = this.accordions;

    buttons.forEach((btn, idx) => {
      const active = idx === index;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.setAttribute('tabindex', active ? '0' : '-1');
    });

    accordions.forEach((acc, idx) => {
      acc.classList.toggle('is-active', idx === index);
    });
  }

  #handleKeyDown(event, index) {
    const buttons = this.querySelectorAll('.product-tabs__btn');
    let newIndex = index;

    if (event.key === 'ArrowRight') {
      newIndex = (index + 1) % buttons.length;
    } else if (event.key === 'ArrowLeft') {
      newIndex = (index - 1 + buttons.length) % buttons.length;
    } else if (event.key === 'Home') {
      newIndex = 0;
    } else if (event.key === 'End') {
      newIndex = buttons.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    buttons[newIndex].focus();
    this.switchTab(newIndex);
  }

  #handleBlockSelect(event) {
    const blockId = event.detail.blockId;
    const accordions = this.accordions;

    const index = Array.from(accordions).findIndex(
      (acc) => acc.dataset.blockId === blockId
    );

    if (index !== -1) {
      this.switchTab(index);

      // On mobile, also expand the selected block
      if (isMobileBreakpoint()) {
        const details = accordions[index].querySelector('details');
        if (details && !details.open) {
          const summary = details.querySelector('summary');
          if (summary) summary.click();
        }
      }
    }
  }
}

if (!customElements.get('product-tabs')) {
  customElements.define('product-tabs', ProductTabs);
}
