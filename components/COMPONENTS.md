# components/ — Root Component Documentation

These are the three shell components that wrap every step of the funnel.
They never contain business logic — they handle layout, animation, and navigation chrome only.

---

## 1. QuoteFunnel.tsx

**Purpose:** Master orchestrator. Owns the step-rendering switch and the Framer Motion slide animation wrapper. Every other component is a child of this one.

### Layout Layers (back → front)

| z-index | Element | Notes |
|---|---|---|
| `-z-10` | `BackgroundMedia` | Fixed to viewport, never scrolls |
| `z-10` | `/side-left.png` and `/side-right.png` | Fixed, desktop only (`lg:block`), decorative |
| `z-20` | Main content column | In document flow — scrolls naturally |

The root div uses `min-h-dvh` (not `h-dvh`) so long steps like Results can scroll past the viewport without clipping.

### On Mount (useEffect, runs once)

1. Calls `store.fetchProfile()` → reads `companies/C_0001` from Firestore → populates all CRM flags into store state (ghost writes, Calendly URL, phone, promo banner, allowed states).
2. Calls `fetchCompanyProfile()` locally → reads `logoUrl` for the `LogoHeader` component.

**No Firestore write on mount.**

### `renderStep()` — Step Index Map

| `currentStep` value | Component rendered |
|---|---|
| `0` | `Step01_Address` |
| `1` | `Step02_Verification` |
| `2` | `Step03_RoofCategory` |
| `3` | `StepFlat_Details` |
| `4` | `StepMetal_Details` |
| `5` | `Step04_Pitch` |
| `6` | `Step05_Stories` |
| `7` | `Step06_Issues` |
| `8` | `Step07_Timeline` |
| `10` | `Step09_LeadCapture` |
| `11` | `Step10_Results` |

Step index `9` (Financing) is removed from all sequences and from `renderStep`. It returns `null`.

### Animation — "Card Deck" Slide

All step transitions use Framer Motion `AnimatePresence mode="wait"` so only one step card is in the DOM at a time.

| Direction | Enter position | Exit position |
|---|---|---|
| Forward | Slides in from `x: 100%` (right), `opacity: 0`, `scale: 0.97` | Exits to `x: -35%` (slight left), `opacity: 0` |
| Backward | Slides in from `x: -100%` (left) | Exits to `x: 35%` (slight right) |

The enter spring: `stiffness: 320, damping: 32, mass: 0.8` — gives a snappy feel with a little overshoot absorbed.

The `[overflow-x:clip]` wrapper on the animation container prevents horizontal scroll during the slide without creating a new scroll container (which would block vertical scrolling on Results).

### `LogoHeader` Sub-Component

- Shown on all steps (scrolls with page).
- If `logoUrl` is null, renders a `shimmer-bg` placeholder skeleton the same size as the logo.
- If the logo image fails to load (`onError`), hides the element with `visibility: hidden`.
- `pointer-events-none` on the wrapper; `pointer-events-auto` on the image so the logo is not accidentally tappable.

### UI Colors & Styling

| Element | Tailwind class / color |
|---|---|
| Flanking images | `fixed`, `w-52 xl:w-72`, hidden below `lg` |
| Logo placeholder skeleton | `bg-white/10 shimmer-bg` |
| Overall background | Handled by `BackgroundMedia` — dark slate overlay |

---

## 2. ProgressBar.tsx

**Purpose:** Shows the user's current position and overall completion percentage. Hidden on Step 0 (the hero address step) to keep the first impression clean.

### Visibility Rule

```tsx
if (currentStep === 0) return null;
```

The bar does not render on the address entry step. It appears from Step 1 onward.

### What It Shows

```
Step {visualStep} of {totalSteps}    [STEP LABEL]    {progress}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[████████████░░░░░░░░░░░░░░░░░░░] ← animated fill bar
```

- **`visualStep`** — position within the dynamic step sequence (e.g. 3 of 9 for flat, 3 of 9 for asphalt). Flat and asphalt paths both have 9 steps, so the total is always consistent.
- **`totalSteps`** — total steps in the active sequence.
- **`progress`** — 0–100% integer from `calculateProgress()` in `useFunnelStore`. Increments as fields are filled (not just as steps advance).
- **`label`** — step name from `STEP_LABELS` (e.g. "Address", "Roof Type", "Your Info").

### Step Labels

| Step index | Label |
|---|---|
| 0 | Address |
| 1 | Verification |
| 2 | Roof Type |
| 3 | Flat Details |
| 4 | Metal Details |
| 5 | Pitch |
| 6 | Stories |
| 7 | Issues |
| 8 | Timeline |
| 10 | Your Info |
| 11 | Results |

### UI Colors & Styling

| Element | Class / color |
|---|---|
| Bar background | `bg-slate-950/70 backdrop-blur-md border-b border-white/5` |
| "Step X of Y" text | `text-white/50 text-xs` |
| Step label | `text-white/70 text-xs uppercase tracking-widest` |
| Percentage | `text-orange-400 text-xs font-bold tabular-nums` |
| Track | `h-1 bg-white/10` |
| Fill | `progress-fill rounded-r-full` (custom class from globals.css — likely a gradient or solid orange) |
| Fill animation | `width: progress%` with `duration: 0.5s ease [0.4, 0, 0.2, 1]` |

---

## Design System — Visual Distinction: Interactive vs. Informational

Two visual tiers exist in the funnel UI. The difference in blur depth, border weight, and corner radius is the three-cue system that tells users "this is information, not an action" without any labelling.

### Tier 1 — Interactive / Clickable Cards (option-card token)

Used on all selectable option cards across Steps 02–07.

| Property | Value |
|---|---|
| Background (unselected) | `bg-white/15` |
| Background (selected) | `bg-orange-500/20` |
| Border (unselected) | `border-2 border-white/10` |
| Border (selected) | `border-2 border-orange-500` |
| Blur | `backdrop-blur-md` |
| Corner radius | `rounded-2xl` |
| Shadow (selected) | `shadow-card-glow` |
| Class marker | `option-card` |
| Has hover states | Yes — `hover:border-white/25 hover:bg-white/25` |
| Has cursor change | Yes — pointer (default button behaviour) |
| Tappable | Yes |

### Tier 2 — Informational Panels (info-panel-card token)

Used on every `*InfoPanel` component across Steps 02–09. Apply the full class list below to the **outer wrapper div only**. Never apply it to inner sub-cards.

| Property | Value |
|---|---|
| Background | `bg-gradient-to-b from-white/[0.08] to-white/[0.03]` |
| Blur | `backdrop-blur-xl` |
| Border | `border border-white/[0.18]` (single weight — thinner than option cards) |
| Shadow | `shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_24px_rgba(0,0,0,0.25)]` |
| Corner radius | `rounded-3xl` |
| Position | Must include `relative overflow-hidden` for the top-highlight line |
| Has hover states | No |
| Has cursor change | No |
| Tappable | No |

**Top-edge highlight line** — add as the first child inside every info-panel-card outer wrapper:

```tsx
<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-t-3xl" />
```

**Inner sub-cards** — direct children that are themselves card-shaped (e.g. the roof type cards in `RoofTypesInfoPanel`, the explanation rows in `PitchInfoPanel`, the process steps in `ProcessInfoPanel`) should use:

```
bg-white/[0.05] border border-white/[0.10] rounded-2xl
```

Do **not** apply the gradient or metallic shadow to inner sub-cards — only the outer wrapper gets the full token.

**Section eyebrow labels** inside panels (the small uppercase tag lines):

```
text-white/40 text-xs font-semibold uppercase tracking-[0.15em]
```

### Rationale — the three cues at a glance

| Cue | Interactive card | Informational panel | Signal |
|---|---|---|---|
| Blur | `backdrop-blur-md` | `backdrop-blur-xl` | Panel feels deeper / further back |
| Border weight | `border-2` | `border` (1px) | Thinner border = not a pressable target |
| Corner radius | `rounded-2xl` | `rounded-3xl` | Larger radius = more "display surface" than "button" |

Together these three differences make the visual hierarchy legible without any text labels explaining what is interactive.

---

## 3. BackgroundMedia.tsx

**Purpose:** Full-screen fixed background layer. Accepts either a static image or a looping video. Configured by a single constant at the top of the file.

### Configuration

```typescript
const BACKGROUND_MEDIA_URL = '/bg-main.jpg';
// Change to '/bg-main.mp4' or '/bg-main.webm' for video.
```

The component auto-detects media type by checking the file extension regex `/\.(mp4|webm)$/i`.

### Layer Stack (within the `-z-10` container)

| Layer | Class | Purpose |
|---|---|---|
| Media (img or video) | `absolute inset-0 w-full h-full object-cover` | Fills viewport, crops edges |
| Dark overlay | `bg-black/50` | Makes white funnel text readable over any photo/video |
| Dot-grid texture | `radial-gradient` white dots on transparent, `28px 28px` repeat, `opacity-40` | Adds subtle depth / noise |

### Video Attributes (when video is used)

| Attribute | Value | Reason |
|---|---|---|
| `autoPlay` | true | Starts immediately without user gesture |
| `muted` | true | Required by browsers to permit autoPlay |
| `loop` | true | Seamless continuous loop |
| `playsInline` | true | Prevents iOS Safari from going fullscreen |

### No Interactive Elements

`pointer-events-none` on the root container — the background never intercepts clicks.

---

## How the Three Components Relate

```
<QuoteFunnel>
  ├── <BackgroundMedia />         ← fixed background, never scrolls
  ├── <img side-left.png />       ← fixed decorative, lg+ only
  ├── <img side-right.png />      ← fixed decorative, lg+ only
  └── <div z-20>                  ← scrollable content column
        ├── <LogoHeader />        ← scrolls with page
        ├── <ProgressBar />       ← scrolls with page (hidden on step 0)
        └── <AnimatePresence>
              └── <motion.div>   ← animated step card
                    └── {renderStep()} ← one of the 11 step components
```
