# CLAUDE.md — Roofing Quote Funnel

This file documents the architecture, business logic, and conventions of the **Roofing Quote Funnel** app.
Update this file whenever a significant feature is added or changed.

## Folder-Level Documentation

Each folder has its own detailed MD file. Read these before editing files in that folder.

| Folder | Documentation |
|---|---|
| `components/` | [components/COMPONENTS.md](components/COMPONENTS.md) — BackgroundMedia, ProgressBar, QuoteFunnel shell |
| `components/steps/` | [components/steps/STEPS.md](components/steps/STEPS.md) — Every step, every button, every Firestore write, lead capture bypass analysis |
| `app/` | [app/APP.md](app/APP.md) — layout, tracking scripts, API route pricing engine |
| `hooks/` | [hooks/HOOKS.md](hooks/HOOKS.md) — useFunnelStore, state shape, step routing, all exported functions |
| `services/` | [services/SERVICES.md](services/SERVICES.md) — Firestore collection schemas, all write functions, ghost write flag |

---

## Business Goal

Generate an **instant roofing replacement estimate in under 60 seconds** without requiring the homeowner to contact a contractor first. The funnel captures high-intent leads, calculates a 3-tier pricing matrix using satellite roof-area data, and routes the lead to a Firestore CRM for sales follow-up.

**Conversion flow:**
1. Homeowner enters address → sees satellite imagery of their roof
2. Answers ~7 questions about their roof
3. Enters contact info (gated until the very end for max completion rate)
4. Receives a real-time Good / Better / Best price range
5. Can book a consultation via Calendly or call directly

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2.5 (App Router, React 18) |
| Language | TypeScript 5 (strict mode) |
| Styling | TailwindCSS 3.4.7 — custom navy/orange palette, custom animations |
| Animation | Framer Motion 11 — card-deck slide transitions between steps |
| State | `useReducer` inside `useFunnelStore` hook (no global Context/Redux) |
| Database | Firebase Firestore (client + Admin SDK) |
| Scheduling | react-calendly 4.4.0 |
| Rate limiting | In-memory LRU cache (lru-cache 11) |

**Build note:** Both ESLint and TypeScript errors are ignored during builds (`ignoreDuringBuilds: true` in `next.config.mjs`). Fix errors in code; don't rely on this as a permanent escape hatch.

---

## Directory Structure

```
roofing-quote-funnel/
├── app/
│   ├── layout.tsx              # Root layout — injects Google Ads + Meta Pixel scripts
│   ├── page.tsx                # Entry point — renders <QuoteFunnel />
│   └── api/
│       └── get-estimate/
│           └── route.ts        # POST — pricing engine + Google Solar API
├── components/
│   ├── QuoteFunnel.tsx         # Master orchestrator (~950 lines) — step machine + animations
│   ├── steps/
│   │   ├── Step01_Address.tsx        # Google Places V2 autocomplete
│   │   ├── Step02_Verification.tsx   # Satellite map confirmation
│   │   ├── Step03_RoofCategory.tsx   # Roof type selection (4 options)
│   │   ├── StepFlat_Details.tsx      # Flat roof: material + re-decking (conditional)
│   │   ├── StepMetal_Details.tsx     # Metal roof: standing seam vs. corrugated (conditional)
│   │   ├── Step04_Pitch.tsx          # Roof pitch: low slope vs. steep
│   │   ├── Step05_Stories.tsx        # Building stories: 1 / 2 / 3+
│   │   ├── Step06_Issues.tsx         # Current issues (multi-select)
│   │   ├── Step07_Timeline.tsx       # Project timeline / urgency
│   │   ├── Step09_LeadCapture.tsx    # Contact info form (gated last)
│   │   └── Step10_Results.tsx        # Pricing display + Calendly + phone CTA
│   ├── ProgressBar.tsx         # Visual step counter + completion %
│   └── BackgroundMedia.tsx     # Full-screen background image/video with overlay
├── hooks/
│   └── useFunnelStore.ts       # All funnel state + reducer + step routing logic
├── lib/
│   ├── firebaseAdmin.ts        # Firebase Admin SDK singleton (server-side)
│   └── pricing.ts              # Price-per-square tables + modifier calculations
├── services/
│   └── firebase.ts             # Firebase client SDK initialization
└── public/                     # Static assets (background image, material photos)
```

---

## Step Sequence & Conditional Routing

Steps are driven by internal state — **no URL changes between steps**. The step sequence is determined by `getStepSequence(roofCategory)` in `useFunnelStore.ts`.

| Step Index | Component | Shown For |
|---|---|---|
| 0 | Address Entry | All |
| 1 | Satellite Verification | All |
| 2 | Roof Category | All |
| Flat | Flat Roof Details | Flat only |
| Metal | Metal Roof Details | Metal only |
| 4 | Roof Pitch | Asphalt / Metal / Not Sure |
| 5 | Stories | All |
| 6 | Current Issues | All |
| 7 | Project Timeline | All |
| 9 | Lead Capture (Contact) | All |
| 10 | Results / Pricing | All |

**Flat roofs skip Pitch (Step 4).** Asphalt/Metal/Not Sure skip the Flat/Metal detail steps.

---

## State Management (`hooks/useFunnelStore.ts`)

All funnel state lives in a single `useReducer`. There is no React Context or external store.

### Core State Shape

```typescript
LeadData {
  addressData: {
    street, city, state, zip, lat, lng, fullAddress
  }
  propertyDetails: {
    roofCategory: 'asphalt' | 'flat' | 'metal' | 'not_sure'
    pitch:        'flat' | 'low' | 'steep'
    stories:      '1' | '2' | '3+'
    currentIssues: RoofIssue[]          // multi-select
    timeline:     'emergency' | '1-3months' | 'researching'
    flatMaterial: 'EPDM' | 'TPO' | 'Modified Bitumen' | null
    needsRedecking: boolean | null
    metalType:    'Standing Seam' | 'Corrugated (Tin)' | null
  }
  contactInfo: { firstName, lastName, email, phone }
  solarDataStatus: string               // 'pending' → set after fetchEstimate resolves
  manualHomeSqFt?: number               // user fallback when Solar API fails
  // ── Solar API granular fields (null when Solar API fails) ──────────────────
  roofAreaSquares?:  number | null      // wholeRoofStats.areaMeters2 × 10.7639 ÷ 100
  roofPitchDegrees?: number | null      // roofSegmentStats[0].pitchDegrees
  boundingBox?:      { sw: {latitude, longitude}, ne: {latitude, longitude} } | null
}
```

### Key Reducer Actions

| Action | Purpose |
|---|---|
| `GO_FORWARD` / `GO_BACKWARD` | Step navigation using the dynamic step sequence |
| `GO_TO_STEP` | Jump to a specific step index |
| `SET_ADDRESS` | Store geocoded address + lat/lng |
| `UPDATE_PROPERTY` | Update any propertyDetails field |
| `UPDATE_CONTACT` | Update contact form fields |
| `SET_QUOTE_DATA` | Store Solar API result + pricing matrix |
| `SET_SOLAR_STATUS` | Store Solar API status string |
| `SET_SOLAR_DETAILS` | Store granular Solar fields (pitch, squares, boundingBox) in leadData |
| `SET_FIREBASE_DOC_ID` | Store the ghost-write Firestore document ID |

### Company Profile Flags (loaded from Firestore `companies/C_0001`)

| Flag | Default | Purpose |
|---|---|---|
| `enableGhostWrites` | true | Write partial data to Firestore as user progresses |
| `captureAdvancedSolarData` | false | Fetch roof segments + satellite imagery URL |
| `allowedStates` | [] | If set, restricts which states are accepted |
| `showPhoneButton` | true | Show "Call Us" button on Results step |
| `phoneF` | — | Phone number for CTA button |
| `calendlyUrl` | — | Calendly embed URL on Results step |
| `showPromoBanner` | false | Show promotional banner on Results step |
| `promoBannerText` | — | Banner copy |

---

## Pricing Engine (`app/api/get-estimate/route.ts` + `lib/pricing.ts`)

### Base Price-Per-Square (100 sq ft) Rates

| Material | Good | Better | Best |
|---|---|---|---|
| Asphalt | $390–580 | $440–620 | $510–800 |
| Flat | $500–600 | $650–750 | $800–900 |
| Metal | $525–615 | $640–705 | $720–795 |

### Additive Price Modifiers

| Condition | Modifier |
|---|---|
| 2 stories | +15% |
| 3+ stories | +30% |
| Steep pitch | +20% |
| Low pitch | +5% |
| Emergency timeline | +10% |
| 3+ current issues | +5% |
| TPO flat membrane | +10% |
| Full re-decking needed | +15% |
| Standing Seam metal | +15% |

All modifiers stack additively. Modifiers are applied per tier (Good / Better / Best) to the base rate, then multiplied by roof area in squares (sq ft ÷ 100).

### When the Solar API is Called

**The Solar API call (`fetchEstimate`) is deferred until after the user submits valid contact info on Step 9 (Lead Capture).** It is no longer triggered at Step 0 (Address Entry).

**Step 9 submit flow:**
1. Validate all contact fields client-side.
2. `syncToFirebase(leadData, docId)` — write the full lead to Firestore (status: 'new').
3. `await fetchEstimate(addressData, docId)` — call `/api/get-estimate`; spinner stays visible.
4. `goForward()` — advance to Step 10 with prices already populated.

This eliminates Solar API costs for users who abandon the funnel before submitting contact info.

### Roof Area Source (Priority Order)

1. **Google Solar API** — `buildingInsights:findClosest` → `solarPotential.wholeRoofStats.areaMeters2` → converted to sq ft
2. **Firestore Cache** — Previous Solar API result for the same normalized address (avoids repeat billing)
3. **Manual Entry Fallback** — User enters home interior sq ft on Step 10; client-side scales by 1.35 per floor to estimate roof area
4. **Hard Fallback** — 1,044 sq ft (97 m²) when Solar API returns 404/403/400 and no cache exists

**Rate limit:** 3 Solar API requests per IP per 24 hours (in-memory LRU cache — resets on server restart).

---

## External Integrations

### Google APIs (single API key: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)

| API | Usage | Step |
|---|---|---|
| Places API V2 | Address autocomplete with session tokens | Step 0 |
| Static Maps API | Satellite imagery `zoom=19` + red pin | Step 1 |
| Solar API | Roof area estimation from coordinates | Backend (triggered after Step 9 Lead Capture submission) |

**Required GCP enablements:** Maps JavaScript API, Places API (New), Geocoding API, Solar API.

### Firebase / Firestore

**Client SDK** (`services/firebase.ts`) — anonymous public write access to `funnel_damon` collection.

**Admin SDK** (`lib/firebaseAdmin.ts`) — server-side updates from `/api/get-estimate` (writes Solar status + IP to the existing ghost-write document).

**Collections:**

| Collection | Purpose |
|---|---|
| `funnel_damon` | One document per lead session; ghost-written during funnel, completed on Step 9 submit |
| `companies` | CRM config per tenant; `C_0001` is the primary company document |

**Document lifecycle in `funnel_damon`:**
- `addDoc` on Step 0 (first address keystroke) → stores `companyId`, `source`, `createdAt`, `isRead: false`, `typeCastF`
- `updateDoc` on each step transition → ghost-writes `lastStepCompleted` (drop-off tracking)
- `updateDoc` on address commit → writes `addressF`
- `updateDoc` on flat/metal detail steps → writes `flatMaterial`, `needsRedecking`, or `metalType`
- `updateDoc` on Step 9 submit → writes full `leadData` blob, `status: 'new'`, `submittedAt`
- `updateDoc` from server `/api/get-estimate` (fires after Step 9) → writes `solarDataStatus`, `ipAddress`, `roofAreaSquares`, `roofPitchDegrees`, `boundingBox`, optional `advancedSolarMetrics`

### Conversion Tracking

Both tags are injected in `app/layout.tsx` `<head>` for proper scanner detection.

| Platform | ID |
|---|---|
| Google Ads (GTM) | `AW-18121619085` |
| Meta Pixel | `278410202537659` |

### Calendly

`react-calendly` InlineWidget embedded on Step 10. URL sourced from `companies/C_0001.calendlyUrl`.

---

## Environment Variables

### Public (browser-accessible)

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY       # Used for Maps, Static Maps, Solar, and Places
```

### Server-only

```
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY            # Full PEM key — include \n newlines in env string
```

**Build safety:** If Admin credentials are missing at build time, a dummy project ID prevents a crash. Production deployments require all three Admin vars.

---

## Styling Conventions

- **Navy palette:** Custom Tailwind colors `navy-950` through `navy-500` — used for backgrounds, cards, borders.
- **Brand orange:** Single accent color for CTAs, highlights, active states.
- **Custom animations:** `fade-in`, `shimmer`, `bounce-in`, `ping-slow` — defined in `tailwind.config.ts`.
- **Custom shadows:** `card-glow`, `input-focus` — used on interactive elements.
- **Background:** Full-screen fixed image/video via `BackgroundMedia.tsx` with dark overlay + dot-grid texture.
- Framer Motion handles all step transition animations (slide left/right, fade in/out).

---

## Key Conventions & Gotchas

- **Ghost writes are incremental.** Every step completion calls `updateDoc` with `{ merge: true }` — never overwrites prior data. Do not switch to `setDoc` without careful review.
- **Step routing is a computed array,** not a simple counter. Always use `getStepSequence()` and navigate via `GO_FORWARD` / `GO_BACKWARD` — never manually increment `currentStep`.
- **Phone number formatting** is applied client-side in `Step09_LeadCapture.tsx` on input change — stored as formatted string (e.g. `(704) 555-1234`).
- **Google Places V2** uses session tokens — one token per autocomplete session to reduce billing. Tokens are created on component mount and discarded after `fetchFields` resolves.
- **Solar API errors** are not thrown — they return a `solarDataStatus` string. The pricing engine always returns a result (using fallback area if needed).
- **`companyId: 'C_0001'`** is hardcoded everywhere. This is the multi-tenant hook; to support a second company, this needs to become a runtime config value.

---

## Planned / Future Expansion Areas

> Add notes here as new features are planned or shipped.

- [ ] Multi-tenant support: replace hardcoded `C_0001` with dynamic company resolution (subdomain, query param, or config)
- [ ] Webhook / email notification on new lead submission
- [ ] Admin dashboard for viewing / managing leads from `funnel_damon`
- [ ] A/B testing on step order or copy
- [ ] SMS confirmation to homeowner after Step 9 submit
- [ ] Additional roof categories (e.g. Tile, Slate)
- [ ] Expanded pricing modifiers (e.g. skylight count, chimney, regional labor factor)
