# Recently Added / New Product Badge — Shopify Horizon Theme

A complete guide to understanding, configuring, and maintaining the Recently Added / New Product Badge feature in the Shopify Horizon theme.

## Quick Summary (1-Minute Read)

- What it does: Automatically shows a "New" badge on products published within a set number of days (default: 30 days).
- Where it displays: On Product Cards (Collection Pages, Home Page Grids, Search) and the Product Detail Page (PDP) main image.
- Merchant Tags:
  - Add tag `new` to force show the badge on an older product.
  - Add tag `hide-new-badge` to force hide the badge on a new product.
- Theme Settings Location: Shopify Admin -> Online Store -> Customize -> Theme settings -> Badges -> Recently added products badge.
- Badge Priority: Out of Stock > On Sale > New.

---

## Overview

The Recently Added Badge automatically displays a "New" badge on products that were recently published in your Shopify store. 

### Key Capabilities
- Automatic Date Calculation: Uses `product.published_at` to automatically identify newly published products based on your chosen number of days.
- Tag Overrides for Merchants:
  - Add tag `new` to force show the badge on any product.
  - Add tag `hide-new-badge` to force hide the badge on any product.
- Badge Stacking Support: Choose whether to display both Sale and New badges side-by-side or stack them.

---

## Files Created & Modified

Here is a complete breakdown of every file changed in the theme and what it does:

### 1. `snippets/bliss-product-badges.liquid` *(NEW)*
- What it does: This is the brain of the badge system. It contains all the Liquid logic to check product publish date, evaluate merchant tags (`new` / `hide-new-badge`), handle badge stacking, and output the badge HTML.
- Why it was created: Instead of duplicating code in multiple places, putting the logic in one snippet keeps the theme clean, DRY (Don't Repeat Yourself), and easy to update.

### 2. `snippets/product-badges-styles.liquid` *(MODIFIED)*
- What it does: Contains the CSS styles for all product badges.
- What changed: Added styling rules for Multi-Badge Stacking layout (`.product-badges--stack`).

### 3. `config/settings_schema.json` *(MODIFIED)*
- What it does: Defines the settings controls that appear in Shopify Theme Customizer (Theme Settings).
- What changed: Added a new section under Badges with settings for:
  - Enabling/disabling the badge
  - Number of days threshold (1 to 90 days)
  - Custom badge text (e.g., "New", "Fresh", "Just Arrived")
  - Stacking mode toggle
  - Custom tag names for force-show and force-hide
  - Custom background and text colors

### 4. `config/settings_data.json` *(MODIFIED)*
- What it does: Stores default values for all theme settings.
- What changed: Added production default values for the new settings (e.g. `badge_new_enable: true`, `badge_new_days: 30`, `badge_new_text: "New"`).

### 5. `snippets/theme-styles-variables.liquid` *(MODIFIED)*
- What it does: Generates CSS variables dynamically from Theme Editor settings.
- What changed: Added a `contrast-override` helper block for `badge-new` so `--color-custom-badge-new` text and background colors render properly with high contrast.

### 6. `blocks/_product-card-gallery.liquid` *(MODIFIED)*
- What it does: Renders product images and overlays on Product Cards across collection pages, home page grids, search results, and recommendation sliders.
- What changed: Replaced inline badge markup with `{% render 'bliss-product-badges', product: product %}`.

### 7. `snippets/product-media-gallery-content.liquid` *(MODIFIED)*
- What it does: Renders the main product image/gallery on the Product Detail Page (PDP).
- What changed: Added `{% render 'bliss-product-badges', product: selected_product, style: 'z-index: 2;' %}` to overlay the badge on the primary product image.

### 8. `snippets/card-gallery.liquid` *(MODIFIED)*
- What it does: Handles image carousel/hover gallery container positioning for product cards.
- What changed: Updated the internal `has_badges` calculation so gallery spacing and quick-add controls automatically adjust when the New badge is active.

---

## How the "New" Date Calculation Works

The feature calculates the age of a product using Shopify Liquid timestamps:

```liquid
assign published_at_timestamp = product.published_at | date: '%s' | plus: 0
assign now_timestamp = 'now' | date: '%s' | plus: 0
assign age_in_seconds = now_timestamp | minus: published_at_timestamp
assign days_in_seconds = settings.badge_new_days | default: 30 | times: 86400

if age_in_seconds >= 0 and age_in_seconds <= days_in_seconds
  assign is_new_product = true
endif
```

1. `product.published_at | date: '%s'`: Converts product publish date to Unix timestamp (seconds).
2. `'now' | date: '%s'`: Gets the current Unix timestamp in seconds.
3. `age_in_seconds`: Subtracts published time from current time.
4. `days_in_seconds`: Converts configured days (e.g. 30 days) to seconds ($30 \times 86400 = 2,592,000$ seconds).
5. Comparison: If product age is non-negative and less than or equal to `days_in_seconds`, the product is tagged as New.

---

## Theme Editor Settings Reference

Navigate to Shopify Admin -> Online Store -> Themes -> Customize -> Theme settings (gear icon) -> Badges -> Recently added products badge:

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| Enable Recently Added badge | Checkbox | `true` | Turn the feature ON or OFF globally. |
| New product duration (days) | Range (1–90) | `30` | Number of days a product is considered "New". |
| Badge text | Text | `"New"` | Text label displayed inside the badge. |
| Allow showing alongside Sale badge | Checkbox | `false` | When enabled, products on Sale AND New show both badges stacked. |
| Tag to force show badge | Text | `"new"` | Product tag that forces badge display regardless of publish date. |
| Tag to force hide badge | Text | `"hide-new-badge"` | Product tag that hides badge regardless of publish date. |
| New badge background | Color | Theme Color 1 | Background color for the New badge. |
| New badge text | Color | Background Color | Text color for the New badge. |

---

## Merchant User Guide: How to Use Tag Overrides

### Case A: Hiding the "New" badge on a recently published product
*(Example: You uploaded an existing classic item or restocked product and don't want it marked as "New")*

1. Go to Shopify Admin -> Products.
2. Select the product.
3. Under Tags on the right panel, add `hide-new-badge`.
4. Click Save.
5. The badge will immediately disappear from that product.

### Case B: Forcing the "New" badge on an older product
*(Example: You want to re-promote a product published 60 days ago)*

1. Go to Shopify Admin -> Products.
2. Select the product.
3. Under Tags on the right panel, add `new`.
4. Click Save.
5. The badge will display on that product regardless of its original publish date.

---

## Badge Priority Rules

- Default Priority (Stacking OFF):
  `Sold Out` > `Sale` > `New`
  - If Out of Stock -> Displays Sold Out badge.
  - Elsif On Sale -> Displays Sale badge.
  - Elsif Published within $N$ days (or has `new` tag) -> Displays New badge.

- Stacking Priority (Stacking ON):
  - If Out of Stock -> Displays Sold Out badge.
  - If On Sale AND Recently Published -> Displays BOTH Sale and New badges stacked cleanly.

---

## Summary Checklist for Developers

- [x] Tested on **Product Cards** (Collection, Search, Home Page grids).
- [x] Tested on **Product Detail Page (PDP)** main gallery image.
- [x] Desktop, Tablet, and Mobile fully responsive.
- [x] Verified zero breaking changes to existing Sale & Sold Out badges.
- [x] Validated JSON schema in `settings_schema.json` & `settings_data.json`.
