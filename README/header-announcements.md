# Header Announcements Enhancement

## Overview
This update enhances the announcement bar to support right-side content blocks, allowing you to display phone numbers, email addresses, and social media links alongside your announcement text. The layout now supports a flexible left + right section design while maintaining full backward compatibility with existing setups.

## Key Features
- **Left Section**: Announcement text with optional slideshow and navigation arrows
- **Right Section**: Phone, Email, and Social Media blocks
- **Responsive Design**: Adapts seamlessly across desktop, tablet, and mobile devices
- **Backward Compatibility**: Existing announcement bars continue to work without changes

## How to Use
Go to:
Online Store → Themes → Customize → Header → Announcement Bar

### Step 1: Add Announcement Blocks
1. In the theme customizer, select the Announcement Bar section
2. Add blocks for your content:
   - **Announcement**: For text content (existing)
   - **Phone**: For phone number display
   - **Email**: For email address
   - **Social Media**: For social links

### Step 2: Configure Phone Block
- Enter phone number in the text field
- The block automatically creates a clickable `tel:` link
- Optional icon support (uses theme's icon system if available)

### Step 3: Configure Email Block
- Enter email address
- Automatically creates a clickable `mailto:` link

### Step 4: Configure Social Media Block
- Uses existing Horizon social links component
- If not available, provides fields for:
  - Facebook
  - Instagram
  - Twitter/X
  - Other platforms
- Only displays links that are configured

### Step 5: Adjust Layout Settings
- **Speed**: Control slideshow speed (2-10 seconds)
- **Show Arrows**: Enable/disable navigation arrows
- **Section Width**: Choose page-width or full-width
- **Color Scheme**: Select theme color scheme
- **Divider Thickness**: Set bottom border width
- **Padding**: Adjust top/bottom spacing

## Layout Behavior
- **Desktop (>1024px)**: 65% left content, 35% right content
- **Tablet (750px-1024px)**: 55% left, 43% right
- **Mobile (<750px)**: Stacked layout, right content hidden on very small screens

## How It Works
The announcement bar uses JavaScript to dynamically move right-side blocks from the slides container to a dedicated right content area. This ensures:

1. **Initial Load**: Content is hidden to prevent layout shift
2. **JavaScript Execution**: Blocks are moved to correct positions
3. **Class Toggle**: `.announcement-bar-wrapper--has-right` class applied when right content exists
4. **Responsive Adjustments**: CSS handles different screen sizes

### Block Types
- `_announcement`: Standard text announcements
- `bliss-announcement-phone`: Phone number with tel: link
- `bliss-announcement-email`: Email with mailto: link
- `bliss-announcement-group`: Social media links

## Files Updated
- `sections/header-announcements.liquid`: Main section file with enhanced layout and JavaScript
- `blocks/_announcement.liquid`: announcement block template
- `blocks/bliss-announcement-phone.liquid`: Phone block template
- `blocks/bliss-announcement-email.liquid`: Email block template
- `blocks/bliss-announcement-group.liquid`: Social media block template

## Reference Screenshots
- Main Layout arrow option: https://screenshots.projectdemo.company/ZSXqXi4ZWE
- Phone Block: https://screenshots.projectdemo.company/Y823vgft4T
- Email Block: https://screenshots.projectdemo.company/Ldh3IXJl76
- Social Media Block: https://screenshots.projectdemo.company/6CHGQMrhMZ
- Mobile View: https://screenshots.projectdemo.company/cZS2Jg9YpU
- Customiztion View: https://screenshots.projectdemo.company/BMqhrVsKlR

## Technical Details
### Schema Configuration
- Supports all standard Shopify block types
- Uses richtext for flexible content input
- Follows Shopify schema validation rules
- No default richtext errors

### CSS Architecture
- Uses CSS custom properties for dynamic values
- Flexbox layout with responsive breakpoints
- Visibility controls to prevent flicker
- Optimized for performance

### JavaScript Implementation
- DOM manipulation for block positioning
- Event listeners for Shopify editor integration
- Section load/reload handling
- Block select/deselect support

## Notes
- Right content blocks are automatically positioned on the right side
- Layout adjusts dynamically based on content presence
- All links are properly formatted (tel:, mailto:)
- Icons use theme's existing icon system
- No additional dependencies required

## Summary
This enhancement provides a professional, flexible announcement bar solution that integrates seamlessly with the Horizon theme. It offers improved user experience through better content organization while maintaining the theme's design standards and performance.