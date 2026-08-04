# Bliss Product Tabs Feature Documentation

A lightweight guide to the dynamic **Bliss Product Tabs & Accordion** feature built for the Product Detail Page (PDP).

---

## 1. Feature Overview

The Bliss Product Tabs feature allows merchants to organize product details (Description, Metafields, Rich Text, or Page Content) into either a **Tabs** layout or an **Accordion** layout.

### How It Works
- **Tabs Mode (`Tabs`)**:
  - **Desktop (≥ 750px)**: Renders a horizontal navigation bar at the top with clickable tab buttons. Only the active tab content is displayed.
  - **Mobile (< 750px)**: Automatically switches to standard stacked accordions for optimal mobile UX.
- **Accordion Mode (`Accordion`)**:
  - **Desktop & Mobile**: Shared across all screen sizes. Displays stacked accordion panels using the theme's native `<accordion-custom>` Web Component, skipping tab navigation generation and extra JavaScript overhead.

---

## 2. File Architecture & Data Flow

```
Product Detail Page (PDP)
 └── blocks/_product-details.liquid (Parent Container)
      └── blocks/bliss-product-tabs.liquid (Parent Block: Tabs Wrapper & Settings)
           │   ├── Renders <product-tabs data-display-style="...">
           │   ├── Loads assets/bliss-product-tabs.js
           │   └── Renders child blocks:
           └── blocks/_bliss-tab.liquid (Child Block: Resolves content & wraps in <details>)
                └── Renders snippets/accordion-custom-component.liquid (<accordion-custom>)
```

---

## 3. Responsible Files

| File Path | Role & Description |
| :--- | :--- |
| **[blocks/bliss-product-tabs.liquid](blocks/bliss-product-tabs.liquid)** | Parent block. Handles theme settings (`display_style`, colors, padding), loads `bliss-product-tabs.js`, and holds the scoped CSS rules. |
| **[blocks/_bliss-tab.liquid](blocks/_bliss-tab.liquid)** | Child block. Resolves content dynamically (Product Description, Metafield, Rich Text, Page) and wraps it inside `<details>` and `<accordion-custom>`. |
| **[assets/bliss-product-tabs.js](assets/bliss-product-tabs.js)** | Web Component (`<product-tabs>`). In `Tabs` mode, builds desktop tab buttons, manages ARIA states, handles keyboard arrow navigation, and syncs responsive states. |
| **[blocks/_product-details.liquid](blocks/_product-details.liquid)** | PDP container block schema. Registers `bliss-product-tabs` so merchants can add it to product templates. |

---

## 4. Display Style Setting (Tabs vs Accordion)

Controlled via the **Display Style** setting in `bliss-product-tabs.liquid` schema:

1. **`display_style = "tabs"`**:
   - Liquid sets `data-display-style="tabs"`.
   - `<product-tabs>` JS initializes horizontal tab buttons on desktop and manages active panel visibility.
   - CSS shows `.product-tabs__nav` on desktop and hides summary headers.
2. **`display_style = "accordion"`**:
   - Liquid sets `data-display-style="accordion"`.
   - `<product-tabs>` JS detects accordion mode and **skips** tab button generation and keydown listeners.
   - Theme's native `<accordion-custom>` JS (`assets/accordion-custom.js`) handles all click expand/collapse behavior on both desktop and mobile natively.

---

## 5. Customization Guide for Developers

### Adding a New Content Source
To add a new content option (e.g. "Custom HTML"):
1. Edit `blocks/_bliss-tab.liquid`.
2. Add the option to the `content_source` select schema options.
3. Add a corresponding Liquid `when` case in `_bliss-tab.liquid` to render the content.

### Styling & Theme Integration
- Underline color for active tab buttons can be customized per block using `border_color` in theme settings.
- Scoped CSS rules in `bliss-product-tabs.liquid` utilize theme CSS variables (`--color-foreground-rgb`, `--gap-lg`, `--color-border`) for full theme design consistency.