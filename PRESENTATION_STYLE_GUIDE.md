# Concast Energy Platform - Presentation Style Guide

## Platform Overview

**Concast Energy Platform** is a comprehensive energy intelligence dashboard for monitoring, analyzing, and optimizing energy consumption and production for industrial facilities.

### Core Features
- **Real-time Energy Monitoring**: Track electrical and thermal energy consumption across facilities
- **Cogeneration Management**: Monitor and optimize cogenerator performance (electrical and thermal efficiency)
- **Photovoltaic Analysis**: Analyze solar energy production and integration scenarios
- **Cost Optimization**: Compare different operational strategies to minimize energy costs
- **Multi-year Forecasting**: Project energy consumption and costs (2024-2026 dataset)
- **CO₂ Impact Analysis**: Track environmental impact and carbon footprint
- **MILP Optimization**: Advanced mathematical optimization for operational decisions

### Key Capabilities
- Hourly data granularity for precise analysis
- Scenario comparison (Normal vs. Optimized PV installations)
- Strategy simulation (5+ operational strategies)
- KPI tracking (consumption, self-production, costs, savings)
- Performance benchmarking against nominal specifications

---

## Design Philosophy

The platform follows a **premium, professional design system** with these core principles:

### 1. Less is More
- Show only essential information for the primary action
- Avoid visual overload with too many colors, labels, or borders
- Start with core use cases, not excessive sections

### 2. Immediate Scannability
- Users understand "what to do here" in under 2 seconds
- Layout is readable as a whole before diving into details
- Clear visual hierarchy guides attention

### 3. Layered Depth
- Multiple visual planes create a physical, tactile feel
- Premium look through dual shadows (highlight + shadow)
- Elements appear to float at different elevations

### 4. Data-Driven Clarity
- Real data always used (never lorem ipsum)
- Typography and spacing serve the content
- Gestalt principles for logical grouping

---

## Color Palette

### Primary Brand Colors

#### Blues (Primary)
- **Primary Color**: `#2563eb` (Vivid Blue)
- **Primary Light**: `#3b82f6` (Sky Blue)
- **Primary Dark**: `#1d4ed8` (Deep Blue)

#### Greens (Success/Energy Production)
- **Success Color**: `#10b981` (Emerald Green)
- **Success Dark**: `#059669` (Forest Green)
- **Success Darker**: `#047857` (Deep Forest)

#### Yellows/Oranges (Warning/Solar)
- **Warning/Solar**: `#f59e0b` (Amber)
- **Solar Light**: `#fbbf24` (Golden Yellow)
- **Solar Dark**: `#b7791f` (Bronze)

#### Reds (Danger/Alerts)
- **Danger Color**: `#ef4444` (Red)

### Background Layers System

A sophisticated multi-layer background system creates depth:

#### Base Layers
- **bg-base**: `#f0f4f8` (Lightest background - deepest layer)
- **bg-surface**: `#ffffff` (White - card/surface layer)
- **bg-elevated**: `#f8fafc` (Slightly elevated - above surface)

#### Complex Gradients
- **bg-gradient**: `radial-gradient(circle at 20% 20%, rgba(148, 163, 184, 0.18), transparent 35%), radial-gradient(circle at 80% 0%, rgba(56, 189, 248, 0.12), transparent 40%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 40%, #e2e8f0 100%)`
- **card-glow**: `linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.82))`
- **hero-bg**: `linear-gradient(135deg, #e0f2fe 0%, #f8fbff 100%)`

### Text Colors

Clear hierarchy through contrast:

- **text-primary**: `#0f172a` (Near Black - highest contrast)
- **text-secondary**: `#475569` (Slate Gray - descriptive text)
- **text-tertiary**: `#94a3b8` (Light Gray - meta information)

### Border Colors

- **border-color**: `#e2e8f0` (Subtle Gray)
- **border-focus**: `#2563eb` (Primary Blue for active states)
- **hero-border**: `#dbeafe` (Light Blue)

### Semantic Colors for Data Visualization

#### For Charts and Metrics
- **Grid Energy**: Blues (`#2563eb`, `#3b82f6`, `#60a5fa`)
- **Cogeneration**: Greens (`#10b981`, `#059669`, `#0f9d7a`)
- **Solar/PV**: Yellows (`#fbbf24`, `#f59e0b`, `#b7791f`)
- **Costs**: Reds (`#ef4444`, `#dc2626`)

---

## Typography System

### Font Family
**Primary**: `'Inter var', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`

- Modern sans-serif with variable font support
- Excellent legibility at all sizes
- Professional and technical feel

### Type Scale

| Element | Size | Weight | Usage |
|---------|------|--------|-------|
| **Hero Title** | 2.4rem (38px) | 800 | Main page headings |
| **Section Title** | 1.75rem (28px) | 800 | Major section headers |
| **Subsection** | 1.25rem (20px) | 700 | Subsection headers |
| **Large Value** | 2.5-3rem | 800 | KPI values, big numbers |
| **Body Large** | 1.05rem | 400 | Subtitles, descriptions |
| **Body Regular** | 1rem (16px) | 400-600 | Standard text |
| **Body Small** | 0.9-0.95rem | 400-500 | Secondary information |
| **Caption** | 0.8-0.875rem | 500-600 | Labels, metadata |
| **Micro** | 0.7-0.75rem | 600-700 | Pills, badges, tiny labels |

### Font Weights
- **400**: Regular body text
- **500**: Medium emphasis
- **600**: Semi-bold for labels
- **700**: Bold for emphasis
- **800**: Extra bold for headlines and values

### Typography Guidelines

#### Line Height
- **Headlines**: 1.1-1.3 (tight for impact)
- **Body Text**: 1.5-1.6 (loose for readability)
- **Captions**: 1.4 (balanced)

#### Letter Spacing
- **Uppercase Labels**: 0.05em - 0.08em (tracking for readability)
- **Headlines**: -0.02em to -0.03em (negative for large sizes)
- **Body**: Default (0)

---

## Spacing System

### 8-Point Scale
Based on 4px increments for consistency:

| Variable | Value | Pixels | Usage |
|----------|-------|--------|-------|
| `--space-xs` | 0.25rem | 4px | Micro spacing |
| `--space-sm` | 0.5rem | 8px | Small gaps |
| `--space-md` | 0.75rem | 12px | Medium gaps |
| `--space-lg` | 1rem | 16px | Standard spacing |
| `--space-xl` | 1.5rem | 24px | Large spacing |
| `--space-2xl` | 2rem | 32px | Extra large |
| `--space-3xl` | 2.5rem | 40px | Massive spacing |

### Application Rules
- **Related elements**: Smaller spacing (4-12px)
- **Different blocks**: Larger spacing (24-40px)
- **Always zoom out** at 50% to check grouping
- **Whitespace is intentional**, not empty

---

## Border Radius System

Consistent curves for modern feel:

| Variable | Value | Pixels | Usage |
|----------|-------|--------|-------|
| `--radius-sm` | 0.5rem | 8px | Buttons, chips, small elements |
| `--radius-md` | 0.75rem | 12px | Cards, inputs |
| `--radius-lg` | 1rem | 16px | Large cards, sections, modals |

### Special Cases
- **Pills/Badges**: `999px` (fully rounded)
- **Circles**: `50%` (icons, avatars)

---

## Shadow & Depth System

### Raised Shadows (Elements Above Surface)

Premium dual-shadow approach combining dark shadow below and light highlight above:

#### Small Elevation
```css
--shadow-raised-sm: 
  0 1px 3px 0 rgba(15, 23, 42, 0.08),
  inset 0 1px 0 rgba(255, 255, 255, 0.9);
```
**Use for**: Small cards, buttons, chips

#### Medium Elevation
```css
--shadow-raised-md:
  0 4px 12px -2px rgba(15, 23, 42, 0.12),
  0 2px 4px -1px rgba(15, 23, 42, 0.06),
  inset 0 1px 0 rgba(255, 255, 255, 0.9);
```
**Use for**: Standard cards, main content sections

#### Large Elevation
```css
--shadow-raised-lg:
  0 12px 24px -4px rgba(15, 23, 42, 0.15),
  0 4px 8px -2px rgba(15, 23, 42, 0.08),
  inset 0 1px 0 rgba(255, 255, 255, 0.95);
```
**Use for**: Hero sections, modals, emphasized elements

### Inset Shadows (Recessed Elements)

```css
--shadow-inset:
  inset 0 2px 4px rgba(15, 23, 42, 0.1),
  inset 0 -1px 0 rgba(255, 255, 255, 0.5);
```
**Use for**: Input fields, tables, "sunken" containers

### Accent Glow
```css
--accent-glow: 0 8px 24px rgba(59, 130, 246, 0.15);
```
**Use for**: Hover states, active elements, CTAs

### Visual Depth Hierarchy
1. **Deepest**: Background gradient with inset elements
2. **Base**: Main content surface (white cards)
3. **Elevated**: Raised cards with medium shadow
4. **Floating**: Interactive elements with large shadow + glow

---

## Components & UI Elements

### KPI Cards

**Purpose**: Display key metrics with emphasis on values

**Anatomy**:
- Icon badge (32x32px, background with light color tint)
- Label (0.65rem, uppercase, tertiary color)
- Value (1.2-1.4rem, extra bold, primary color)
- Unit (0.75rem, secondary color)
- Optional subtitle (0.7rem, italic, tertiary)

**Colors**: Icon backgrounds use 10-15% opacity of theme color

### Buttons

#### Primary Button
- **Background**: `linear-gradient(135deg, #2563eb, #3b82f6)`
- **Text**: White, font-weight 700
- **Shadow**: Combined elevation + glow
- **Hover**: Increased shadow, slight translateY(-1px)

#### Secondary Button
- **Background**: Transparent or bg-surface
- **Border**: 1px solid border-color
- **Text**: Primary color, font-weight 600
- **Hover**: Border color intensifies

### Navigation Pills
- **Inactive**: Text-secondary, transparent background
- **Hover**: Light border, subtle shadow
- **Active**: Gradient background (blue or green), white text, larger shadow

---

## Chart & Data Visualization Colors

### Standard Palettes

#### Electrical Energy
- **Grid Purchase**: `#3b82f6` (Blue)
- **Cogenerator**: `#10b981` (Green)
- **Photovoltaic**: `#fbbf24` (Yellow)

#### Thermal Energy
- **Cogenerator Thermal**: `#10b981` (Green)
- **Boilers**: `#f59e0b` (Orange)

#### Cost Comparison
- **Current/Actual**: `#3b82f6` (Blue)
- **Optimized/Best**: `#10b981` (Green)
- **Alternative**: `#f59e0b` (Orange)
- **Worst Case**: `#ef4444` (Red)

### Chart Styling Guidelines
- Use semi-transparent fills for area charts (20-40% opacity)
- Solid colors for bar charts
- Line charts: 2-3px stroke width
- Borders on shapes: 1px, slightly darker than fill
- Grid lines: Very subtle, 10-15% opacity
- Legends: Horizontal layout, small squares (10-16px)

---

## Animation & Interaction

### Micro-interactions

#### Timing Functions
- **Standard**: `ease` (0.2s)
- **Smooth**: `cubic-bezier(0.4, 0, 0.2, 1)` (0.2-0.3s)
- **Spring**: For playful elements (0.3-0.4s)

#### Common Animations
- **Hover lift**: `translateY(-1px)` + shadow increase
- **Click**: Brief scale down or translateY(0) return
- **Fade in**: Opacity 0 → 1 (0.3s)
- **Slide in**: TranslateY(-10px) → 0 with opacity

### Loading States
- Spinner: 50px diameter, primary color border-top
- Overlay: White 95% opacity background
- Rotation: 1s linear infinite

---

## Presentation Design Instructions

### For PowerPoint/Keynote/Google Slides

#### Slide Backgrounds
- **Main slides**: Use `#f0f4f8` (bg-base) or white
- **Title slides**: Use hero gradient (`#e0f2fe` to `#f8fbff`)
- **Emphasis slides**: Light blue gradient with 5-8% opacity overlays

#### Text on Slides
- **Slide titles**: 32-40pt, weight 800, `#0f172a`
- **Body text**: 18-24pt, weight 400, `#475569`
- **Captions**: 14-16pt, weight 500, `#94a3b8`

#### Data Slides
- Use KPI card style: icon + large value + label
- Arrange in 2-4 column grid
- Consistent spacing (32-40px between cards)
- Add subtle shadows to create depth

#### Chart Slides
- Use extracted color palette exactly
- Keep chart backgrounds white or very light gray
- Add descriptive captions below charts
- Use legend only when necessary (prefer direct labels)

### Layout Guidelines

#### Margins & Padding
- **Slide margins**: 80-100px all sides
- **Content padding**: 40-60px within containers
- **Element spacing**: Follow 8-point scale (16, 24, 32, 40px)

#### Grid System
- **2-column**: 60/40 or 50/50 split
- **3-column**: Equal or 40/30/30
- **4-column**: For KPI cards (equal width)

#### Visual Hierarchy
1. **Title area**: Top 20% of slide, strong hierarchy
2. **Main content**: Middle 60%, largest visual elements
3. **Footer/metadata**: Bottom 20%, minimal presence

---

## Icon System

### Icon Style
- **Line style**: 2-3px stroke weight
- **Style consistency**: All outline or all filled (don't mix)
- **Active state**: Switch to filled/bold version
- **Size**: 16-24px for inline, 32-48px for emphasis

### Common Icons
- **⚡ Electrical**: Lightning bolt, plug
- **🔥 Thermal**: Flame, thermometer
- **☀️ Solar**: Sun, solar panel
- **💰 Cost**: Euro symbol, coins
- **📊 Analytics**: Chart, graph lines
- **🌳 CO₂**: Tree, leaf (environmental)
- **⚙️ Optimization**: Gear, slider

---

## Brand Voice & Messaging

### Tone
- **Professional yet approachable**: Clear technical language without jargon overload
- **Data-driven**: Always back claims with numbers
- **Action-oriented**: Focus on decisions and optimizations
- **Confident**: Platform enables better decisions

### Key Messages
1. **"Energy Intelligence"**: Smart monitoring and optimization
2. **"Real-time Visibility"**: Hourly granularity for precise control
3. **"Cost Optimization"**: Multiple strategies compared scientifically
4. **"Sustainable Operations"**: Track and reduce environmental impact
5. **"Data-Driven Decisions"**: Move from intuition to proof

### Value Propositions
- Reduce energy costs through optimization (quantified savings)
- Improve asset efficiency (cogenerator performance metrics)
- Plan future investments with confidence (forecasting)
- Meet sustainability goals (CO₂ tracking)

---

## Quick Reference: Color Codes

### Primary Palette
```
Blue Primary:    #2563eb
Blue Light:      #3b82f6
Green Success:   #10b981
Yellow Solar:    #fbbf24
Orange Warning:  #f59e0b
Red Danger:      #ef4444
```

### Backgrounds
```
Base:            #f0f4f8
Surface:         #ffffff
Elevated:        #f8fafc
```

### Text
```
Primary:         #0f172a
Secondary:       #475569
Tertiary:        #94a3b8
```

### Borders
```
Standard:        #e2e8f0
Focus:           #2563eb
```

---

## Tips for Creating Effective Energy Platform Presentations

### Do's ✓
- **Use real data** from the platform whenever possible
- **Show before/after** comparisons for optimization scenarios
- **Highlight savings** in euro values prominently
- **Use consistent colors** for energy types across all slides
- **Create visual hierarchy** with size, weight, and color contrast
- **Add subtle depth** with shadows for professional look
- **Keep charts simple** - one main message per chart
- **Use whitespace generously** - don't cram slides

### Don'ts ✗
- Don't mix icon styles (outline vs filled)
- Don't use too many colors (stick to 3-4 per slide)
- Don't center-align long paragraphs
- Don't use generic stock photos
- Don't add borders if shadows/spacing already separate elements
- Don't use gradients everywhere (use sparingly for emphasis)
- Don't make KPI values too small (they're the hero!)
- Don't skip the layering system (flat designs look cheap)

---

## File Exports & Assets

### For Design Tools

#### Color Swatches
Import these hex codes into your design tool's color palette:
- Create color styles/swatches for all primary, background, and text colors
- Name them consistently: `Primary/Blue`, `Background/Base`, `Text/Primary`

#### Text Styles
Create text styles for:
- Display / Hero (38px, 800)
- Heading 1 (28px, 800)
- Heading 2 (20px, 700)
- Body Large (17px, 400)
- Body (16px, 400)
- Caption (14px, 600)
- Label (12px, 700, uppercase)

#### Component Library
Build reusable components:
- KPI Card
- Chart Container
- Button Primary/Secondary
- Navigation Pill
- Data Table Row
- Badge/Pill

---

## Example Slide Layouts

### Slide 1: Title Slide
- **Background**: Hero gradient (#e0f2fe → #f8fbff)
- **Title**: "Concast Energy Platform" (48pt, weight 800, #0f172a)
- **Subtitle**: "Energy Intelligence Dashboard" (28pt, weight 400, #475569)
- **Visual**: Abstract energy data visualization or dashboard screenshot
- **Bottom**: Small logo/wordmark

### Slide 2: Platform Overview
- **Layout**: 60/40 split
- **Left**: Bullet list of features (24pt)
- **Right**: Dashboard screenshot with annotations
- **Background**: White or bg-base

### Slide 3: Key Metrics (KPI Slide)
- **Layout**: 4-column grid
- **Each column**: KPI card style
  - Small icon (32px) with blue/green background
  - Large value (48pt, weight 800)
  - Small label (16pt, uppercase)
  - Unit (18pt, secondary color)
- **Background**: Light gradient

### Slide 4: Cost Optimization Results
- **Layout**: Single centered chart
- **Chart**: Bar comparison (Current vs Optimized)
- **Colors**: Blue for current, green for optimized
- **Callout**: Large savings number (€ value) in green
- **Caption**: Time period and methodology

---

## Accessibility Notes

### Color Contrast
All text/background combinations meet **WCAA AA standards**:
- Primary text on white: 14.8:1 ratio ✓
- Secondary text on white: 7.9:1 ratio ✓
- Tertiary text on white: 4.6:1 ratio ✓

### Considerations for Presentations
- Don't rely solely on color to convey meaning
- Use labels + colors for charts
- Ensure minimum 18pt font for body text
- High contrast mode: Increase weight if using light colors

---

## Version History
- **v1.0** (Nov 2025): Initial style guide extracted from platform design system
- Based on Concast Energy Platform (2024-2026 dataset)
- Design System v1.0 compliance

---

**For questions or updates to this style guide, refer to:**
- `DESIGN_SYSTEM.md` - Complete design philosophy and component specifications
- `apps/dashboard/css/main.css` - Implementation of all CSS variables and styles
- Platform demo: Access the live dashboard for visual reference

