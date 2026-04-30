# components/steps/ — Step-by-Step Component Documentation

## Info Panel Styling

All `*InfoPanel` components use the **info-panel-card** token documented in [COMPONENTS.md — Design System — Visual Distinction: Interactive vs. Informational](../COMPONENTS.md#design-system--visual-distinction-interactive-vs-informational). Apply this token to the outer wrapper of every info panel. Do not re-style panels independently — always reference the token so the three-cue visual hierarchy (blur depth, border weight, corner radius) stays consistent across all steps.

---

Each step component receives the full `FunnelStore` object as its only prop.
Steps are stateless from the app's perspective — all data lives in `useFunnelStore`.

---

## Firestore Write Summary (Quick Reference)

| Trigger | Fields Written | Collection | Write Type |
|---|---|---|---|
| User types ≥1 char in address field (1s debounce) | `typeCastF`, `source`, `companyId`, `isRead`, `createdAt` | `funnel_damon` | `addDoc` (first time) |
| User selects address from dropdown | `addressF` | `funnel_damon` | `updateDoc` |
| Every step transition (all steps) | `lastStepCompleted` | `funnel_damon` | `updateDoc` |
| StepFlat_Details → Continue | `flatMaterial`, `needsRedecking` | `funnel_damon` | `updateDoc` |
| StepMetal_Details → card tap | `metalType` | `funnel_damon` | `updateDoc` |
| Step09_LeadCapture → "See My Price" (success, first write) | Full `leadData` blob, `status: 'new'`, `submittedAt` | `funnel_damon` | `updateDoc` |
| Step09_LeadCapture → after Firebase save, `/api/get-estimate` resolves | `solarDataStatus`, `ipAddress`, `roofAreaSquares`, `roofPitchDegrees`, `boundingBox` | `funnel_damon` | `updateDoc` (server Admin SDK + client SDK) |
| Step10_Results → GateOverlay "Calculate My Estimate" | `manualHomeSqFt` | `funnel_damon` | `updateDoc` |
| Step10_Results renders with missing `pricingMatrix` | `systemError`, `errorTimestamp` | `funnel_damon` | `updateDoc` |

**Ghost writes (all writes except Step09 final submission) are gated by `_ghostWritesEnabled`** — a module-level flag set from `companies/C_0001.enableGhostWrites`. When disabled, `syncLeadToDatabase` is a no-op and returns a mock success.

The final Step09 submission (`syncToFirebase`) is **never** gated — it always writes to Firestore.

> **Architecture note — Solar API timing:** `fetchEstimate` is called **after** `syncToFirebase` succeeds in Step 9, not at Step 0. This means the Solar API is only called for confirmed leads who submitted valid contact info, eliminating API costs for funnel drop-offs.

---

## Step 0 — Step01_Address.tsx

**Physical step index:** `0`
**Route:** Always first in every sequence.

### What the User Sees

- Trust badge: "Free Estimate · No Obligation · 60 Seconds" (orange check, white/10 pill with white/20 border)
- H1 headline: "Get Your Free **Roof Estimate** Instantly" (white / orange-400 accent)
- Subtitle: `text-white/60`
- Address input card: white `rounded-2xl`, `shadow-2xl`, `ring-1 ring-slate-200`
- CTA button: disabled state = `bg-white/10 text-white/30 cursor-not-allowed`; enabled = `bg-orange-500 hover:bg-orange-600`
- Fine print: `text-white/40 text-xs` — updates between "Start typing…" and "Press Enter or tap…"

### Address Input States

| State | Leading icon | Input ring |
|---|---|---|
| Idle / unfocused | `MapPin` (slate-400) | `ring-1 ring-slate-200` |
| Focused | `MapPin` (orange-500) | `ring-2 ring-orange-400 shadow-card-glow` |
| Geocoding | `Loader2` spinning (orange-400) | N/A |
| Address selected | `CheckCircle` (green-500) | `ring-2 ring-orange-400` |

### Autocomplete Dropdown

Appears when: input is focused AND suggestions exist AND not geocoding.

Each suggestion row: `hover:bg-orange-50`, `MapPin` (orange-400), bold main text + muted secondary text.
Google attribution logo rendered at bottom of dropdown (required by Google ToS).

Dropdown closes on outside click (mousedown listener on document).

### Every Action & Its Outcome

#### User types in the input (any character)

1. `setSelected(null)` — clears any previously selected address.
2. `setAddressError(null)`, `setGeoError(null)` — clears any error messages.
3. **Autocomplete (300ms debounce):** If `val.length >= 3` and Maps API is ready:
   - Creates a `AutocompleteSessionToken` on first keystroke of a new session.
   - Calls `google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions()`.
   - Filters to `placePrediction != null`, max 5 results.
   - Sets `suggestions` state → dropdown renders.
4. **Ghost write (1000ms debounce):** If `ENABLE_GHOST_CAPTURE` is true and value is non-empty:
   - Calls `syncLeadToDatabase({ typeCastF: val.slice(0, 50) }, existingDocId)`.
   - **First write:** `addDoc` → creates `funnel_damon` document with `companyId: 'C_0001'`, `isRead: false`, `createdAt`, `typeCastF`.
   - Stores returned `docId` in `localDocIdRef` (synchronous ref) and `setFirebaseDocId` (async state).

#### User clicks a suggestion in the dropdown

1. Validates the suggestion has a house number in the first 8 characters (`hasHouseNumber()`). If not (e.g. user selected a city), shows `addressError: 'Please select a valid address.'` and clears the dropdown.
2. `setQuery(pred.text.text)` — fills the input with the full address string.
3. `setIsGeocoding(true)` — shows spinner.
4. Calls `pred.toPlace()` then `place.fetchFields(['formattedAddress', 'location', 'addressComponents'])`.
5. Clears `sessionTokenRef` — closes the billing session.
6. Calls `handleCommitAddress(buildAddressData(pred, place))`.

#### `handleCommitAddress(address)` — internal commit function

1. **Geographic restriction check:** If `allowedStates` doesn't include `'ALL'` and `address.state` is not in `allowedStates`, shows `geoError` and returns early. No Firestore write. No advance.
2. Cancels any pending ghost-write debounce timer.
3. `setSelected(address)`, `setQuery(address.fullAddress)`, `setSuggestions([])`.
4. `updateAddress(address)` → stores address in store state.
5. **Ghost write (address commit):** Awaits any in-flight ghost write promise first (prevents duplicate `addDoc` race). Then calls `syncLeadToDatabase({ addressF: address.fullAddress }, localDocIdRef.current)`.
   - `updateDoc` if `localDocIdRef.current` exists; `addDoc` if not (fallback if ghost write was skipped).
6. `setTimeout(() => goForward(), 350)` — advances to Step 1 after 350ms.

> **Note:** `fetchEstimate` is no longer called here. The Solar API call has been moved to Step 9 (Lead Capture) and fires only after the user submits valid contact info. This eliminates Solar API costs for sessions that abandon before the contact form.

#### User clicks "Get My Free Estimate" button

Calls `handleAdvance()`:
- If `!selected` or `isGeocoding`: no-op (button is visually disabled).
- Otherwise: calls `handleCommitAddress(selected)` → same flow as above.

#### User presses Enter key

Same as clicking the button — calls `handleAdvance()`.

#### User clicks the × clear button

- Clears `query`, `selected`, `suggestions`.
- Resets `sessionTokenRef`.
- Re-focuses the input.
- No Firestore write.

---

## Step 1 — Step02_Verification.tsx

**Physical step index:** `1`
**Route:** Always second in every sequence.

### What the User Sees

- Header: "Is this your property?" with `text-orange-400` eyebrow
- Satellite map card: `bg-white/5 border-white/10 rounded-3xl shadow-2xl`
- Address info row with `MapPin` icon in `bg-orange-500/20` circle
- Two buttons: "Confirm My Property" (orange CTA) and "That's not my address — go back" (text link)
- "Satellite" live badge in top-right of map (`bg-black/60 backdrop-blur-sm`, green pulsing dot)

### Satellite Map URL

Built from: `lat`, `lng`, `zoom=19`, `size=800x400`, `maptype=satellite`, red marker pin, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

If `lat === 0` (manual entry with no geocode): `staticMapUrl` is `null` — no image request is made. Map area shows the dark fallback placeholder immediately.

### Loading States

| State | Map area | Address row |
|---|---|---|
| Loading (image in-flight) | `shimmer-bg` opacity-100, image opacity-0 | Skeleton rows (shimmer) |
| Loaded | Image opacity-100, shimmer fades | Full address text |
| Error (API failed) | Dark gradient + `Satellite` icon + text | Full address text |

Both action buttons are hidden during loading and shown once `isLoading === false`.

### Every Action & Its Outcome

#### "Confirm My Property" button (orange)

- Calls `goForward()` → advances to Step 2 (Roof Type).
- **No Firestore write on this step.**

#### "That's not my address — go back" text link OR Back arrow button

- Calls `goBackward()` → returns to Step 0 (Address).
- **No Firestore write.**

### Info Panel — SatelliteInfoPanel

Always-visible education card rendered below the "That's not my address" button, inside the same `max-w-xl` column. Never conditional on map load state.

**Header image:** Unsplash aerial neighbourhood photo (`photo-1524813686514-a57563d77965`, `w=800&q=80`). Dark `bg-gradient-to-t from-black/60` overlay. "Satellite imaging active" badge in the bottom-left corner — green pulse dot + text, identical style to the Satellite badge on the map card above.

**Three content rows** (icon container left, title + body right):

| Row | Icon | Icon colour | Title | Body |
|---|---|---|---|---|
| 1 | `CheckCircle` | `text-green-400` / `bg-green-500/20` | What the system measures | Exterior roofline footprint, ridge lines, and total slope area — derived directly from satellite data. |
| 2 | `AlertTriangle` | `text-orange-400` / `bg-orange-500/20` | What it cannot assess | Structural damage, underlayment condition, decking rot, flashing integrity, and attic ventilation. |
| 3 | `Shield` | `text-blue-400` / `bg-blue-500/20` | Free on-site inspection — always included | Every job starts with a complimentary in-person inspection before scheduling begins. |
| 4 | `MessageCircle` | `text-violet-400` / `bg-violet-500/20` | Full free consultation — before you commit | We walk you through every line of your estimate in person before anything is scheduled. No pressure, no surprises — just clear answers so you can decide with confidence. |

**Trust quote box:** `border border-white/10 rounded-2xl` inner container with italic `text-white/40 text-xs` quote: *"We believe transparency builds better relationships than surprise invoices. This estimate is yours — no obligation."*

**Icons added to import:** `AlertTriangle`, `Shield`, `MessageCircle` (added alongside existing `CheckCircle`). `CheckCircle` was already imported.

**Styling:** `bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl` — matches the satellite map card directly above. Body copy uses `text-white/50 text-xs leading-relaxed`. No Framer Motion.

---

## Step 2 — Step03_RoofCategory.tsx

**Physical step index:** `2`
**Route:** Always third in every sequence.

### What the User Sees

Four option cards in a column:

| Card | Emoji | Label | Description | Detail text |
|---|---|---|---|---|
| Asphalt | 🏠 | Asphalt Shingles | Most common in the US | Classic look · Affordable · 25–50 yr lifespan |
| Flat | 🏢 | Flat / Low Slope | Membrane or modified bitumen | TPO · EPDM · Modified Bitumen |
| Metal | ⚡ | Metal Roof | Standing seam or corrugated | Longest lifespan · Energy efficient · Premium |
| Not Sure | 🤔 | Not Sure | I'm not certain of my roof type | No problem — we'll identify it during the inspection |

### Card Styling

| State | Border | Background |
|---|---|---|
| Unselected | `border-white/10` | `bg-white/15` |
| Hovered | `border-white/25` | `bg-white/25` |
| Selected | `border-orange-500` | `bg-orange-500/20 shadow-card-glow` |

Selected card also shows: orange checkmark badge, icon area changes to `bg-orange-500/25`, description text turns `text-orange-300`.

### Every Action & Its Outcome

#### Tapping any option card

1. `updatePropertyDetails({ roofCategory: value })` — commits selection to store.
2. `setTimeout(() => goForward(), 300)` — advances after 300ms visual feedback.
3. **This selection controls the entire remaining step sequence:**
   - `asphalt` / `metal` / `not_sure` → sequence: `[0, 1, 2, 5, 6, 7, 8, 10, 11]` (skips Flat Details and Metal Details)
   - `flat` → sequence: `[0, 1, 2, 3, 6, 7, 8, 10, 11]` (includes Flat Details, skips Pitch and Metal Details)
4. **No Firestore write on this step.** (Ghost write system does not currently capture `roofCategory`.)

#### Back arrow button

- Calls `goBackward()` → returns to Step 1 (Verification).
- **No Firestore write.**

### Info Panel — RoofTypesInfoPanel

Always-visible education card rendered below the four option cards, inside the same `max-w-xl` column.

**Data array:** `ROOF_TYPE_INFO` — module-level const defined above the `Props` interface in the same file. Three entries (one per card; "Not Sure" is excluded by design).

**Props:** `selected: RoofCategory | null` and `onContinue: () => void` — passed from the parent step component. `selected` drives the Continue button's enabled/disabled state.

**Auto-advance removed:** `handleSelect` in the parent no longer calls `goForward()` automatically. The user selects a card (highlights it), reads the panel, then taps Continue to advance.

**Three stacked cards** — each a horizontal flex strip:

| Roof Type | Unsplash photo URL | Cost badge | Tagline | Lifespan | Accent color |
|---|---|---|---|---|---|
| Asphalt Shingles | `photo-1570129477492-45c003edd2be?w=200&q=80` | Budget–Mid | The most-installed roof type in North America | 25–50 yrs | Blue — `bg-blue-500/20 text-blue-300`, `border-blue-400/20` |
| Flat / Low Slope | `photo-1558618666-fcd25c85cd64?w=200&q=80` | Mid | Membrane systems designed for minimal-pitch surfaces | 20–30 yrs | Teal — `bg-teal-500/20 text-teal-300`, `border-teal-400/20` |
| Metal Roof | `photo-1600585154340-be6161a56a0c?w=200&q=80` | Premium | Long-lasting protection with superior energy performance | 40–70 yrs | Orange — `bg-orange-500/20 text-orange-300`, `border-orange-400/20` |

**Card anatomy:** `relative bg-white/5 border {borderAccentClass} rounded-2xl overflow-hidden flex`.
- Left: photo strip `w-24 flex-shrink-0 relative self-stretch overflow-hidden` — image is `absolute inset-0 w-full h-full object-cover`.
- Right: `flex-1 p-4` — bold name + cost badge on row 1, tagline (`text-white/60 text-xs`) on row 2, descriptor tag pills on row 3, lifespan (`text-white/35 text-xs`) on row 4.

**Descriptor tag pills** — rendered as a wrapping row of chip spans between the tagline and the lifespan line:

| Roof Type | Tags |
|---|---|
| Asphalt Shingles | Most Popular · Easily Repaired · Versatile · Dependable · Budget-Friendly |
| Flat / Low Slope | Low Profile · Commercial Grade · Accessible · Modern Look |
| Metal Roof | Premium · High Upfront Cost · Longest Lifespan · Energy Efficient |

**Tag color styles:**
- **Asphalt (warm tint):** `bg-orange-500/10 text-orange-300/70` — subtly warmer to reinforce Asphalt as the most practical choice.
- **Flat + Metal (neutral muted):** `bg-white/10 text-white/50` — standard muted pill style.
- All pills: `rounded-full text-xs px-2 py-0.5`, wrapping with `flex flex-wrap gap-1`.

**Asphalt "Most Popular" badge:** `isHighlighted: true` on the Asphalt entry only. Rendered as `absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl z-10` — a top-right corner label clipped neatly by the card's `rounded-2xl overflow-hidden`. The `rounded-bl-xl` gives it a curved bottom-left edge so it reads as a corner ribbon. No "Recommended" label is used — the badge, tag density, and warm tint carry the signal.

**Footer note** (below all cards): `text-center text-white/35 text-xs mt-4` — "Not sure? Select 'Not Sure' above — we'll identify it during the free inspection."

**Continue button** (below footer note): full-width `rounded-2xl py-4` button.
- Enabled (selection made): `bg-orange-500 hover:bg-orange-600 text-white shadow-card-glow` + `ArrowRight` icon.
- Disabled (nothing selected): `bg-white/10 text-white/30 cursor-not-allowed`, no icon.
- Calls `onContinue()` (which is `goForward` from the parent store).

**Outer wrapper:** `mt-10 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6` — matches the `SatelliteInfoPanel` card treatment on Step 2. No Framer Motion. Added `ArrowRight` to the lucide-react import.

---

## Conditional Step — StepFlat_Details.tsx (Flat Roofs Only)

**Physical step index:** `3`
**Route:** Only appears in the `flat` sequence after Roof Type.

### What the User Sees

Two questions on one screen:

**Q1 — Membrane Material (4 options):**

| Emoji | Label | Detail |
|---|---|---|
| ⚫ | EPDM | Rubber membrane · Long lifespan · Low maintenance |
| ⬜ | TPO | White membrane · Energy efficient · Most popular |
| 🟤 | Modified Bitumen | Asphalt-based · Budget-friendly · Easy repairs |
| 🤷 | Not Sure | We'll recommend the best option during the inspection |

**Q2 — Re-Decking Needed (3 options):**

| Label | Sub-text |
|---|---|
| Yes | The deck boards are damaged or rotted |
| No | The existing deck is in good condition |
| Not Sure | We will assess it during the inspection |

Continue button: Disabled (`bg-white/10 text-white/30`) until both questions are answered. Enabled (`bg-orange-500`) once both have been touched.

### Option Card Styling

| State | Border | Background |
|---|---|---|
| Unselected | `border-white/10` | `bg-white/5` |
| Hovered | `border-white/25` | — |
| Selected | `border-orange-500` | `bg-orange-500/10` |

Selected also shows orange checkmark badge and `text-orange-300` on sub-text.

### Every Action & Its Outcome

#### Tapping a material card (Q1)

- Sets `localMaterial` to the selected value (or `null` for "Not Sure").
- Sets `materialTouched = true` — enables the validation check.
- **Does NOT write to Firestore yet.**

#### Tapping a re-decking option (Q2)

- Sets `localRedeck` to `true`, `false`, or `null`.
- **Does NOT write to Firestore yet.**

#### "Continue" button (enabled when both questions answered)

1. `updatePropertyDetails({ flatMaterial: localMaterial, needsRedecking: redeckValue })` → commits both to store.
2. **Firestore ghost write:** Calls `syncLeadToDatabase({ flatMaterial, needsRedecking }, firebaseDocId)` → `updateDoc` on existing document.
3. `setTimeout(() => goForward(), 150)` → advances to Stories (Step 6, index 6).

**Pricing impact:**
- TPO: +10% modifier
- `needsRedecking === true`: +15% modifier

#### Back arrow button

- Calls `goBackward()` → returns to Step 2 (Roof Type).
- **No Firestore write.**

---

## Conditional Step — StepMetal_Details.tsx (Metal Roofs Only)

**Physical step index:** `4`

> **⚠️ Current Status:** This step is DEFINED as a component but is NOT included in any active step sequence. Looking at `getStepSequence()` in `useFunnelStore.ts`, the metal path returns `[0, 1, 2, 5, 6, 7, 8, 10, 11]` — step 4 is excluded. The component exists and renders correctly if manually routed to via `goToStep(4)`, but no user can reach it through normal navigation. If metal sub-type selection is needed in the future, add `4` to the metal sequence after index `2`.

### What the User Sees

Two option cards:

| Emoji | Label | Price Hint | Description | Detail |
|---|---|---|---|---|
| 🏗️ | Standing Seam | Premium tier | Concealed fasteners, premium finish | Most durable · Weather-tight · Architectural look |
| 🏚️ | Corrugated / Tin | Economy tier | Exposed fasteners, classic look | Budget-friendly · Easy to install · Agricultural style |

Price hint badge: `bg-white/10 text-white/50` (unselected) → `bg-orange-500 text-white` (selected).

### Every Action & Its Outcome

#### Tapping a card

1. `updatePropertyDetails({ metalType: value })` → commits to store.
2. **Firestore ghost write:** Calls `syncLeadToDatabase({ metalType: value }, firebaseDocId)` → `updateDoc`.
3. `setTimeout(() => goForward(), 300)` → advances to next step in sequence.

**Pricing impact:**
- Standing Seam: +15% modifier

#### Back arrow button

- Calls `goBackward()`.
- **No Firestore write.**

---

## Step 4 — Step04_Pitch.tsx

**Physical step index:** `5`
**Route:** Appears in asphalt / metal / not_sure sequences after Roof Type. Skipped for flat roofs.

### What the User Sees

Two option cards:

| Visual char | Label | Description | Impact text |
|---|---|---|---|
| `╱` | Low Slope | Gentle slope, walkable without equipment | Moderate pitch · Minor adjustment |
| `⟋` | Steep Pitch | Sharp angle, requires safety equipment | Complex install · Price adjusted +20% |

The visual character is rendered in a `text-3xl font-black` box. Unselected: `text-white/40`. Selected: `text-orange-300`.

### Every Action & Its Outcome

#### Tapping a card

1. `updatePropertyDetails({ pitch: value })` → commits to store.
2. `setTimeout(() => goForward(), 300)` → advances to Stories.
3. **No Firestore write on this step.**

**Pricing impact:**
- Low Slope: +5%
- Steep Pitch: +20%

#### Back arrow button

- Calls `goBackward()` → returns to Roof Type (Step 2).
- **No Firestore write.**

### Info Panel — PitchInfoPanel

Always-visible education card rendered below the two option cards and the existing disclaimer line, inside the same `max-w-xl` column.

**Header:** Title "How Pitch Affects Your Quote" + one-line intro paragraph explaining pitch as the primary labor variable.

**SVG diagram** inside a `bg-white/5 border border-white/10 rounded-2xl` card — two roof silhouettes side by side separated by a dashed vertical center line:

| Side | Color family | Silhouette points | Pitch ratio | Angle arc |
|---|---|---|---|---|
| Left — Low Slope | Blue — `rgba(59,130,246,…)` fill, `rgba(96,165,250,…)` stroke | `(25,180) → (100,161) → (175,180)` | ≈ 3:12 | r=22, sweep=0, ~14° |
| Right — Steep Pitch | Orange — `rgba(249,115,22,…)` fill, `rgba(251,146,60,…)` stroke | `(225,180) → (300,124) → (375,180)` | ≈ 9:12 | r=22, sweep=0, ~37° |

Angle arcs use SVG `A` path commands centered on each silhouette's left base corner (`sweep=0` = counterclockwise on screen, so the arc sweeps upward from horizontal to the slope line, making the pitch angle visually obvious). `viewBox="0 0 400 210"`, `overflow="visible"`, `className="w-full"` for full responsiveness.

Cost badges float above each ridge:
- Left: "Base rate" — green (`rgba(34,197,94,…)` / `rgba(74,222,128,…)`)
- Right: "+20% labor" — orange (`rgba(249,115,22,…)` / `rgba(251,146,60,…)`)

Labels "Low Slope" and "Steep Pitch" appear below the baseline. All SVG colors use `rgba(…)` directly — no Tailwind classes inside the SVG.

**Four explanation rows** (icon + title + body), each in a `bg-white/5 border border-white/10 rounded-2xl` card:

| Row | Icon | Icon bg | Title | Body |
|---|---|---|---|---|
| 1 | `TrendingUp` | `bg-blue-500/20 text-blue-400` | Low slope — accessible, but drainage-sensitive | Gentler angles are walkable without harnesses (base rate). Water exits slowly — proper membrane and tight lap sealing critical at flashings and transitions. |
| 2 | `TrendingUp` | `bg-orange-500/20 text-orange-400` | Steep pitch — fast drainage, specialized crew | High-angle roofs shed rain quickly, extending shingle life. Install requires harnesses/walk boards by code, slower pace, more waste at hips and valleys. +20% modifier already reflected. |
| 3 | `Droplets` | `bg-sky-500/20 text-sky-400` | Valleys, skylights & chimney transitions | Where planes meet or penetrations break the field, water concentrates. Ice & water shield + reinforced step flashing + additional underlayment layer on steeper pitches. |
| 4 | `ShieldCheck` | `bg-emerald-500/20 text-emerald-400` | Drip edge — your first defense against rot | Without drip edge, water wicks back under shingles by surface tension (like liquid creeping up the inside of a mug). Drip edge breaks that tension, protecting fascia and decking edge from hidden rot. |

**Bottom note:** `text-white/30 text-xs text-center` — "An inspector will confirm your exact pitch on-site before any work begins."

**New icon imports:** `TrendingUp`, `Droplets`, `ShieldCheck` added to the existing `import { ArrowLeft } from 'lucide-react'` line. No Framer Motion.

---

## Step 5 — Step05_Stories.tsx

**Physical step index:** `6`
**Route:** Appears in all sequences after Pitch (or after Flat Details for flat roofs).

### What the User Sees

Three option cards with a **Continue** button below. **1 Story is pre-selected by default** via local `useState` initialized to `'1'` (or the existing store value if the user navigated back).

Each card shows: emoji, label + checkmark badge (when selected), description, impact text, and three detail tag pills (access method, staging, equipment).

| Emoji | Label | Description | Impact text | Detail tags |
|---|---|---|---|---|
| 🏡 | 1 Story | Single-floor home | Standard access · Base pricing | Ground-level access · No staging needed · Standard ladders |
| 🏘️ | 2 Stories | Two-floor home | Extended staging required · +15% | Elevated reach required · Perimeter staging set · Pump jack or scaffold |
| 🏗️ | 3+ Stories | Three or more floors | Crane / rigging required · +30% | Crane or rigging needed · Full staging system · Specialized lift equipment |

Detail tags render as small rounded-full pill spans (`border border-white/10 text-white/30`, or `border-orange-400/30 text-orange-200/60` when selected).

Below all cards: an orange **Continue** button, then a small italic trust note (`text-white/30 text-xs italic`): *"Every modifier is calculated upfront and shown in your estimate range — no surprise add-ons at the time of signing."*

### Every Action & Its Outcome

#### Tapping a card

- Sets local `selected` state to the tapped value — does **not** write to the store yet.
- Card highlights immediately (orange border + background, checkmark badge, orange detail tags).
- **No Firestore write.**

#### "Continue" button

1. `updatePropertyDetails({ stories: selected })` → commits local selection to store.
2. `goForward()` → advances to Issues.
3. **No Firestore write on this step.**

**Pricing impact:**
- 2 Stories: +15%
- 3+ Stories: +30%

#### Back arrow button

- Calls `goBackward()` → returns to Pitch (asphalt/metal path) or Flat Details (flat path).
- **No Firestore write.**

---

## Step 6 — Step06_Issues.tsx

**Physical step index:** `7`
**Route:** Appears in all sequences after Stories.

### Key Difference: Multi-Select

This is the **only multi-select step**. The user can select multiple issues before continuing. At least one selection is required.

### What the User Sees

Four option cards (multi-select checkboxes):

| Emoji | Label | Description | Urgency text |
|---|---|---|---|
| 💧 | Active Leak | Water is getting into the home | Urgent — prioritized scheduling |
| 🔧 | Missing / Damaged Shingles | Visible shingles are gone or broken | Moderate — repair or full replacement |
| ⏳ | Age / Wear | Roof is nearing or past its lifespan | Proactive — great time to replace |
| 🏗️ | New Construction | Building a new home or addition | New build — quote & scheduling |

Selected: `border-orange-500 bg-orange-500/20 shadow-card-glow`
Unselected: `border-white/10 bg-white/15`

"Continue" button: Disabled (`bg-white/20 text-white/30`) when no issues selected. Enabled (`bg-orange-500`) once at least one is selected.

Below button shows: `"{N} issue(s) selected"` when at least one is selected. Shows additional note `"· Multiple issues noted for pricing"` if 3 or more are selected.

### Every Action & Its Outcome

#### Tapping a card

- **If not selected:** Adds the `RoofIssue` value to the `currentIssues` array.
- **If already selected:** Removes it from the array.
- Uses `updatePropertyDetails({ currentIssues: next })` — immutable array update.
- **No Firestore write on card tap.**

#### "Continue" button (enabled when ≥1 issue selected)

1. `goForward()` → advances to Timeline.
2. **No Firestore write on continue.**

**Pricing impact:**
- 3 or more issues selected: +5% modifier

#### Back arrow button

- Calls `goBackward()` → returns to Stories.
- **No Firestore write.**

---

## Step 7 — Step07_Timeline.tsx

**Physical step index:** `8`
**Route:** Appears in all sequences after Issues.

### What the User Sees

Three option cards:

| Emoji | Label | Badge | Badge color |
|---|---|---|---|
| 🚨 | As Soon As Possible | Priority | `bg-red-500` |
| 📅 | 1–3 Months | Most Common | `bg-green-600` |
| 🔍 | Just Researching | (none) | — |

Badge renders in a small pill to the right of the label text. Selected cards also show the orange `✓` checkmark badge.

### Every Action & Its Outcome

#### Tapping a card

1. `updatePropertyDetails({ timeline: value })` → commits to store.
2. `setTimeout(() => goForward(), 300)` → advances to Lead Capture (Step 9, physical index 10).
3. **No Firestore write on this step.**

> Note: In earlier versions, `syncLeadToDatabase({ urgency: value }, firebaseDocId)` was written here. The `urgency` field still exists in the `GhostLeadData` schema and `funnel_damon` field registry but the write call has been removed from this component. If urgency ghost writes need to be re-enabled, add `syncLeadToDatabase({ urgency: value }, firebaseDocId)` inside `handleSelect()`.

**Pricing impact:**
- Emergency: +10%

#### Back arrow button

- Calls `goBackward()` → returns to Issues.
- **No Firestore write.**

### Info Panel — TimelineInfoPanel

Always-visible education card rendered below the three option cards, inside the same `max-w-xl` column.

**Prop:** `selected: Timeline | null` — passed as `state.leadData.propertyDetails.timeline ?? null`. When `null` (no selection yet), all rows render in the default muted style.

**Header:** Title "Why Planning Ahead Saves You Money" + one-line intro paragraph explaining that timeline affects crew availability, material lead times, and final price.

**Three stacked rows** — one per timeline option. Each row is a `border rounded-2xl p-4` container with an emoji, a heading + badge strip, and a body paragraph. The row whose `value` matches `selected` is highlighted with a tinted border and background; all others stay muted (`border-white/10 bg-white/5`).

| Row | Emoji | Heading | Body | Active tint |
|---|---|---|---|---|
| emergency | 🚨 | Priority Scheduling | 48-hour crew mobilization available for urgent situations. Small rush surcharge applies and is already reflected in the estimate. | `border-red-500/50 bg-red-500/10` |
| 1-3months | 📅 | Best Material Availability | Planning 1–3 months out means optimal material availability, no rush premium, and pricing that can be locked in before seasonal changes. | `border-green-500/50 bg-green-500/10` |
| researching | 🔍 | No Pressure | Estimate is theirs to keep. No obligation to move forward on any timeline. | `border-blue-500/50 bg-blue-500/10` |

**Badges on each active row:**
- The `1-3months` row carries a permanent **"Best value"** pill (`bg-green-600 text-white text-xs font-bold rounded-full`).
- Whichever row is the active selection shows a **"Your selection"** pill (`bg-white/20 text-white/60 text-xs font-medium rounded-full`) next to its heading.

**Row data source:** Module-level `PANEL_ROWS` const defined above `TimelineInfoPanel` in the same file. Mirrors the `PANEL_ROWS` pattern used elsewhere.

**Bottom note:** `text-white/30 text-xs text-center` — "💡 Your estimate is held at today's pricing for 30 days — no obligation."

**Outer wrapper:** `mt-10 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6` — matches the card treatment used by all other Info Panels. No Framer Motion. No new icon imports (emoji only).

---

## Step 8 — Step09_LeadCapture.tsx

**Physical step index:** `10`
**Route:** Always second-to-last in every sequence. **The gate — Results cannot be reached without passing through this step.**

### What the User Sees

A form card with four fields:

| Field | Icon | Placeholder | Validation |
|---|---|---|---|
| First Name | `User` (white/30) | Jane | Required, non-empty |
| Last Name | `User` (white/30) | Smith | Required, non-empty |
| Email Address | `Mail` (white/30) | jane@example.com | Required, valid format `[^\s@]+@[^\s@]+\.[^\s@]+` |
| Phone Number | `Phone` (white/30) | (555) 000-0000 | Required, ≥10 digits |

Form card: `bg-white/15 backdrop-blur-md border border-white/20 rounded-3xl`

Field containers: `bg-white/15 rounded-xl border border-white/10`
- Focused: `border-orange-400/60`
- Error: `border-red-400/60`

Error messages: `text-red-400 text-xs` below each field (only shown when field has been `touched` AND has an error).

Submit button: `bg-orange-500` (normal), `bg-orange-500/50 cursor-not-allowed` (submitting).

Trust line: Lock icon + "Your info is encrypted and never sold to third parties" (`text-white/30 text-xs`)

### Phone Formatting

Phone is auto-formatted on every keystroke:
- `9193334444` → `(919) 333-4444`
- Strips non-digit chars, takes first 10 digits, formats as `(XXX) XXX-XXXX`.

### Every Action & Its Outcome

#### Typing in any field

- `updateContactInfo({ [field]: formatted })` → updates store state on every keystroke.
- Clears the field's error if one was showing.
- **No Firestore write.**

#### Clicking outside a field (blur)

- Marks the field as `touched` → errors will now be shown if the field is invalid.
- **No Firestore write.**

#### "See My Price" button

1. Marks all fields as `touched` (so errors appear on all invalid fields simultaneously).
2. Runs `validateForm()` — checks all four fields.
3. **If validation fails:** Sets `errors` state, shows inline field errors, stays on this step. **No Firestore write.**
4. **If validation passes:**
   - `setSubmitting(true)` — button shows spinner ("Preparing Your Results…"), form fields are disabled, back button disabled.
   - Calls `syncToFirebase(state.leadData, state.firebaseDocId)` → **FINAL Firestore write:**
     - If `firebaseDocId` exists: `updateDoc` on existing `funnel_damon` document, adding `leadData`, `status: 'new'`, `submittedAt`, `updatedAt`.
     - If no `firebaseDocId`: `addDoc` creates a new document (ghost capture was skipped/failed).
   - **If write fails:** Sets `errors.submit = 'Something went wrong. Please try again.'`, stays on step. User must retry.
   - **If write succeeds → Solar API call:**
     - `await fetchEstimate(state.leadData.addressData, state.firebaseDocId)` fires `/api/get-estimate`.
     - Spinner remains visible during this await (same `isSubmitting` flag).
     - On resolve: `quoteData` and `solarDataStatus` are stored in state; `solarDataStatus`, `ipAddress`, `roofAreaSquares`, `roofPitchDegrees`, `boundingBox` are ghost-written to Firestore.
     - `goForward()` → advances to Results (physical index 11) with pricing already populated.
5. `setSubmitting(false)` in `finally` block.

> **Why Solar API fires here:** Deferring `fetchEstimate` to after lead capture ensures the API is only called for confirmed leads. Sessions that abandon earlier in the funnel generate zero Solar API charges.

#### Back arrow button

- Disabled while `isSubmitting` is true.
- Otherwise: Calls `goBackward()` → returns to Timeline.
- **No Firestore write.**

---

## Step 9 — Step10_Results.tsx

**Physical step index:** `11`
**Route:** Always last in every sequence.

### Render State Machine (4 paths)

Because `fetchEstimate` is now awaited in Step 9 before `goForward()` is called, **Path A (Loading) should never be visible under normal conditions** — the prices are ready before Step 10 mounts. The skeleton is retained as a safety net for edge cases (extremely fast users, or if the await is ever removed).

| Path | Condition | What renders |
|---|---|---|
| A — Loading | `isCalculating === true` | 3 skeleton cards + spinner (safety net only — normally prices are pre-loaded) |
| B — Solar success | `solarDataStatus` starts with `"Success"` | 3 pricing tier cards with real sq footage |
| C1 — Solar failed, gate active | `solarDataStatus` starts with `"Failed"`, `manualHomeSqFt === 0` | Blurred tier cards + `GateOverlay` |
| C2 — Solar failed, unlocked | `solarDataStatus` starts with `"Failed"`, `manualHomeSqFt > 0` | Tier cards (prices scaled from manual sq ft) + amber warning banner |
| D — Matrix missing | `quoteData` exists but `pricingMatrix` is null | `PricingUnavailableCard` ("expert review" message) |

### Header Section

- Large green `CheckCircle` icon with `animate-ping-slow` ring
- Orange eyebrow: "Your Estimate is Ready ✓"
- H2: "Here's your personalized quote, **{firstName}**" (firstName from `contactInfo`)
- Address display: `text-white/70 font-medium`

### Property Summary Card

`bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl`

Displays 5 data points in a grid:

| Label | Icon | Value source |
|---|---|---|
| Roof Type | `Home` | `displayCategoryLabel` (maps `not_sure` → Asphalt Shingles) |
| Est. Roof Sq Ft | `Zap` | `~{sqFootage.toLocaleString()} sq ft` |
| Pitch | `Shield` | `displayPitchLabel` (maps `not_sure` → Low Slope) |
| Stories | `Star` | stories value from store |
| Timeline | `CheckCircle` | `completionDays` from pricing engine |

### Pricing Tier Cards

Three cards: Good / Better / Best.

"Better" (middle tier) is `recommended === true`, which adds:
- `border-orange-500 shadow-card-glow`
- "⭐ MOST POPULAR" banner at top of card

Each card has a gradient header (`bg-gradient-to-r ${tier.colorClass}`) with price range and completion time, and a white/15 body with a feature checklist and optional product photo.

**Product photos** are served from `/public/images/materials/{category}-{tier}.jpg`. If no image exists for a slot, the checklist fills the full width.

### GateOverlay (Path C1 — Solar Failed)

A modal overlay (`absolute inset-0`) centered over blurred tier cards:
- Lock icon in orange/15 circle
- Heading: "Unlock Your Estimate"
- Dropdown: Interior sq ft from 700 to 10,000 (steps of 100 from 700–3500, then 1000 from 4000+)
- "Calculate My Estimate" button

### Every Action & Its Outcome

#### GateOverlay "Calculate My Estimate" button

1. Validates dropdown has a selection. If not: shows `"Please select your approximate square footage"`.
2. `setManualHomeSqFt(sqFt)` → commits to store immediately → triggers re-render with Path C2 (blurred cards cleared, prices scaled from manual sq ft).
3. `saveManualSqFtToDb(sqFt)` — fire-and-forget:
   - Calls `syncLeadToDatabase({ manualHomeSqFt: sqFt }, firebaseDocId)` → **Firestore `updateDoc`**.
   - Failure is logged as a warning; does not block the UI update.

#### Phone "Prefer to call?" button (CRM-toggled, only if `showPhoneButton && phoneF`)

- `window.location.href = 'tel:' + phoneF.replace(/[^\d+]/g, '')` → initiates phone call on mobile.
- **No Firestore write.**

#### Calendly booking (CRM-toggled, only if `calendlyUrl`)

- Embedded `InlineWidget` from `react-calendly`.
- When user completes a booking, Calendly fires a `window.postMessage` event `{ event: 'calendly.event_scheduled' }`.
- The component listens and fires:
  - `gtag('event', 'conversion', { send_to: 'AW-18121619085/...', value: 1.0 })` → Google Ads conversion.
  - `fbq('track', 'Schedule')` → Meta Pixel conversion.
- **No Firestore write on booking.** (The booking confirmation is handled by Calendly's own systems.)

#### Promo banner (CRM-toggled, only if `showPromoBanner && promoBannerText`)

- Display only. Orange gradient border (`border-orange-500/50`), `Tag` icon, promotional text.
- **No button. No Firestore write.**

#### Error logging on mount

```typescript
useEffect(() => {
  if (isCalculating) return;
  if (!quoteData?.pricingMatrix || Object.keys(quoteData.pricingMatrix).length === 0) {
    logError('Missing pricingMatrix data on final render.');
  }
}, [isCalculating, quoteData, logError]);
```

If `pricingMatrix` is missing after the API call resolves: calls `logLeadError(docId, errorMsg)` → **Firestore `updateDoc`** with `{ systemError, errorTimestamp }`.

---

---

## Drop-off Tracking (`lastStepCompleted`)

Every time `currentStep` changes in the reducer, a `useEffect` inside `useFunnelStore` fires a ghost-write:

```typescript
syncLeadToDatabase({ lastStepCompleted: STEP_LABELS[currentStep] }, firebaseDocId)
```

This write is skipped if:
- `firebaseDocId` is not yet set (doc not created — user hasn't typed an address)
- The same step was already written this session (guarded by a `useRef`)

**`STEP_LABELS` mapping:**

| Step Index | `lastStepCompleted` value |
|---|---|
| 0 | `Address Entry` |
| 1 | `Roof Verification` |
| 2 | `Roof Type` |
| 3 | `Flat Roof Details` |
| 4 | `Metal Roof Details` |
| 5 | `Pitch` |
| 6 | `Stories` |
| 7 | `Issues` |
| 8 | `Timeline` |
| 10 | `Lead Capture` |
| 11 | `Results` |

This field is updated on every navigation action (`goForward`, `goBackward`, `goToStep`) because all three dispatch reducer actions that change `currentStep`, which triggers the effect.

---

## Lead Capture Bypass Analysis

**Question: Can a user reach the Results page (Step 11) without entering their name and contact info?**

### Short Answer

**Through normal UI: No.** The only code path that calls `goForward()` from Step 9 (Lead Capture) is inside `handleSubmit()`, which requires:
1. All four form fields to pass client-side validation
2. `syncToFirebase()` (Firestore write) to return `success: true`

If either condition fails, `goForward()` is never called and the user stays on Step 9.

### Exhaustive Path Analysis

#### Path 1: Enter → skip to Results via URL

**Not possible.** There is no URL routing in this app. All step state is in-memory React state. Navigating to `/?step=11` does nothing; there is no URL parameter handler.

#### Path 2: Enter → press Back from Results → press Forward

**Not possible from UI.** Results (Step 11) has no "Next" button. Pressing Back from Results goes to Step 10 (Lead Capture). From there, the user must successfully re-submit the form to advance forward again. Their contact info is already pre-filled in state from their previous submission, so re-submission would succeed immediately — but they are NOT bypassing the gate; they are passing through it again.

#### Path 3: Refresh the browser on Results

**Resets to Step 0.** All state is in-memory and not persisted to localStorage or the URL. A refresh loses everything.

#### Path 4: Developer console / JavaScript manipulation

A developer could call `store.goForward()` directly from the browser console if they can reach the store object. This is a client-side-only concern and not a realistic attack vector for a roofing funnel. The Firestore write (ghost document) would already have captured partial lead data.

#### Path 5: Firestore is down / write fails

**User is blocked.** If `syncToFirebase()` throws or returns `!success`, the catch/early-return block sets `errors.submit` and does NOT call `goForward()`. Users cannot see results if the Firestore write fails. This is by design (the gate guarantees every result viewer is a recorded lead) but is also a reliability concern: if Firebase is unavailable, users who completed all 8 prior steps cannot get their results.

### Important Finding: Metal Detail Step Is Unreachable

The `StepMetal_Details` component (physical step index `4`) exists but is **not included in any sequence**. Even users selecting "Metal" roof type follow: `[0, 1, 2, 5, 6, 7, 8, 10, 11]`. The `metalType` field is never populated via normal flow. The `+15% Standing Seam modifier` is never applied in real sessions.

**Impact:** Metal roof pricing is always calculated at the Corrugated/base rate (no metalType modifier). If this needs to be fixed, add step `4` to the metal sequence after step `2`.

### Summary Table

| Bypass Attempt | Possible? | Notes |
|---|---|---|
| URL navigation | No | No URL routing |
| Refresh on Results | No | State resets to Step 0 |
| Back-then-Forward | No | Back → Step 9 again, must resubmit |
| DevTools state manipulation | Technically yes | Not realistic for end users |
| Firestore downtime | Inverse — user gets stuck | Can't advance, not bypass |
| `not_sure` roof category | Not a bypass | Routes normally through all steps |
| Metal roof selection | Not a bypass | Routes normally; Metal Details step unreachable but not skippable to Results |
