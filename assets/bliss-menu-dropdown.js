/**
 * Bliss menu compact dropdowns: keep the dropdown and its third-level flyout on screen.
 * When there isn't enough room on the opening side, the dropdown aligns to the menu
 * item's opposite edge and the flyout opens to the other side (like a native select).
 * Sets data-align="end" on .menu-list__submenu--compact and data-flyout="start" on
 * .compact-dropdown__sublist; the Bliss menu stylesheet does the positioning.
 */

const VIEWPORT_MARGIN = 16;

/**
 * @param {Element} element
 * @returns {boolean}
 */
function isRtl(element) {
  return getComputedStyle(element).direction === 'rtl';
}

/**
 * Does a box of `width` fit when it starts at `edge` and grows towards the reading direction?
 * @param {number} edge - The x position the box starts from
 * @param {number} width
 * @param {boolean} rtl
 */
function fits(edge, width, rtl) {
  return rtl ? edge - width >= VIEWPORT_MARGIN : edge + width <= window.innerWidth - VIEWPORT_MARGIN;
}

/**
 * @param {HTMLElement} item - .menu-list__list-item--compact-parent
 */
function placeDropdown(item) {
  const submenu = item.querySelector(':scope > .menu-list__submenu--compact');
  const inner = submenu?.querySelector('.menu-list__submenu-inner');
  if (!(submenu instanceof HTMLElement) || !(inner instanceof HTMLElement)) return;

  const rtl = isRtl(item);
  const itemRect = item.getBoundingClientRect();
  const width = inner.getBoundingClientRect().width;
  const start = rtl ? itemRect.right : itemRect.left;

  if (fits(start, width, rtl)) {
    delete submenu.dataset.align;
  } else {
    submenu.dataset.align = 'end';
  }
}

/**
 * @param {HTMLElement} item - .compact-dropdown__item--has-children
 */
function placeFlyout(item) {
  const sublist = item.querySelector(':scope > .compact-dropdown__sublist');
  if (!(sublist instanceof HTMLElement)) return;

  const rtl = isRtl(item);
  const itemRect = item.getBoundingClientRect();
  const width = sublist.getBoundingClientRect().width;
  const end = rtl ? itemRect.left : itemRect.right;

  if (fits(end, width, rtl)) {
    delete sublist.dataset.flyout;
  } else {
    sublist.dataset.flyout = 'start';
  }
}

/**
 * @param {Event} event
 */
function handleOpen(event) {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest('.header-menu--bliss')) return;

  const parent = event.target.closest('.menu-list__list-item--compact-parent');
  if (parent instanceof HTMLElement) placeDropdown(parent);

  const flyoutItem = event.target.closest('.compact-dropdown__item--has-children');
  if (flyoutItem instanceof HTMLElement) placeFlyout(flyoutItem);
}

if (!window.blissMenuDropdownInitialized) {
  window.blissMenuDropdownInitialized = true;
  document.addEventListener('pointerover', handleOpen);
  document.addEventListener('focusin', handleOpen);
}
