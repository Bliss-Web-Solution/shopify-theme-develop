# Product Compare Feature — Developer Documentation

> **Shopify Theme:** Horizon / Bliss Customization  
> **Analyzed:** 2026-07-21  
> **Scope:** Complete static analysis — no code was modified during this review.
---


## Feature Overview

The **Product Compare** feature allows shoppers to select multiple products from any collection/product-listing page and view them side-by-side on a dedicated compare page. The feature is composed of:

- **Client-side state management** via `localStorage` (no server round-trips until the compare page is opened).
- **Two UI trigger points** on product cards: a **checkbox toggle** (mobile) and an **icon overlay button** (desktop).
- **A floating Compare Bar** that appears at the bottom of the screen whenever at least one product is selected.
- **A header compare icon** that displays a bubble count and links to the compare page.
- **A dedicated compare page** (`/pages/compare`) that receives product IDs via the URL `?ids=` query string, then fetches rendered HTML from Shopify's Search API using an alternative template (`search.compare.liquid`).

The feature is **fully client-side driven** — Liquid renders the empty shells; JavaScript hydrates all state.

---

## Folder Structure

```
shopify-theme-develop/
│
├── assets/
│   ├── compare.js              ← Core JS engine (CompareManager + compare-bar custom element)
│   └── icon-compare.svg        ← SVG icon used in header + icon button
│
├── blocks/
│   ├── _product-card.liquid    ← Renders compare-toggle snippet below card (mobile)
│   └── _product-card-gallery.liquid ← Renders compare-icon-button snippet over image (desktop)
│
├── config/
│   └── settings_schema.json   ← Defines `product_compare_toggle` global theme setting
│
├── locales/
│   └── en.default.json        ← Translation strings for all compare UI text
│
├── sections/
│   ├── compare-bar.liquid      ← Section shell + CSS for the floating compare bar
│   ├── compare-table.liquid    ← Section that renders the compare page table container + inline JS
│   └── header.liquid           ← Defines `show_compare` section setting (schema)
│
├── snippets/
│   ├── compare-icon-button.liquid ← Desktop overlay icon button per product card
│   ├── compare-toggle.liquid      ← Mobile checkbox toggle per product card
│   └── header-actions.liquid      ← Renders the header compare link + bubble count
│
└── templates/
    ├── page.compare-page.json  ← JSON template wiring the compare-table section to a page
    └── search.compare.liquid   ← Alternate search template returning the HTML table fragment
```

---

## File-by-File Explanation

---

### `assets/compare.js`

**Why it exists:** This is the **central brain** of the entire compare feature. Every other file either emits events that this file handles, or renders DOM elements that this file reads or writes.

**Responsibility:** 
- Manages the `selectedProducts` array in memory and `localStorage`.
- Registers event listeners for all user interactions (checkbox change, icon button click, remove button click, clear all, minimize/restore bar).
- Keeps all UI in sync: checkboxes, icon buttons, compare bar, header bubble count, and header link href.
- Defines the `<compare-bar>` Custom Element.

**Language:** Pure JavaScript (ES6 classes, Custom Elements API, no external libraries).

**Reusable:** Specific to the compare feature, but the `CompareManager` class pattern could be adapted.

#### Architecture inside the file

| Part | Type | Purpose |
|---|---|---|
| `window.CompareManager` class | ES6 Class | Singleton state manager with all business logic |
| `window.compareManager` | Instance | Single instance created at script load time |
| `customElements.define('compare-bar', ...)` | Custom Element | Manages the floating compare bar DOM |

**Guard pattern:** Both the class definition and the custom element registration are wrapped in `if` guards to prevent duplicate registration when the script is included more than once (which it is — in both `compare-bar.liquid` and `compare-table.liquid`).

```js
if (typeof window.CompareManager === 'undefined') { ... }    // Line 1
if (!window.compareManager) { ... }                          // Line 258
if (!customElements.get('compare-bar')) { ... }              // Line 262
```

**Interacts with:**
- `sections/compare-bar.liquid` — renders the `<compare-bar>` element shell.
- `snippets/compare-toggle.liquid` — emits `.compare-toggle-input` checkboxes.
- `snippets/compare-icon-button.liquid` — emits `.compare-icon-button` elements.
- `snippets/header-actions.liquid` — renders `.compare-bubble`, `.compare-bubble-count`, `.action__compare`.
- `sections/compare-table.liquid` — listens for `compare:updated` custom event.

---

### `assets/icon-compare.svg`

**Why it exists:** Provides a reusable SVG icon for the compare action throughout the UI.

**Responsibility:** Defines the visual icon (two arrows crossing, representing comparison). Inlined via Liquid's `inline_asset_content` filter in both `compare-icon-button.liquid` and `header-actions.liquid`.

**Language:** SVG.

**Reusable:** Yes — used in multiple places via `{{ 'icon-compare.svg' | inline_asset_content }}`.

---

### `sections/compare-bar.liquid`

**Why it exists:** Registers the Compare Bar as a Shopify **section**, so it can be added to any page template via the Shopify theme editor and receives theme editor hooks (e.g., `shopify:section:load`).

**Responsibility:**
- Renders the empty `<compare-bar>` Custom Element shell (hidden by default via `hidden` attribute).
- Provides all CSS for the floating bar (position, layout, minimized state, responsive breakpoints).
- Loads `compare.js` with `<script defer>`.
- Provides theme editor settings: `background_color`, `text_color`.

**Language:** Liquid (minimal — just renders the empty shell and styles), CSS (inside `{% style %}` block), JSON schema.

**Content is NOT in Liquid:** The inner HTML of `<compare-bar>` is **entirely generated by JavaScript** at runtime. The Liquid comment on line 11 makes this explicit:
```liquid
{%- comment -%} Content hydrated by compare.js {%- endcomment -%}
```

**Where it is placed:** Added to `collection.json`, `product.json`, and `index.json` templates so the bar appears on those pages.

**Interacts with:** `compare.js` (script load), `contrast-override` snippet (theme color overrides).

---

### `sections/compare-table.liquid`

**Why it exists:** Provides the server-rendered container for the product comparison table on the dedicated compare page.

**Responsibility:**
- Renders a `<section>` with `#CompareTableContainer` div and `#CompareHeading` h1.
- Contains an **inline `<script>`** that:
  1. On `DOMContentLoaded`, reads `?ids=` from the URL.
  2. Constructs a Shopify Search API URL query (`id:X OR id:Y OR ...`).
  3. Fetches `?view=compare` to get the rendered HTML table fragment.
  4. Injects the HTML into `#CompareTableContainer`.
  5. Handles the single-product edge case by appending a placeholder column.
  6. Listens to the `compare:updated` custom event (dispatched by `compare.js` when products are removed on the compare page itself).
- Also provides all CSS for the table layout (`compare-table`, `.compareTable-product`, `.compareTable-heading`, etc.).
- Loads `compare.js` with `<script defer>`.

**Language:** Liquid (section wrapper), JavaScript (inline), CSS (inside `{% style %}`), JSON schema.

**Reusable:** Specific to the compare page.

**Interacts with:**
- `templates/page.compare-page.json` — this section is the primary section on the compare page.
- `templates/search.compare.liquid` — its fetch call targets this template.
- `compare.js` — dispatches `compare:updated` event that this file listens to.

---

### `templates/search.compare.liquid`

**Why it exists:** Acts as the **data layer / rendering template** for the compare table. Shopify's `search` route supports an alternative template via the `?view=compare` query parameter. This template returns only the HTML fragment (no layout) needed to populate the table.

**Responsibility:**
- Uses `{% layout none %}` so it returns a bare HTML fragment (no `<html>`, no header, no footer).
- Iterates over `search.results`, filtering for products (`product.object_type == 'product'`).
- Renders a full `<table class="compare-table">` with `<thead>` (product images, titles, price) and `<tbody>` rows for each product attribute.

**Rows rendered:**
| Row | Data Source |
|---|---|
| Product card (image, title, price) | `product.featured_media`, `product.title`, `price` snippet |
| Description | `product.description` (truncated to 30 words) |
| Availability | `product.available` → In Stock / Out of Stock badge |
| SKU | `product.selected_or_first_available_variant.sku` |
| Vendor/Brand | `product.vendor` |
| Product Type | `product.type` |
| Options | `product.options_with_values` (name + values list) |
| Collections | `product.collections` |
| Tags | `product.tags` |
| Actions | "View Product" link + "Remove" button |

**Language:** Liquid (Shopify template), HTML.

**Reusable:** Specific to the compare feature's search endpoint. Not reusable for other purposes without modification.

**Interacts with:**
- `sections/compare-table.liquid` — fetched by the inline JS in that section.
- `snippets/price.liquid` — rendered via `{% render 'price', product_resource: product %}`.

> [!IMPORTANT]
> The "Remove" button rendered here (`<button class="compareTable-removeProduct" data-id="{{ product.id }}">`) is handled by the delegated click listener in `compare.js` (line 38). The `data-id` attribute carries the product ID.

---

### `templates/page.compare-page.json`

**Why it exists:** This is the **Shopify page template** that powers the `/pages/compare` URL (any page in Shopify admin assigned the "compare-page" template).

**Responsibility:** Declares which sections appear on the compare page and their order:
1. `main-page` section (disabled/hidden — serves as structural placeholder).
2. `compare-table` section — the actual compare table.

**Language:** JSON (Shopify section template format).

**Reusable:** Specific to the compare page.

> [!NOTE]
> The `main-page` section is set to `"disabled": true`, meaning the default page content block is hidden. Only the `compare-table` section is active.

---

### `snippets/compare-icon-button.liquid`

**Why it exists:** Renders the **desktop overlay icon button** that appears on product card images on hover. Styled identically to the quick-add button.

**Responsibility:**
- Renders a `<button class="compare-icon-button">` with data attributes carrying the product's `id`, `handle`, `title`, and `image` (100px thumbnail URL).
- Includes all its own CSS via `{% stylesheet %}`.
- The button is absolutely positioned over the product card image, hidden by default (`opacity: 0; display: none`), becoming visible on desktop (`display: flex` at ≥750px) and animating in on `product-card:hover` or `:focus-within`.
- When `data-compare-active="true"` (set by `compare.js`), the button visually fills to indicate the product is already in the compare list.

**Language:** Liquid, HTML, CSS (via `{% stylesheet %}`).

**Reusable:** Specific to the compare feature but structured as a reusable snippet.

**Rendered by:** `blocks/_product-card-gallery.liquid` (line 31), guarded by `{% if settings.product_compare_toggle %}`.

**Interacts with:** `compare.js` — the click on this button is caught by the delegated listener on `document` (line 25-32 of compare.js). The `data-compare-active` attribute is set/unset by `updateIconButtons()`.

---

### `snippets/compare-toggle.liquid`

**Why it exists:** Renders the **mobile checkbox toggle** for the compare feature. On mobile screens where the hover icon is hidden, users need an alternative way to add products to compare.

**Responsibility:**
- Renders a `<div class="compare-toggle">` with data attributes (same four as the icon button).
- Contains a `<label>` wrapping a `<input type="checkbox" class="compare-toggle-input">` and a text label using the `compare.compare_label` locale string.
- Includes CSS via `{% stylesheet %}`: **hidden on desktop (≥750px), visible on mobile (≤749px)**.
- Guards its own rendering with `{% if comparetoggle %}` where `comparetoggle = settings.product_compare_toggle`.

**Language:** Liquid, HTML, CSS.

**Reusable:** Specific to the compare feature.

**Rendered by:** `blocks/_product-card.liquid` (line 14).

**Interacts with:** `compare.js` — checkbox `change` events are caught by the delegated listener (line 17-22). The `checked` state is synced by `updateCheckboxes()`.

---

### `blocks/_product-card.liquid`

**Why it exists:** Shopify theme block that assembles a complete product card. Relevant to compare because it is where `compare-toggle` is rendered.

**Responsibility (compare-relevant):**
- Calls `{% render 'compare-toggle', product: product %}` on line 14 — this places the mobile checkbox below every product card.

**Language:** Liquid, JSON schema.

**Reusable:** General product card block, not compare-specific, but it is a required host for the compare toggle snippet.

---

### `blocks/_product-card-gallery.liquid`

**Why it exists:** Shopify theme block rendering the product card's image/gallery area. Relevant to compare because it is where `compare-icon-button` is rendered.

**Responsibility (compare-relevant):**
- On lines 30-32, guards with `{% if settings.product_compare_toggle %}` and calls `{% render 'compare-icon-button', product: product %}`.
- This places the desktop overlay icon button inside the card gallery, absolutely positioned above the image.

**Language:** Liquid, JSON schema.

**Reusable:** General product card gallery block, not compare-specific.

---

### `snippets/header-actions.liquid`

**Why it exists:** Renders all header action icons (cart, account, compare). Relevant to compare because it renders the header compare link and bubble counter.

**Responsibility (compare-relevant):**
- Captures the compare icon HTML into a Liquid variable `compare_icon` (lines 66-92):
  - The `icon-compare.svg` inlined.
  - A `.compare-bubble` div (reuses cart bubble styles) with `.compare-bubble-count` span initially showing `0` and `display: none`.
- Conditionally renders the `<a class="action__compare">` link (lines 94-104) only when `section.settings.show_compare == true`.
- The link's `href` starts as `/pages/compare` and is dynamically updated by `compare.js`'s `updateHeaderBubble()` to include `?ids=...`.

**Language:** Liquid, HTML, CSS (via `{% stylesheet %}`).

**Reusable:** General header actions snippet. Compare is one feature within it.

**Interacts with:**
- `compare.js` — `updateHeaderBubble()` sets `bubble.textContent`, `container.style.display`, and `link.href`.
- `sections/header.liquid` — the `show_compare` setting in the header schema controls whether the link renders.

---

### `config/settings_schema.json` (compare-relevant portion)

**Why it exists:** Defines all global theme settings available in the Shopify admin Theme Settings panel.

**Compare-relevant setting:**
```json
{
  "type": "checkbox",
  "id": "product_compare_toggle",
  "label": "t:settings.product_compare",
  "default": false
}
```

Located under the `"Product Cards"` settings group. When **enabled**, product cards render both `compare-toggle` (mobile) and `compare-icon-button` (desktop). When **disabled**, neither snippet renders.

**Current value in `settings_data.json`:** `"product_compare_toggle": true` — compare is **active** in the current theme configuration.

---

### `sections/header.liquid` (compare-relevant schema portion)

**Why it exists:** The header section's schema defines a `show_compare` checkbox setting (lines 1284-1290) that controls whether the compare icon appears in the header actions area.

**Setting definition:**
```json
{
  "type": "checkbox",
  "id": "show_compare",
  "label": "t:settings.compare_icon",
  "default": true
}
```

This is a **section-level** setting (not global), meaning it can be set per header instance in the theme editor.

---

### `locales/en.default.json` (compare strings)

**Why it exists:** Provides all translatable strings for the compare feature.

**Strings defined:**
```json
"compare": {
  "compare_label": "Compare",
  "compare_tabel": {
    "compare_table_heading": "Comparing Products",
    "compare_table_loading": "Loading comparison data..",
    "description": "Description",
    "availability": "Availability",
    "in_stock": "In Stock",
    "out_of_stock": "Out of Stock",
    "not_available": "N/A",
    "sku": "SKU",
    "vendor": "Vendor/Brand",
    "view_product": "View product",
    "remove_product_btn": "Remove"
  }
}
```

> [!WARNING]
> There is a **typo in the locale key**: `"compare_tabel"` (should be `"compare_table"`). This is used consistently throughout the codebase, so changing it would require updating all callers simultaneously.

---

## Complete Data & Execution Flow

### Page Load Flow (Collection / Product Listing)

```
1. Browser loads page
2. Shopify renders:
   - compare-bar section (empty <compare-bar hidden>) 
   - header-actions snippet (compare link + bubble, hidden)
   - For each product card:
     - blocks/_product-card-gallery.liquid → compare-icon-button.liquid
     - blocks/_product-card.liquid → compare-toggle.liquid
3. compare.js loads (defer)
4. CompareManager constructor runs:
   a. loadFromStorage()      → reads localStorage["compareProducts"]
   b. updateCheckboxes()     → sets checked state on all .compare-toggle-input
   c. renderCompareBar()     → calls compare-bar.update() 
   d. updateHeaderBubble()   → sets bubble count + header link href
   e. updateIconButtons()    → sets data-compare-active on .compare-icon-button
   f. Registers delegated event listeners on document
   g. Registers shopify:section:load listener (editor reloads)
   h. Registers pageshow listener (BFcache)
```

### Product Added Flow (desktop icon button click)

```
User hovers product card → .compare-icon-button becomes visible (CSS)
User clicks icon button
  → document "click" listener fires (compare.js line 25)
  → target.closest('.compare-icon-button') resolves the button element
  → handleIconButtonClick(btn) called
     ├─ Read product data from btn.dataset (id, handle, title, image)
     ├─ Check if already selected → if yes, remove; if no, add
     ├─ saveToStorage()
     │   ├─ localStorage.setItem("compareProducts", JSON.stringify(...))
     │   ├─ updateCheckboxes()   → syncs mobile checkboxes
     │   ├─ renderCompareBar()   → updates floating bar HTML
     │   ├─ updateHeaderBubble() → updates count + link
     │   ├─ updateIconButtons()  → highlights active icon
     │   └─ dispatchEvent(compare:updated)
     └─ showToast("Product added to compare")
```

### Product Added Flow (mobile checkbox toggle)

```
User taps checkbox → change event fires
  → document "change" listener fires (compare.js line 17)
  → target.classList.contains('compare-toggle-input') → true
  → handleToggle(target) called
     ├─ Read product data from .compare-toggle parent dataset
     ├─ If checked: push to selectedProducts (check max limit)
     ├─ If unchecked: filter out from selectedProducts
     ├─ saveToStorage() [same cascade as above]
     └─ showToast(...)
```

### Compare Page Flow

```
User clicks "Compare Now" in compare bar
  → navigates to /pages/compare?ids=123,456,789

Server renders:
  - layout/theme.liquid (full page structure)
  - templates/page.compare-page.json
    → sections/compare-table.liquid (with #CompareTableContainer)
  - compare-bar section (floating bar, gets re-initialized)

DOMContentLoaded fires in compare-table.liquid inline script:
  1. Parse ?ids= from URL → ["123","456","789"]
  2. Build search query: "id:123 OR id:456 OR id:789"
  3. fetch("/search?q=id:123 OR id:456 OR id:789&view=compare")
     → Shopify routes request to templates/search.compare.liquid
     → Returns HTML fragment: <table class="compare-table">...</table>
  4. #CompareTableContainer.innerHTML = html
  
If only 1 product: JavaScript appends placeholder column

compare.js also loads on this page:
  → updateHeaderBubble(), renderCompareBar(), etc. re-initialized from localStorage
  → Delegated listener catches clicks on .compareTable-removeProduct buttons
     → removeProduct(id) removes from localStorage + updates URL via history.replaceState
     → dispatchEvent(compare:updated) → compare-table inline script re-fetches table
```

---

## Important Functions Reference

| Function | Location | Purpose |
|---|---|---|
| `CompareManager.constructor()` | `compare.js:3` | Loads storage, runs init |
| `CompareManager.init()` | `compare.js:10` | Sets up all DOM listeners |
| `CompareManager.loadFromStorage()` | `compare.js:62` | Reads + validates localStorage |
| `CompareManager.saveToStorage()` | `compare.js:80` | Persists + triggers all UI updates |
| `CompareManager.handleToggle(checkbox)` | `compare.js:89` | Handles mobile checkbox change |
| `CompareManager.handleIconButtonClick(btn)` | `compare.js:141` | Handles desktop icon button click |
| `CompareManager.updateCheckboxes()` | `compare.js:130` | Syncs checkbox states from memory |
| `CompareManager.updateIconButtons()` | `compare.js:167` | Syncs icon button active state |
| `CompareManager.removeProduct(id)` | `compare.js:178` | Removes a product, updates URL on compare page |
| `CompareManager.clearAll()` | `compare.js:194` | Clears all products, updates URL |
| `CompareManager.getCompareUrl()` | `compare.js:205` | Returns `/pages/compare?ids=...` |
| `CompareManager.showToast(msg)` | `compare.js:211` | Shows/updates floating toast notification |
| `CompareManager.renderCompareBar()` | `compare.js:227` | Calls `compare-bar.update()` on all bars |
| `CompareManager.updateHeaderBubble()` | `compare.js:235` | Updates header count badge + link href |
| `compare-bar.update(products)` | `compare.js:292` | Shows/hides bar, stores products, calls render |
| `compare-bar.render()` | `compare.js:303` | Generates full bar innerHTML from JS template |
| `compare-bar.toggleMinimize()` | `compare.js:287` | Toggles `data-minimized` attribute |
| `renderTable(ids)` _(inline)_ | `compare-table.liquid:28` | Fetches + injects compare table HTML |

---

## How LocalStorage is Used

**Key:** `"compareProducts"`

**Format:** JSON array of product objects:
```json
[
  {
    "id": "7890123456789",
    "handle": "blue-widget",
    "title": "Blue Widget",
    "image": "https://cdn.shopify.com/s/files/.../blue-widget_100x.jpg"
  }
]
```

**Max items:** 40 (enforced in `handleToggle`, `handleIconButtonClick`, and capped in `loadFromStorage`).

**IDs are always stored as strings** — `String(p.id)` normalization happens on load and on every write.

**Lifecycle:**
- Written by `saveToStorage()` on every add/remove.
- Read by `loadFromStorage()` on page load and BFcache restoration (`pageshow` with `persisted: true`).
- Never cleared automatically — persists until the user uses "Clear All" or removes all products individually.

---

## How the Compare Bar Works

The `<compare-bar>` is a **Custom Element** (Web Component without Shadow DOM). It:

1. **Starts hidden** — rendered server-side with the `hidden` attribute.
2. **Gets updated** when `CompareManager.renderCompareBar()` calls `bar.update(products)`:
   - If `products` is empty → `bar.setAttribute('hidden', '')` → bar disappears.
   - If products exist → `bar.removeAttribute('hidden')` → bar appears.
3. **Renders its full inner HTML via JavaScript** — product thumbnails, remove buttons, "Compare Now" CTA, minimize button, clear all button.
4. **Minimized state** — toggled via `data-minimized="true"` attribute. In minimized state, the full bar is hidden and a small pill button in the corner is shown (CSS-driven via `[data-minimized='true']` selectors).
5. **Responsive layout:**
   - Desktop: fixed, centered at bottom, max-width 40%.
   - Mobile: full-width, anchored to bottom edge.

---

## How the Compare Page Receives Product IDs

1. When the user clicks "Compare Now" in the compare bar, `getCompareUrl()` builds:
   ```
   /pages/compare?ids=7890123456789,9876543210987
   ```
2. The `sections/compare-table.liquid` inline script reads the URL on `DOMContentLoaded`:
   ```js
   const urlParams = new URLSearchParams(window.location.search);
   const idsString = urlParams.get('ids'); // "7890123456789,9876543210987"
   const ids = idsString.split(',').filter(id => id.trim() !== '');
   ```
3. IDs are passed to `renderTable(ids)` which constructs the Search API query.

**Dynamic updates after initial load:** When the user removes a product on the compare page, `removeProduct()` uses `window.history.replaceState` to update the URL silently, then fires `compare:updated` which triggers `renderTable` again.

---

## How Product Data is Rendered

**Fetch mechanism:** The compare table uses Shopify's Search API with an alternate view template:
```
/search?q=id:123 OR id:456&view=compare
```

This hits `templates/search.compare.liquid` which:
1. Uses `{% layout none %}` — no wrapping HTML.
2. Uses `search.results` — Shopify provides full product Liquid objects based on the search query.
3. Renders a complete `<table class="compare-table">` in a single loop.

**Product attributes rendered:** Image, Title, Price, Description, Availability, SKU, Vendor, Type, Options (with values), Collections, Tags, View Product + Remove buttons.

**Fallback:** Any missing field shows `{{ 'compare.compare_tabel.not_available' | t }}` → "N/A".

---

## How the Header Compare Link Works

1. **Liquid renders** the `<a class="action__compare" href="/pages/compare">` link inside `header-actions.liquid` — but only if `section.settings.show_compare == true`.
2. The bubble `<div class="compare-bubble" style="display: none">` is initially hidden.
3. On `compare.js` load, `updateHeaderBubble()` runs:
   - Sets `.compare-bubble-count` text to the current count.
   - Shows/hides `.compare-bubble` with `display: flex` / `display: none`.
   - Updates `.action__compare` href to `getCompareUrl()` (with `?ids=...`).
4. On every `saveToStorage()`, `updateHeaderBubble()` is called again to keep everything in sync.

---

## Feature Initialization on Page Load

```
Browser parses HTML
    ↓
Shopify renders all Liquid (section shells, snippets, data attributes on elements)
    ↓
compare.js loads (defer — after DOM is ready)
    ↓
CompareManager constructor → init()
    ├─ loadFromStorage()           reads localStorage
    ├─ updateCheckboxes()          marks checked/unchecked
    ├─ renderCompareBar()          shows bar if products exist
    ├─ updateHeaderBubble()        shows count badge
    ├─ updateIconButtons()         marks active icons
    └─ Attaches event listeners:
        ├─ document:change         (toggle checkboxes)
        ├─ document:click          (icon buttons + remove buttons + clear + minimize)
        ├─ document:shopify:section:load   (Theme Editor support)
        └─ window:pageshow         (BFcache restoration)
```

---

## Dependencies and Execution Order

```
settings_schema.json
  └─ product_compare_toggle (global setting)
       ├─ _product-card-gallery.liquid reads it → renders compare-icon-button.liquid
       └─ _product-card.liquid reads it → renders compare-toggle.liquid

header.liquid schema
  └─ show_compare (section setting)
       └─ header-actions.liquid reads it → renders <a class="action__compare">

[Page Load Order]
1. Server: Liquid renders shells + data attributes
2. Client: compare.js defers, then runs
3. Client: CompareManager singleton created, all UI synced from localStorage

[Compare Page Only]
4. DOMContentLoaded → inline JS in compare-table.liquid fires
5. Fetch to /search?view=compare → search.compare.liquid generates table HTML
6. compare.js also initializes → handles remove/clear from table page

[Custom Event Bus]
compare.js → dispatches "compare:updated"
compare-table.liquid → listens to "compare:updated" → re-renders table
```

---

## Extending the Feature Safely

### Add a new column to the compare table
Edit `templates/search.compare.liquid`. Add a new `<tr>` in `<tbody>` following the existing pattern:
```liquid
<tr class="compareTable-row">
  <th class="compareTable-heading">Weight</th>
  {% for product in search.results %}
    {% if product.object_type == 'product' %}
      <td class="compareTable-item">
        {% if product.variants.first.weight > 0 %}
          {{ product.variants.first.weight }} {{ product.variants.first.weight_unit }}
        {% else %}
          {{ 'compare.compare_tabel.not_available' | t }}
        {% endif %}
      </td>
    {% endif %}
  {% endfor %}
</tr>
```

### Add compare to a new product listing section
Ensure the new section renders product cards using `_product-card` and `_product-card-gallery` blocks. That's all — the blocks already include the compare snippets conditionally.

### Add compare bar to a new page template
In the relevant JSON template file, add a `compare-bar` section entry:
```json
"compare_bar_XXXX": {
  "type": "compare-bar",
  "settings": {}
}
```
And add the key to the `"order"` array.

### Listen to compare events in custom JS
```js
document.addEventListener('compare:updated', (e) => {
  const products = e.detail; // array of { id, handle, title, image }
  // your logic here
});
```

### Increase the maximum compare limit
Change `this.maxProducts = 40;` in `compare.js` line 5. Shopify's Search API has no documented hard limit on query size, but very large `OR` chains may hit URL length limits (~2000 chars).

---

## Known Limitations & Improvement Areas

> [!WARNING]
> **LocalStorage dependency** — Compare state is stored only in the browser. It is lost when clearing browser data, is not shared across browsers/devices, and is not tied to the user's Shopify account.

| # | Issue | Impact | Suggestion |
|---|---|---|---|
| 1 | `compare-toast` has **no CSS defined** anywhere (not in `base.css`, not in `compare-bar.liquid`). The `.show` class is toggled but there are no visual styles for the toast element. | Toast is invisible to users. | Add CSS for `.compare-toast` and `.compare-toast.show` in `compare-bar.liquid` or `base.css`. |
| 2 | Locale key typo: `compare_tabel` should be `compare_table`. | Technical debt, error-prone in future edits. | Rename consistently in both `en.default.json` and all callers. |
| 3 | `compare-bar.liquid` is placed in `collection.json`, `product.json`, and `index.json` but **not** in `search.json` or other product-listing templates. | Users browsing search results cannot see the bar. | Add the compare-bar section to all templates where product cards appear. |
| 4 | `search.compare.liquid` loops `search.results` but does **not** limit results to the IDs requested. If Shopify's search returns unexpected results, the table may show unintended products. | Potential data display mismatch. | Add a filter step or validate `product.id` against the requested IDs array (requires passing IDs into the Liquid context). |
| 5 | The compare table has **no max-width capping per column** when many products are selected. With 40 products, the table is unusable. | UX degradation at high product counts. | Enforce a practical UI limit (e.g., 4-6 products) separately from the `maxProducts` storage limit. |
| 6 | `"Product Type"` and `"Options"` and `"Collections"` and `"Tags"` row headers in `search.compare.liquid` are **hardcoded English strings**, not using the locale filter. | Not translatable. | Add corresponding locale keys and use `{{ 'compare.compare_tabel.type' | t }}` etc. |
| 7 | The compare bar renders inline SVG for the close icon in `compare.js` (line 317) — **hardcoded**, not using `icon-close.svg` asset. | Inconsistent icon management. | Consider using the shared icon asset via data attributes or a JS helper. |
| 8 | `console.log` statements left in production code (`compare.js` lines 95, 116, 126). | Performance noise, potential info exposure. | Remove or wrap in a `DEBUG` flag. |

---

## Best Practices for Maintenance

1. **Never modify `search.compare.liquid` structure without testing** the `renderTable()` JS in `compare-table.liquid`. The JS relies on `thead tr` and `tbody tr` selectors for the single-product placeholder injection.

2. **Always test BFcache behavior** (using the browser back button from the compare page back to a collection). `compare.js` handles this via `pageshow` event, but any new state must also be refreshed in this handler.

3. **Theme Editor testing:** After any change to `compare-bar.liquid`, test in the Shopify Theme Editor because `shopify:section:load` fires on every editor update and re-calls `updateCheckboxes()` and `updateIconButtons()`.

4. **Guard against duplicate script execution.** Both `compare-bar.liquid` and `compare-table.liquid` load `compare.js`. The existing `if (typeof window.CompareManager === 'undefined')` and custom element guards prevent double-initialization — **do not remove these guards**.

5. **Keep product data attributes consistent.** The four data attributes (`data-product-id`, `data-product-handle`, `data-product-title`, `data-product-image`) must be present on both `.compare-toggle` and `.compare-icon-button` for JS to function. Always pass the same `product` object to both snippets.

6. **ID type safety.** All product IDs are coerced to strings (`String(p.id)`) in both `handleToggle`, `handleIconButtonClick`, and `loadFromStorage`. Maintain this convention — Shopify product IDs are large integers that can lose precision as JS `number` types.

7. **LocalStorage quota.** With `maxProducts: 40`, each entry stores 4 fields. Typical image URLs from Shopify CDN are ~80–100 chars. Estimated max storage ≈ 40 × ~250 bytes ≈ 10KB — well within the 5MB localStorage limit.

8. **Adding new locale strings:** Always add to `en.default.json` first (the source of truth), then propagate to other locale files.

---

*This documentation was generated through static code analysis of the Shopify theme at `d:\2026\shopify\Horizon Feature\shopify-theme-develop`. No code was modified.*
