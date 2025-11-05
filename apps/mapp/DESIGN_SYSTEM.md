# Design System Documentation

This document outlines the design system conventions and guidelines for the HomeApp mobile application.

## Table of Contents
- [Color System](#color-system)
- [Typography](#typography)
- [Icon Sizing](#icon-sizing)
- [Spacing & Layout](#spacing--layout)
- [Component Guidelines](#component-guidelines)
- [Best Practices](#best-practices)

---

## Color System

Our app uses a **semantic color system** powered by TailwindCSS and HSL color variables. Always use semantic tokens instead of hardcoded colors to ensure consistency and proper dark mode support.

### Semantic Colors

#### Base Colors
- `bg-background` / `text-foreground` - Main background and text
- `bg-card` / `text-card-foreground` - Card backgrounds
- `bg-secondary` / `text-secondary-foreground` - Secondary backgrounds
- `bg-muted` / `text-muted-foreground` - Muted/subtle elements

#### Interactive Colors
- `bg-primary` / `text-primary-foreground` - Primary actions (buttons, links)
- `bg-accent` / `text-accent-foreground` - Accent elements
- `border-border` - Borders and dividers
- `bg-input` - Input field backgrounds

#### Status Colors (NEW)
- `bg-info` / `text-info` / `text-info-foreground` - Informational (blue)
- `bg-success` / `text-success` / `text-success-foreground` - Success states (green)
- `bg-warning` / `text-warning` / `text-warning-foreground` - Warnings (orange)
- `bg-destructive` / `text-destructive` / `text-destructive-foreground` - Errors/destructive actions (red)

### Usage Examples

#### ✅ Correct Usage
```tsx
// Status indicator with semantic colors
<View className="bg-info/10">
  <Icon as={FileText} size={24} className="text-info" />
</View>

// Success message
<Text className="text-success">Upload complete</Text>

// Error state
<Icon as={AlertCircle} size={16} className="text-destructive" />
```

#### ❌ Incorrect Usage
```tsx
// DON'T use hardcoded colors
<View className="bg-blue-100">
  <Icon as={FileText} className="text-blue-500" />
</View>

// DON'T use arbitrary color values
<Text className="text-green-600">Upload complete</Text>
```

---

## Typography

Use TailwindCSS text utilities for consistent typography across the app.

### Text Sizes (Standard Scale)
- `text-xs` (12px) - Small labels, captions
- `text-sm` (14px) - Body text, secondary content
- `text-base` (16px) - Primary body text
- `text-lg` (18px) - Card headers, emphasis
- `text-xl` (20px) - Page titles
- `text-2xl` (24px) - Major headings

### Font Weights
- `font-normal` (400) - Body text
- `font-medium` (500) - Subtle emphasis
- `font-semibold` (600) - Buttons, headings
- `font-bold` (700) - Major headings

### Examples
```tsx
<Text className="text-base font-medium text-foreground">Primary content</Text>
<Text className="text-sm text-muted-foreground">Secondary info</Text>
<Text className="text-xl font-semibold text-foreground">Page Title</Text>
```

#### ❌ Don't Use Custom Sizes
```tsx
// DON'T use arbitrary pixel values
<Text className="text-[10px]">...</Text>
<Text className="text-[11px]">...</Text>
```

---

## Icon Sizing

Standardized icon sizes for consistent visual hierarchy using Lucide React Native icons.

### Standard Icon Sizes
- **12px** - Tiny icons in compact layouts (rare use)
- **16px** - Small icons in dense UI, inline with small text
- **20px** - Default icon size for most UI elements
- **24px** - Larger icons for cards, primary actions
- **32px** - Feature icons, empty states

### Usage Guidelines

```tsx
import { Icon } from '@/components/ui/icon';
import { FileText, Pencil, AlertCircle } from 'lucide-react-native';

// Small inline icon
<Icon as={FileText} size={16} className="text-muted-foreground" />

// Standard UI icon
<Icon as={Pencil} size={20} className="text-foreground" />

// Card feature icon
<Icon as={FileText} size={24} className="text-info" />

// Empty state icon
<Icon as={AlertCircle} size={32} className="text-muted-foreground" />
```

### Icon + Text Pairing
- `size={16}` with `text-xs` (12px)
- `size={20}` with `text-sm` (14px) or `text-base` (16px)
- `size={24}` with `text-lg` (18px)

---

## Spacing & Layout

### Border Radius
Use semantic border radius values from the theme:

- `rounded-sm` - Small elements (4px)
- `rounded-md` - Inputs, buttons (6px)
- `rounded-lg` - Cards, most components (8px)
- `rounded-xl` - Large cards (12px)
- `rounded-full` - Circular elements (9999px)

#### Standard Usage
```tsx
// Cards
<Card className="rounded-lg">

// Inputs/Buttons
<Input className="rounded-md">
<Button className="rounded-md">

// Avatar/Icon containers
<View className="rounded-full">
```

### Spacing Scale
Use TailwindCSS spacing utilities (1 unit = 0.25rem = 4px):

Common values:
- `gap-1` (4px) - Tight spacing
- `gap-2` (8px) - Default spacing
- `gap-3` (12px) - Medium spacing
- `gap-4` (16px) - Comfortable spacing
- `gap-6` (24px) - Section spacing

```tsx
<View className="flex-row items-center gap-2">
  <Icon as={FileText} size={20} />
  <Text>Documents</Text>
</View>
```

---

## Component Guidelines

### Buttons

```tsx
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Upload } from 'lucide-react-native';

// Primary action
<Button variant="default">
  <Text className="text-primary-foreground">Save</Text>
</Button>

// With icon
<Button variant="default" className="flex-row items-center gap-2">
  <Icon as={Upload} size={16} className="text-primary-foreground" />
  <Text className="text-primary-foreground">Upload</Text>
</Button>

// Ghost button (icon only)
<Button variant="ghost" size="icon">
  <Icon as={Pencil} size={20} className="text-foreground" />
</Button>

// Destructive action
<Button variant="destructive">
  <Text className="text-destructive-foreground">Delete</Text>
</Button>
```

### Cards

```tsx
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';

<Card className="mb-4">
  <CardHeader>
    <View className="flex-row items-center gap-2">
      <Icon as={FileText} size={20} className="text-muted-foreground" />
      <CardTitle>Card Title</CardTitle>
    </View>
  </CardHeader>
  <CardContent>
    {/* Card content */}
  </CardContent>
</Card>
```

### Inputs

```tsx
import { Input } from '@/components/ui/input';

<Input
  value={value}
  onChangeText={setValue}
  placeholder="Enter text..."
  className="mt-1"
/>
```

### Alerts & Dialogs

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

<AlertDialog open={isOpen} onOpenChange={setIsOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Confirm Action</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to proceed?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>
        <Text>Cancel</Text>
      </AlertDialogCancel>
      <AlertDialogAction onPress={handleAction}>
        <Text>Confirm</Text>
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Best Practices

### 1. Always Use Semantic Colors
✅ Use `text-info`, `text-success`, `text-destructive`
❌ Never use `text-blue-500`, `text-green-600`, etc.

### 2. Use TailwindCSS Classes, Not Inline Styles
✅ Use `className="rounded-full"`
❌ Don't use `style={{ borderRadius: 9999 }}`

### 3. Stick to Standard Icon Sizes
✅ Use 16px, 20px, 24px, 32px
❌ Avoid 10px, 14px, 15px, 18px, 40px

### 4. Use Standard Text Sizes
✅ Use `text-xs`, `text-sm`, `text-base`
❌ Don't use `text-[10px]`, `text-[11px]`

### 5. Maintain Consistent Spacing
Use the spacing scale consistently:
- Within components: `gap-2` (8px)
- Between components: `gap-4` (16px)
- Between sections: `gap-6` (24px)

### 6. Dark Mode Compatibility
All semantic colors automatically support dark mode. When you use semantic tokens, dark mode works automatically.

### 7. Accessibility
- Always provide meaningful text for screen readers
- Ensure sufficient color contrast
- Use semantic HTML/components when available

---

## Quick Reference

### Common Patterns

#### Feature Card with Status Color
```tsx
<View className="h-12 w-12 items-center justify-center rounded-full bg-info/10">
  <Icon as={FileText} size={24} className="text-info" />
</View>
```

#### Status Message
```tsx
// Success
<View className="flex-row items-center gap-1">
  <Icon as={CheckCircle} size={16} className="text-success" />
  <Text className="text-xs text-success">Operation successful</Text>
</View>

// Error
<View className="flex-row items-center gap-1">
  <Icon as={AlertCircle} size={16} className="text-destructive" />
  <Text className="text-xs text-destructive">Operation failed</Text>
</View>
```

#### Card Header with Icon
```tsx
<CardHeader>
  <View className="flex-row items-center gap-2">
    <Icon as={FileText} size={20} className="text-muted-foreground" />
    <CardTitle>Section Title</CardTitle>
  </View>
</CardHeader>
```

---

## Migration Guide

If you find components using old patterns, update them as follows:

### Color Migration
```tsx
// BEFORE
<View className="bg-blue-100">
  <Icon as={FileText} className="text-blue-500" />
</View>

// AFTER
<View className="bg-info/10">
  <Icon as={FileText} className="text-info" />
</View>
```

### Style Migration
```tsx
// BEFORE
<View style={{ borderRadius: 9999 }}>

// AFTER
<View className="rounded-full">
```

### Size Standardization
```tsx
// BEFORE
<Icon as={Send} size={15} />
<Text className="text-[11px]">Label</Text>

// AFTER
<Icon as={Send} size={16} />
<Text className="text-xs">Label</Text>
```

---

## Support

For questions about the design system or to propose changes, please create an issue or reach out to the design team.

**Last Updated:** 2025-01-05
