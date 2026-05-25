# Favicon Setup for AssetMem AI

The favicon has been updated to match the AssetMem AI branding.

## Current Setup

- **icon.svg** - Modern SVG icon (works in all modern browsers)
- **favicon.ico** - Legacy favicon for older browsers (existing file)

## Branding Details

- **Primary Color**: `rgb(8, 142, 175)` (teal/cyan blue)
- **Design**: House icon with AI sparkle element
- **Style**: Modern, clean, rounded square background

## Generating Additional Formats

To generate PNG and other formats from the SVG icon, you can use the provided script:

```bash
# Install sharp (one-time setup)
npm install --save-dev sharp

# Generate all icon formats
node scripts/generate-favicon.js
```

This will create:
- `icon.png` (512x512) - For modern browsers
- `apple-icon.png` (180x180) - For Apple devices
- `favicon.ico` (32x32) - Updated favicon

## Next.js App Router

Next.js 13+ App Router automatically serves icon files from the `src/app` directory:
- `icon.svg` → `/icon.svg`
- `icon.png` → `/icon.png`
- `apple-icon.png` → `/apple-icon.png`
- `favicon.ico` → `/favicon.ico`

The metadata in `layout.tsx` has been updated to reference these icons properly.

