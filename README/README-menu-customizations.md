# Shopify Theme Menu Customizations

This document briefly outlines the custom features and logic changes implemented in the Shopify theme's header navigation menu, updated for the latest Shopify theme version.

## 1. Disabled "More" Overflow Menu

**Goal:** Prevent excess navigation links from hiding behind a "More" dropdown and instead display them visibly across the screen, allowing them to wrap to the next line.

**Implementation Details:**
- **`blocks/_header-menu.liquid`**: Added `disabled="true"` to the `<overflow-list>` component attributes to forcefully deactivate its standard collapsing behavior.
- **`assets/overflow-list.js`**: Patched the Javascript Web Component lifecycle by preventing execution of `#reflowItems` when `disabled='true'` is present and adding safe initialization checks (`if (!this.#refs) return;`) to avoid console errors.
- **`assets/overflow-list.css`**: Injected flex-wrap properties (`:host([disabled]) [part='list'] { flex-wrap: wrap; overflow: visible; height: auto; }`) so the navigation list wraps to the next line naturally instead of clipping.

---

## 2. Dynamic Dropdown Layout (Mega Menu vs. Compact Menu)

**Goal:** Prevent small menus with few links from opening as giant, empty mega menus. Automatically switch to a compact, single-column dropdown if the submenu item count falls below a configured threshold.

**Implementation Details:**
- **Schema Updates (`blocks/_header-menu.liquid`)**:
  - **Enable dynamic dropdown layout** (`dynamic_dropdown_layout`, Checkbox)
  - **Submenu item threshold** (`submenu_item_threshold`, Number, default: 5, with `visible_if: "{{ block.settings.dynamic_dropdown_layout == true }}"` so it only shows in the theme editor when the feature is enabled).
- **Liquid Structure & Trigger Handling (`blocks/_header-menu.liquid`)**:
  - Shopify's latest update introduces `<span class="menu-list__trigger">` to wrap the top-level link and its `<button class="menu-list__disclosure">` toggle for accessibility.
  - The trigger `<span>` is closed immediately after the disclosure button.
  - The submenu container `<div class="menu-list__submenu">` is rendered as a clean direct sibling of the trigger inside `<li class="menu-list__list-item">`.
  - When the submenu item count $\le$ threshold, the parent `<li>` receives `.menu-list__list-item--compact-parent`, the submenu receives `.menu-list__submenu--compact`, and renders a clean `<ul class="compact-dropdown__list">` instead of the multi-column mega menu grid.
- **Dropdown Styling & Positioning**:
  - `.menu-list__list-item--compact-parent` is styled with `position: relative;`.
  - `.menu-list__submenu--compact` is styled with `position: absolute; top: 100%; left: 0; width: max-content;` with its own background, subtle shadow, and border.
  - Smooth hover & focus transitions are applied using theme timing variables.
- **Header Underlay Safeguard (`sections/header.liquid`)**:
  - Added a CSS safeguard using `:has()` to prevent `.header__underlay-open` (the full-width white ribbon) from dropping down when only a compact single-column dropdown is hovered or active.

---

## Compatibility with Latest Shopify Theme Updates
- Preserves standard Shopify disclosure and accessibility components (`ref="disclosure[]"`, `span.menu-list__trigger`, and `aria-expanded`).
- Maintains full keyboard navigation and screen-reader accessibility.
- Keeps theme performance intact without redundant JavaScript overhead.
