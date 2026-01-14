---
name: tailwind-theming
description: Centralized Tailwind CSS theme system patterns. Use when creating UI components, styling buttons, applying colors, or working with visual design. Never hardcode colors - always use theme variables from lib/colors.ts.
---

# Tailwind Theme System

## Context

The oboapp project uses a centralized theme system to ensure visual consistency across all components. All color definitions live in [web/lib/colors.ts](../../web/lib/colors.ts) and are exposed as CSS variables via [web/app/globals.css](../../web/app/globals.css).

**Critical**: Never hardcode colors (like `bg-blue-500`, `text-gray-700`, `border-red-200`). Always use theme variables.

## Pattern

**Always use theme colors from `lib/colors.ts` - never hardcode colors.**

### Architecture

- **Single source of truth**: [web/lib/colors.ts](../../web/lib/colors.ts) - All color definitions
- **CSS variables**: [web/app/globals.css](../../web/app/globals.css) - Theme implementation via Tailwind v4 @theme
- **Component utilities**: [web/lib/theme.ts](../../web/lib/theme.ts) - Button styles and helpers

## Guidelines

### 1. Color Categories

Use semantic color names that describe purpose, not appearance:

#### Action Colors

- `primary` / `primary-hover` - Primary actions (blue, #1976D2)
  - Use for: Save buttons, primary CTAs, important actions
- `destructive` / `destructive-hover` - Destructive actions (red, #E74C3C)
  - Use for: Delete buttons, cancel actions, dangerous operations

#### State Colors

- `neutral` / `neutral-*` - Borders, backgrounds, text, disabled states (gray equivalents)
  - Variants: `neutral-border`, `neutral-bg`, `neutral-light`, `neutral-text`, `neutral-disabled`
- `error` / `error-*` - Validation errors, error messages (red)
  - Variants: `error-border`, `error-bg`, `error-light`, `error-text`
- `warning` / `warning-*` - Warnings, caution states (amber/yellow)
  - Variants: `warning-border`, `warning-bg`, `warning-light`, `warning-text`
- `success` / `success-*` - Success states, confirmations (green)
  - Variants: `success-border`, `success-bg`, `success-light`, `success-text`
- `info` / `info-*` - Informational messages (blue)
  - Variants: `info-border`, `info-bg`, `info-light`, `info-text`

#### Layout Colors

- `header-bg` - Header background
- `nav-bg` - Navigation background
- `footer-bg` - Footer background
- `link` - Link color

### 2. Button Styling

**Always use `getButtonClasses()` from [web/lib/theme.ts](../../web/lib/theme.ts):**

```typescript
import { getButtonClasses } from "@/lib/theme";

// Basic usage
<button className={getButtonClasses("primary")}>
  Save
</button>

// With size
<button className={getButtonClasses("destructive", "lg")}>
  Delete
</button>

// With custom border radius
<button className={getButtonClasses("secondary", "md", "full")}>
  Rounded Button
</button>
```

**Available variants:**

- `primary` - Primary blue button (most actions)
- `destructive` - Red delete/danger button
- `secondary` - Gray secondary button
- `warning` - Yellow/amber warning button
- `success` - Green success button
- `ghost` - Transparent button with hover
- `link` - Text link styled as button
- `linkDestructive` - Red text link

**Available sizes:**

- `sm` - Small (compact spacing)
- `md` - Medium (default)
- `lg` - Large (prominent actions)

**Available border radius:**

- `sm` - rounded-md (most common, default)
- `md` - rounded-lg
- `lg` - rounded-xl
- `full` - rounded-full (pill-shaped)

### 3. Manual Styling (When Not Using getButtonClasses)

For custom components, use the individual style objects:

```typescript
import { buttonStyles, buttonSizes, borderRadius } from "@/lib/theme";

<button
  className={`${buttonSizes.md} ${buttonStyles.primary} ${borderRadius.sm}`}
>
  Save
</button>;
```

### 4. Applying Colors to Other Components

Use Tailwind classes with theme variable names:

```typescript
// Borders
<div className="border border-neutral-border">Content</div>
<div className="border-2 border-error-border">Error</div>

// Backgrounds
<div className="bg-neutral-light">Light background</div>
<div className="bg-error-light">Error background</div>

// Text colors
<p className="text-neutral-text">Normal text</p>
<p className="text-error">Error message</p>

// Hover states
<button className="bg-primary hover:bg-primary-hover">
  Hover me
</button>
```

### 5. Opacity and Spacing

Import opacity and border radius constants from [web/lib/colors.ts](../../web/lib/colors.ts):

```typescript
import { opacity, borderRadius } from "@/lib/colors";

// Using opacity
<div className={`bg-primary ${opacity.medium}`}>50% opacity</div>

// Using border radius
<div className={borderRadius.lg}>Rounded corners</div>
```

## Examples

### ✅ Good - Using Theme System

```typescript
import { getButtonClasses } from "@/lib/theme";

export function MessageActions({ onSave, onDelete }) {
  return (
    <div className="flex gap-2">
      <button onClick={onSave} className={getButtonClasses("primary", "md")}>
        Save Message
      </button>

      <button
        onClick={onDelete}
        className={getButtonClasses("destructive", "md")}
      >
        Delete
      </button>
    </div>
  );
}
```

```typescript
export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="border border-error-border bg-error-light p-4 rounded-md">
      <p className="text-error font-medium">{message}</p>
    </div>
  );
}
```

```typescript
export function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-neutral-border bg-neutral-light p-6 rounded-lg">
      <div className="text-neutral-text">{children}</div>
    </div>
  );
}
```

### ✅ Good - Custom Styled Button

```typescript
import { buttonStyles, buttonSizes, borderRadius } from "@/lib/theme";

export function IconButton({ icon, onClick, variant = "primary" }) {
  return (
    <button
      onClick={onClick}
      className={`${buttonSizes.sm} ${buttonStyles[variant]} ${borderRadius.full} flex items-center gap-2`}
    >
      {icon}
    </button>
  );
}
```

### ❌ Bad - Hardcoded Colors

```typescript
// ❌ BAD: Hardcoded Tailwind colors
export function MessageActions({ onSave, onDelete }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onSave}
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
      >
        Save Message
      </button>

      <button
        onClick={onDelete}
        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
      >
        Delete
      </button>
    </div>
  );
}
```

```typescript
// ❌ BAD: Hardcoded gray colors
export function InfoCard({ children }) {
  return (
    <div className="border border-gray-200 bg-gray-50 p-6 rounded-lg">
      <div className="text-gray-700">{children}</div>
    </div>
  );
}
```

```typescript
// ❌ BAD: Inline hex colors
export function ErrorMessage({ message }) {
  return (
    <div
      style={{
        borderColor: "#f87171",
        backgroundColor: "#fef2f2",
        color: "#dc2626",
      }}
    >
      {message}
    </div>
  );
}
```

### ❌ Bad - Inconsistent Button Styling

```typescript
// ❌ BAD: Not using getButtonClasses or theme utilities
export function Actions() {
  return (
    <>
      <button className="bg-blue-600 px-6 py-3 rounded">Save</button>
      <button className="bg-blue-500 px-4 py-2 rounded-md">Edit</button>
      <button className="bg-primary hover:bg-primary-hover px-5 py-2.5 rounded-lg">
        View
      </button>
      {/* Inconsistent sizes, inconsistent rounding, inconsistent colors */}
    </>
  );
}
```

## Color Reference Quick Guide

### When to use each color category:

| Purpose            | Color Category                      | Example Use Cases                      |
| ------------------ | ----------------------------------- | -------------------------------------- |
| Primary action     | `primary`                           | Save, Submit, Confirm, Next            |
| Destructive action | `destructive`                       | Delete, Remove, Cancel permanently     |
| Secondary action   | `neutral` (via `secondary` variant) | Cancel, Back, Close modal              |
| Success feedback   | `success`                           | Success messages, completed states     |
| Error feedback     | `error`                             | Validation errors, failed operations   |
| Warning            | `warning`                           | Caution messages, destructive previews |
| Information        | `info`                              | Help text, informational notices       |
| Disabled state     | `neutral-disabled`                  | Disabled buttons, inactive elements    |
| Borders            | `*-border`                          | Card borders, input borders            |
| Backgrounds        | `*-bg`, `*-light`                   | Cards, panels, highlighted areas       |

## Migration from Hardcoded Colors

If you find hardcoded colors in existing components:

1. **Identify the purpose**: What is this color communicating?
2. **Map to semantic name**:
   - Blue buttons → `primary`
   - Red buttons → `destructive`
   - Gray borders → `neutral-border`
   - Red error text → `error`
3. **Replace with theme**:
   - Buttons: Use `getButtonClasses()`
   - Other elements: Use Tailwind classes with theme variables
4. **Test visually**: Ensure the new styling matches the intent

## References

- **Color definitions**: [web/lib/colors.ts](../../web/lib/colors.ts)
- **Theme utilities**: [web/lib/theme.ts](../../web/lib/theme.ts)
- **CSS variables**: [web/app/globals.css](../../web/app/globals.css)
- **Related PR**: #43 (Unified button styling and theme system)
- **Related Skills**:
  - `.claude/skills/dry-enforcement` - For extracting repeated styling patterns
  - `.claude/skills/documentation-standards` - For documenting theme usage
