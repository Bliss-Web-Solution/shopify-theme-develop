# Variant Picker Customization

## Overview
This update allows you to control how product variants (like Size, Color, Style) are displayed on the product page and product cards.
You can choose:
- **Buttons (Swatches)**
- **Dropdown**

You can also control this for each variant option separately.
## How to Use
Go to:
Customization → Product Page → Product Information → Variant Picker

### Step 1: Select Default Style
Choose the default display:
- Buttons  
- Dropdown  

### Step 2: Set Option-wise Display
You will see two fields:
#### 1. Options as buttons
Enter option names (comma-separated) to show as buttons.
Example:
Size, Color
#### 2. Options as dropdowns
Enter option names (comma-separated) to show as dropdown.
Example:
Style, Material

## Example
If you want:
- Size → Buttons
- Color → Buttons
- Style → Dropdown

Then:
- Set default = **Buttons**
- Add in "Options as dropdowns":
Style

## How It Works
- The system first takes the default style
- Then, it checks the option name

If it matches:
- "Options as buttons" → shows buttons
- "Options as dropdowns" → shows dropdown

Matching is:
- Case-insensitive
- Extra spaces are ignored

## Swatches
If swatches are enabled and available:
- Buttons will show as **swatches**
- Dropdown will show as a **swatch dropdown**

## Files Updated
- blocks/variant-picker.liquid
- snippets/variant-main-picker.liquid
- blocks/_product-card.liquid

## Refrance Screenshot
- snippets/variant-main-picker.liquid
https://screenshots.projectdemo.company/3JMUIzFUBB
https://screenshots.projectdemo.company/yyeRZVPfiQ
https://screenshots.projectdemo.company/vj2mrQz5Az

- blocks/variant-picker.liquid
https://screenshots.projectdemo.company/Rm44M5eVTo

- blocks/_product-card.liquid
https://screenshots.projectdemo.company/FFJVi2iGGP

- Customize Settings
https://screenshots.projectdemo.company/zU5ptxiPye

## Notes
- Write option names exactly (like Size, Color, Style)
- Separate multiple values using commas
- No coding needed after setup

## Summary
This feature gives flexibility to display each variant in the best way, improving both design and user experience.
