---
name: Neon Velocity
colors:
  surface: '#151022'
  surface-dim: '#151022'
  surface-bright: '#3c364a'
  surface-container-lowest: '#100b1d'
  surface-container-low: '#1e192b'
  surface-container: '#221d2f'
  surface-container-high: '#2c273a'
  surface-container-highest: '#373246'
  on-surface: '#e8def8'
  on-surface-variant: '#cdc4cc'
  inverse-surface: '#e8def8'
  inverse-on-surface: '#332d41'
  outline: '#968e96'
  outline-variant: '#4b454c'
  surface-tint: '#d7bee2'
  primary: '#d7bee2'
  on-primary: '#3b2a46'
  primary-container: '#0d0118'
  on-primary-container: '#857090'
  inverse-primary: '#6b5776'
  secondary: '#ddfcff'
  on-secondary: '#00363a'
  secondary-container: '#00f1fe'
  on-secondary-container: '#006a70'
  tertiary: '#d1bcff'
  on-tertiary: '#3c0090'
  tertiary-container: '#090022'
  on-tertiary-container: '#8a52ff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#f4daff'
  primary-fixed-dim: '#d7bee2'
  on-primary-fixed: '#251530'
  on-primary-fixed-variant: '#52405d'
  secondary-fixed: '#74f5ff'
  secondary-fixed-dim: '#00dbe7'
  on-secondary-fixed: '#002022'
  on-secondary-fixed-variant: '#004f54'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d1bcff'
  on-tertiary-fixed: '#23005b'
  on-tertiary-fixed-variant: '#5700c9'
  background: '#151022'
  on-background: '#e8def8'
  surface-variant: '#373246'
typography:
  display-xl:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-bold:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.1em
  currency-display:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: -0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 16px
  margin: 20px
---

## Brand & Style

This design system is built for a high-energy, futuristic rewards ecosystem. The brand personality is "Hyper-Digital Luxury"—combining the excitement of gaming aesthetics with the prestige of a premium loyalty program. It targets a tech-savvy, younger demographic that values speed, visual feedback, and exclusivity.

The visual style is a hybrid of **Glassmorphism** and **Vaporwave-Modernism**. It utilizes deep, immersive dark backgrounds to make neon accents "pop," creating a sense of infinite depth. The emotional response should be one of "dopamine-driven achievement," where every reward feels like a digital trophy earned in a high-stakes environment.

## Colors

The palette is anchored in a tiered dark mode strategy. The primary background is a near-black "Void Purple," providing the perfect canvas for high-chroma accents.

- **Deep Purples:** Used for base surfaces and tonal depth. The core background is `#0D0118`.
- **Neon Cyan:** The primary action and "currency" color. It signifies value, liquidity, and interaction.
- **Electric Violet:** Used for secondary highlights and "Tier" progression indicators.
- **Gradients:** Use linear 45-degree gradients transitioning from Electric Violet to Neon Cyan to represent premium states or "leveling up."

## Typography

This design system utilizes a high-contrast typographic pairing to balance technical precision with user approachability.

**Space Grotesk** is the primary driver for headlines and labels. Its geometric, slightly eccentric letterforms evoke a "space-age" feel. For all currency values and reward counts, use `currency-display` with tight kerning to emphasize importance.

**Be Vietnam Pro** serves as the body typeface. It provides high legibility on dark backgrounds and maintains a friendly, contemporary tone for descriptive text and terms of service.

## Layout & Spacing

The system follows a **12-column fluid grid** for desktop and a **4-column grid** for mobile. The spacing rhythm is based on an 8px scale to ensure mathematical harmony across all screen sizes.

- **Content Grouping:** Use larger vertical spacing (40px+) between major reward categories to create a rhythmic scrolling experience.
- **Card Padding:** Standardize on 24px (md) internal padding for cards to allow the "glass" edges room to breathe against the background.
- **Visual Hierarchy:** Important currency widgets should span the full width of the mobile container, while reward chips can be arranged in a side-scrolling horizontal carousel.

## Elevation & Depth

This design system rejects traditional drop shadows in favor of **Tonal Layering** and **Glassmorphism**. Depth is created through three primary methods:

1.  **Backdrop Blurs:** Floating cards and modals must use a background blur (minimum 20px) with a semi-transparent purple fill (e.g., `rgba(25, 10, 45, 0.7)`).
2.  **Inner Glows:** Instead of outer shadows, use 1px inner borders (top and left) in a lighter violet to simulate a light source hitting the edge of the "glass."
3.  **Neon Bloom:** Interactive elements like buttons and active reward cards should emit a soft, colored glow (shadow spread 15px, 20% opacity) matching their primary accent color.

## Shapes

The shape language is "Streamlined Geometric." We avoid sharp corners to maintain a premium, friendly feel, but use specific radii to denote hierarchy.

- **Standard Containers:** Use 0.5rem (rounded) for secondary items.
- **Main Reward Cards:** Use 1rem (rounded-lg) to create a more prominent, "collectible card" appearance.
- **Interactive Controls:** Buttons and Input fields use 1.5rem (rounded-xl) to feel tactile and approachable.
- **Progress Bars:** Should always be pill-shaped (full radius) to represent smooth, continuous movement.

## Components

### Buttons
Primary buttons are solid Neon Cyan with black `Space Grotesk` text. Secondary buttons use a "Ghost Glass" style: a 1px Cyan border with a blurred background. 

### Cards & Rewards
The "Reward Card" is the hero component. It features a subtle gradient background, a 20% opacity white inner border, and a "Glassmorphism" blur. Reward values (currency) are anchored to the top right in `label-bold`.

### Currency & Status
The "Points Balance" widget uses a high-gloss, deep purple container with a glowing Neon Cyan glow. The progress bar for "Next Tier" should use a dual-tone gradient fill (Violet to Cyan) and a subtle pulse animation when near completion.

### Inputs & Selection
Input fields are dark, inset containers with a 1px "Electric Violet" border that glows brighter when focused. Checkboxes and radios are reimagined as "Toggles" with a neon-on/neon-off state.

### Gamification Elements
Include "Badge" components that are hexagonal with glass-fill effects, and "Milestone" markers that appear as vertical glass pillars along a scrolling track.