import { mediaQueryLarge, isMobileBreakpoint } from '@theme/utilities';

// Accordion
// Still extends HTMLElement over Component so that refs are still available to parent components (e.g. SortingFilterComponent)
class AccordionCustom extends HTMLElement {
  /** @type {HTMLDetailsElement} */
  get details() {
    const details = this.querySelector('details');

    if (!(details instanceof HTMLDetailsElement)) throw new Error('Details element not found');

    return details;
  }

  /** @type {HTMLElement} */
  get summary() {
    const summary = this.details.querySelector('summary');

    if (!(summary instanceof HTMLElement)) throw new Error('Summary element not found');

    return summary;
  }

  get #disableOnMobile() {
    return this.dataset.disableOnMobile === 'true';
  }

  get #disableOnDesktop() {
    return this.dataset.disableOnDesktop === 'true';
  }

  get #closeWithEscape() {
    return this.dataset.closeWithEscape === 'true';
  }

  #controller = new AbortController();

  connectedCallback() {
    const { signal } = this.#controller;

    this.#setDefaultOpenState();

    this.addEventListener('keydown', this.#handleKeyDown, { signal });
    this.summary.addEventListener('click', this.handleClick, { signal });
    this.details.addEventListener('click', this.#handleContentClick, { signal });
  }

  /**
   * Handles the disconnect event.
   */
  disconnectedCallback() {
    // Disconnect all the event listeners
    this.#controller.abort();
  }

  /**
   * Handles the click event.
   * @param {Event} event - The event.
   */
  handleClick = (event) => {
    const isMobile = isMobileBreakpoint();
    const isDesktop = !isMobile;

    // Stop default behaviour
    if ((isMobile && this.#disableOnMobile) || (isDesktop && this.#disableOnDesktop)) {
      event.preventDefault();
      return;
    }

    // Agar ye accordion already open hai to browser ko close karne do
    if (this.details.open) return;

    // Browser pehle current accordion open kare
    requestAnimationFrame(() => {
      // Thoda wait taki opening animation start ho jaye
      setTimeout(() => {
        const section =
          this.closest('.accordion') ||
          document;

        section.querySelectorAll('accordion-custom').forEach((accordion) => {
          if (accordion === this) return;

          if (!(accordion instanceof AccordionCustom)) return;

          if (accordion.details.open) {
            accordion.details.open = false;
          }
        });
      }, 120);
    });
  };

  /**
   * Closes the accordion when a click lands inside an element marked with
   * `[data-accordion-close]` (or one of its descendants). Used by markup that
   * provides an explicit close-target region inside the content area.
   *
   * @param {MouseEvent} event - The click event.
   */
  #handleContentClick = (event) => {
    if (!this.details.open) return;

    if (!(/** @type {Element} */ (event.target).closest('[data-accordion-close]'))) return;

    this.summary.focus({ preventScroll: true });
    this.details.open = false;
  };

  /**
   * Sets the default open state of the accordion based on the `open-by-default-on-mobile` and `open-by-default-on-desktop` attributes.
   */
  #setDefaultOpenState() {
    // Sirf ek baar initialize karo
    if (this.dataset.initialized === 'true') return;

    this.dataset.initialized = 'true';

    const container = this.closest('.accordion');

    if (!container) return;

    const openFirst = container.dataset.openFirstDefault === 'true';

    // Agar "Open first FAQ by default" OFF hai,
    // to existing Horizon behavior use karo.
    if (!openFirst) {
      const isMobile = isMobileBreakpoint();

      this.details.open =
        (isMobile && this.hasAttribute('open-by-default-on-mobile')) ||
        (!isMobile && this.hasAttribute('open-by-default-on-desktop'));

      return;
    }

    // Sirf first accordion open hoga
    const firstAccordion = container.querySelector('accordion-custom');

    this.details.open = firstAccordion === this;
  }

  /**
   * Handles keydown events for the accordion
   *
   * @param {KeyboardEvent} event - The keyboard event.
   */
  #handleKeyDown(event) {
    // Close the accordion when used as a menu
    if (event.key === 'Escape' && this.#closeWithEscape) {
      event.preventDefault();

      this.summary.focus();
      this.details.open = false;
    }
  }
}

if (!customElements.get('accordion-custom')) {
  customElements.define('accordion-custom', AccordionCustom);
}
