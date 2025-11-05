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

This section provides comprehensive documentation for all UI components available in the component library located at `apps/mapp/components/ui/`.

### Table of Contents
- [Accordion](#accordion)
- [Alert](#alert)
- [Alert Dialog](#alert-dialog)
- [Aspect Ratio](#aspect-ratio)
- [Avatar](#avatar)
- [Badge](#badge)
- [Button](#button)
- [Card](#card)
- [Checkbox](#checkbox)
- [Collapsible](#collapsible)
- [Context Menu](#context-menu)
- [Dialog](#dialog)
- [Dropdown Menu](#dropdown-menu)
- [Hover Card](#hover-card)
- [Icon](#icon)
- [Input](#input)
- [Label](#label)
- [Menubar](#menubar)
- [Popover](#popover)
- [Progress](#progress)
- [Radio Group](#radio-group)
- [Select](#select)
- [Separator](#separator)
- [Skeleton](#skeleton)
- [Switch](#switch)
- [Tabs](#tabs)
- [Text](#text)
- [Textarea](#textarea)
- [Toggle](#toggle)
- [Toggle Group](#toggle-group)
- [Tooltip](#tooltip)

---

### Accordion

Expandable/collapsible content sections.

```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Text } from '@/components/ui/text';

<Accordion type="single" collapsible>
  <AccordionItem value="item-1">
    <AccordionTrigger>
      <Text>Section 1</Text>
    </AccordionTrigger>
    <AccordionContent>
      <Text>Content for section 1</Text>
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>
      <Text>Section 2</Text>
    </AccordionTrigger>
    <AccordionContent>
      <Text>Content for section 2</Text>
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

---

### Alert

Display important messages with an icon.

```tsx
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react-native';

// Default alert
<Alert icon={AlertCircle}>
  <AlertTitle>Information</AlertTitle>
  <AlertDescription>
    This is an informational message
  </AlertDescription>
</Alert>

// Destructive alert
<Alert icon={AlertCircle} variant="destructive">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Something went wrong
  </AlertDescription>
</Alert>

// Success alert
<Alert icon={CheckCircle}>
  <AlertTitle>Success</AlertTitle>
  <AlertDescription>
    Operation completed successfully
  </AlertDescription>
</Alert>
```

**Variants:** `default`, `destructive`

---

### Alert Dialog

Modal dialog for important decisions requiring user confirmation.

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
import { Text } from '@/components/ui/text';

<AlertDialog open={isOpen} onOpenChange={setIsOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Confirm Action</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to proceed? This action cannot be undone.
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

### Aspect Ratio

Maintain consistent aspect ratios for media content.

```tsx
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Image } from 'react-native';

<AspectRatio ratio={16 / 9}>
  <Image source={{ uri: 'image-url' }} className="size-full" />
</AspectRatio>
```

---

### Avatar

Display user profile pictures with fallback support.

```tsx
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';

<Avatar>
  <AvatarImage source={{ uri: 'avatar-url' }} />
  <AvatarFallback>
    <Text>JD</Text>
  </AvatarFallback>
</Avatar>
```

---

### Badge

Small status indicators or labels.

```tsx
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Star } from 'lucide-react-native';

// Default badge
<Badge variant="default">
  <Text>New</Text>
</Badge>

// Secondary badge
<Badge variant="secondary">
  <Text>Beta</Text>
</Badge>

// Destructive badge
<Badge variant="destructive">
  <Text>Error</Text>
</Badge>

// Outline badge
<Badge variant="outline">
  <Text>Draft</Text>
</Badge>

// With icon
<Badge variant="default">
  <Icon as={Star} size={12} />
  <Text>Featured</Text>
</Badge>
```

**Variants:** `default`, `secondary`, `destructive`, `outline`

---

### Button

Interactive buttons with multiple variants and sizes.

```tsx
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Upload, Pencil } from 'lucide-react-native';

// Primary action
<Button variant="default">
  <Text>Save</Text>
</Button>

// With icon
<Button variant="default" className="flex-row items-center gap-2">
  <Icon as={Upload} size={16} />
  <Text>Upload</Text>
</Button>

// Ghost button (icon only)
<Button variant="ghost" size="icon">
  <Icon as={Pencil} size={20} />
</Button>

// Destructive action
<Button variant="destructive">
  <Text>Delete</Text>
</Button>

// Outline button
<Button variant="outline">
  <Text>Cancel</Text>
</Button>

// Secondary button
<Button variant="secondary">
  <Text>Save Draft</Text>
</Button>

// Link button
<Button variant="link">
  <Text>Learn More</Text>
</Button>

// Different sizes
<Button size="sm">
  <Text>Small</Text>
</Button>
<Button size="default">
  <Text>Default</Text>
</Button>
<Button size="lg">
  <Text>Large</Text>
</Button>
```

**Variants:** `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
**Sizes:** `default`, `sm`, `lg`, `icon`

---

### Card

Container component for grouping related content.

```tsx
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { FileText } from 'lucide-react-native';

<Card>
  <CardHeader>
    <View className="flex-row items-center gap-2">
      <Icon as={FileText} size={20} className="text-muted-foreground" />
      <CardTitle>Card Title</CardTitle>
    </View>
    <CardDescription>
      Optional description for the card
    </CardDescription>
  </CardHeader>
  <CardContent>
    <Text>Main content goes here</Text>
  </CardContent>
  <CardFooter>
    <Text className="text-sm text-muted-foreground">Footer content</Text>
  </CardFooter>
</Card>
```

---

### Checkbox

Toggle selection control for forms.

```tsx
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

<View className="flex-row items-center gap-2">
  <Checkbox
    checked={checked}
    onCheckedChange={setChecked}
  />
  <Label>Accept terms and conditions</Label>
</View>
```

---

### Collapsible

Show/hide content with expand/collapse functionality.

```tsx
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

<Collapsible>
  <CollapsibleTrigger asChild>
    <Button variant="ghost">
      <Text>Toggle Content</Text>
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <Text>Hidden content that can be toggled</Text>
  </CollapsibleContent>
</Collapsible>
```

---

### Context Menu

Right-click menu with actions (primarily for web).

```tsx
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Text } from '@/components/ui/text';

<ContextMenu>
  <ContextMenuTrigger>
    <Text>Right click me</Text>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>
      <Text>Edit</Text>
    </ContextMenuItem>
    <ContextMenuItem>
      <Text>Delete</Text>
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

---

### Dialog

Modal dialog for forms and content overlays.

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button>
      <Text>Open Dialog</Text>
    </Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>
        Dialog description goes here
      </DialogDescription>
    </DialogHeader>
    {/* Dialog content */}
    <DialogFooter>
      <Button>
        <Text>Save</Text>
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### Dropdown Menu

Menu with actions triggered by a button.

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { MoreVertical } from 'lucide-react-native';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <Icon as={MoreVertical} size={20} />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>
      <Text>Actions</Text>
    </DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>
      <Text>Edit</Text>
    </DropdownMenuItem>
    <DropdownMenuItem>
      <Text>Share</Text>
    </DropdownMenuItem>
    <DropdownMenuItem>
      <Text>Delete</Text>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

### Hover Card

Display additional content on hover (primarily for web).

```tsx
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Text } from '@/components/ui/text';

<HoverCard>
  <HoverCardTrigger>
    <Text>Hover over me</Text>
  </HoverCardTrigger>
  <HoverCardContent>
    <Text>Additional information shown on hover</Text>
  </HoverCardContent>
</HoverCard>
```

---

### Icon

Wrapper for Lucide React Native icons with consistent sizing.

```tsx
import { Icon } from '@/components/ui/icon';
import { FileText, User, Settings } from 'lucide-react-native';

// Standard sizes
<Icon as={FileText} size={16} className="text-muted-foreground" />
<Icon as={User} size={20} className="text-foreground" />
<Icon as={Settings} size={24} className="text-info" />
<Icon as={FileText} size={32} className="text-muted-foreground" />
```

**Recommended Sizes:** `16`, `20`, `24`, `32`

---

### Input

Text input field for forms.

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<View className="gap-2">
  <Label>Email</Label>
  <Input
    value={email}
    onChangeText={setEmail}
    placeholder="Enter your email..."
    keyboardType="email-address"
  />
</View>
```

---

### Label

Form field labels.

```tsx
import { Label } from '@/components/ui/label';

<Label htmlFor="email">Email Address</Label>
```

---

### Menubar

Horizontal menu bar with dropdown menus.

```tsx
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from '@/components/ui/menubar';
import { Text } from '@/components/ui/text';

<Menubar>
  <MenubarMenu>
    <MenubarTrigger>
      <Text>File</Text>
    </MenubarTrigger>
    <MenubarContent>
      <MenubarItem>
        <Text>New</Text>
      </MenubarItem>
      <MenubarItem>
        <Text>Open</Text>
      </MenubarItem>
    </MenubarContent>
  </MenubarMenu>
  <MenubarMenu>
    <MenubarTrigger>
      <Text>Edit</Text>
    </MenubarTrigger>
    <MenubarContent>
      <MenubarItem>
        <Text>Cut</Text>
      </MenubarItem>
      <MenubarItem>
        <Text>Copy</Text>
      </MenubarItem>
    </MenubarContent>
  </MenubarMenu>
</Menubar>
```

---

### Popover

Floating content container positioned relative to a trigger.

```tsx
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">
      <Text>Open Popover</Text>
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <Text>Popover content goes here</Text>
  </PopoverContent>
</Popover>
```

---

### Progress

Visual indicator for progress/loading states.

```tsx
import { Progress } from '@/components/ui/progress';

// Determinate progress
<Progress value={progress} />

// With custom styling
<Progress
  value={75}
  className="h-3"
  indicatorClassName="bg-success"
/>
```

---

### Radio Group

Mutually exclusive selection options.

```tsx
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

<RadioGroup value={value} onValueChange={setValue}>
  <View className="flex-row items-center gap-2">
    <RadioGroupItem value="option1" />
    <Label>Option 1</Label>
  </View>
  <View className="flex-row items-center gap-2">
    <RadioGroupItem value="option2" />
    <Label>Option 2</Label>
  </View>
</RadioGroup>
```

---

### Select

Dropdown selection component.

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Text } from '@/components/ui/text';

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select an option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">
      <Text>Option 1</Text>
    </SelectItem>
    <SelectItem value="option2">
      <Text>Option 2</Text>
    </SelectItem>
    <SelectItem value="option3">
      <Text>Option 3</Text>
    </SelectItem>
  </SelectContent>
</Select>
```

---

### Separator

Visual divider between content sections.

```tsx
import { Separator } from '@/components/ui/separator';

<View>
  <Text>Section 1</Text>
  <Separator className="my-4" />
  <Text>Section 2</Text>
</View>
```

---

### Skeleton

Loading placeholder with pulse animation.

```tsx
import { Skeleton } from '@/components/ui/skeleton';

// Loading state
<View className="gap-2">
  <Skeleton className="h-12 w-12 rounded-full" />
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-3/4" />
</View>
```

---

### Switch

Toggle switch for binary settings.

```tsx
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

<View className="flex-row items-center gap-2">
  <Switch
    checked={enabled}
    onCheckedChange={setEnabled}
  />
  <Label>Enable notifications</Label>
</View>
```

---

### Tabs

Tabbed navigation interface.

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';

<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="tab1">
      <Text>Tab 1</Text>
    </TabsTrigger>
    <TabsTrigger value="tab2">
      <Text>Tab 2</Text>
    </TabsTrigger>
    <TabsTrigger value="tab3">
      <Text>Tab 3</Text>
    </TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">
    <Text>Content for tab 1</Text>
  </TabsContent>
  <TabsContent value="tab2">
    <Text>Content for tab 2</Text>
  </TabsContent>
  <TabsContent value="tab3">
    <Text>Content for tab 3</Text>
  </TabsContent>
</Tabs>
```

---

### Text

Base text component with semantic styling support.

```tsx
import { Text } from '@/components/ui/text';

// Standard text
<Text className="text-base text-foreground">
  Regular text content
</Text>

// Muted text
<Text className="text-sm text-muted-foreground">
  Secondary information
</Text>

// Heading
<Text className="text-xl font-semibold text-foreground">
  Section Heading
</Text>
```

---

### Textarea

Multi-line text input field.

```tsx
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

<View className="gap-2">
  <Label>Description</Label>
  <Textarea
    value={description}
    onChangeText={setDescription}
    placeholder="Enter description..."
    numberOfLines={4}
  />
</View>
```

---

### Toggle

Toggle button with on/off states.

```tsx
import { Toggle } from '@/components/ui/toggle';
import { Icon } from '@/components/ui/icon';
import { Bold } from 'lucide-react-native';

<Toggle
  pressed={isBold}
  onPressedChange={setIsBold}
>
  <Icon as={Bold} size={16} />
</Toggle>
```

**Variants:** `default`, `outline`
**Sizes:** `default`, `sm`, `lg`

---

### Toggle Group

Group of mutually exclusive or multiple toggle buttons.

```tsx
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Icon } from '@/components/ui/icon';
import { Bold, Italic, Underline } from 'lucide-react-native';

// Single selection
<ToggleGroup type="single" value={value} onValueChange={setValue}>
  <ToggleGroupItem value="bold">
    <Icon as={Bold} size={16} />
  </ToggleGroupItem>
  <ToggleGroupItem value="italic">
    <Icon as={Italic} size={16} />
  </ToggleGroupItem>
  <ToggleGroupItem value="underline">
    <Icon as={Underline} size={16} />
  </ToggleGroupItem>
</ToggleGroup>

// Multiple selection
<ToggleGroup type="multiple" value={values} onValueChange={setValues}>
  <ToggleGroupItem value="bold">
    <Icon as={Bold} size={16} />
  </ToggleGroupItem>
  <ToggleGroupItem value="italic">
    <Icon as={Italic} size={16} />
  </ToggleGroupItem>
</ToggleGroup>
```

---

### Tooltip

Contextual information on hover/press.

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Info } from 'lucide-react-native';

<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon">
      <Icon as={Info} size={20} />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <Text>Additional information</Text>
  </TooltipContent>
</Tooltip>
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
