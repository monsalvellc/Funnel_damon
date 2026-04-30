# hooks/ — State Management Documentation

The `hooks/` directory contains the single source of truth for all funnel state.

---

## useFunnelStore.ts

**Pattern:** `useReducer` — no React Context, no global provider, no Redux. State is scoped to the `QuoteFunnel` component instance that mounts the hook.

### Why useReducer (not useState or Context)

- A single top-level reducer makes the state transition graph auditable — every state change is a named action.
- Components receive `store` as a prop and call named action functions (not dispatch directly).
- No Context means no re-renders cascade to unrelated parts of the tree.

---

## State Shape (`FunnelState`)

```typescript
FunnelState {
  currentStep:              number          // 0–11 (physical step index)
  direction:                'forward' | 'backward'
  isSubmitting:             boolean         // true while Step09 Firestore write is in-flight
  isCalculating:            boolean         // true while /api/get-estimate is in-flight
  quoteData:                QuoteData | null  // populated by fetchEstimate after API resolves
  firebaseDocId:            string | null   // funnel_damon document ID once first ghost write resolves
  typeCastF:                string          // raw address typing, first 50 chars
  enableGhostWrites:        boolean         // from companies/C_0001 (default: true)
  captureAdvancedSolarData: boolean         // from companies/C_0001 (default: false)
  allowedStates:            string[]        // from companies/C_0001 (default: ['NC'])
  showPhoneButton:          boolean         // from companies/C_0001 (default: false)
  phoneF:                   string          // from companies/C_0001 (default: '')
  calendlyUrl:              string          // from companies/C_0001 (default: '')
  showPromoBanner:          boolean         // from companies/C_0001 (default: false)
  promoBannerText:          string          // from companies/C_0001 (default: '')

  leadData: {
    addressData: {
      street, city, state, zip, lat, lng, fullAddress
    } | null
    propertyDetails: {
      roofCategory:   'asphalt' | 'flat' | 'metal' | 'not_sure' | null
      pitch:          'flat' | 'low' | 'steep' | null
      stories:        '1' | '2' | '3+' | null
      currentIssues:  RoofIssue[]     // multi-select, min 1 required
      timeline:       'emergency' | '1-3months' | 'researching' | null
      flatMaterial:   'EPDM' | 'TPO' | 'Modified Bitumen' | null
      needsRedecking: boolean | null
      metalType:      'Standing Seam' | 'Corrugated (Tin)' | null
    }
    contactInfo: {
      firstName, lastName, email, phone
    }
    solarDataStatus:   string          // 'pending' → populated after fetchEstimate resolves
    manualHomeSqFt?:   number          // user-entered fallback when Solar API fails
    roofPitchDegrees?: number | null   // primary segment pitchDegrees from Solar API
    roofAreaSquares?:  number | null   // whole-roof area in roofing squares (sq ft ÷ 100)
    boundingBox?:      { sw: { latitude, longitude }, ne: { latitude, longitude } } | null
  }
}
```

> `lastStepCompleted` is **not** stored in `leadData` — it is a top-level ghost-write field written directly to `funnel_damon` on every step transition (see Drop-off Tracker below).

```typescript
```

---

## Step Sequence Routing

`getStepSequence(roofCategory)` returns the ordered array of physical step indices the user will visit.

| Roof Category | Sequence |
|---|---|
| `asphalt` | `[0, 1, 2, 5, 6, 7, 8, 10, 11]` |
| `metal` | `[0, 1, 2, 5, 6, 7, 8, 10, 11]` |
| `not_sure` | `[0, 1, 2, 5, 6, 7, 8, 10, 11]` |
| `flat` | `[0, 1, 2, 3, 6, 7, 8, 10, 11]` |
| `null` (not yet selected) | `[0, 1, 2, 5, 6, 7, 8, 10, 11]` (default) |

Step 9 (Financing) and Step 4 (Metal Details) are excluded from all active sequences.

`GO_FORWARD` finds `currentStep` in the sequence array and advances to the next index.
`GO_BACKWARD` finds `currentStep` and retreats to the previous index.

---

## Exported Functions from the Hook

| Function | What it does |
|---|---|
| `goForward()` | Advance one step in the sequence |
| `goBackward()` | Retreat one step in the sequence |
| `goToStep(n)` | Jump to any physical step index (used internally) |
| `updateAddress(data)` | Store geocoded address in `leadData.addressData` |
| `updatePropertyDetails(patch)` | Merge partial `PropertyDetails` update |
| `updateContactInfo(patch)` | Merge partial `ContactInfo` update |
| `setSubmitting(bool)` | Toggle `isSubmitting` flag |
| `setFirebaseDocId(id)` | Store the `funnel_damon` document ID after first ghost write |
| `setTypeCastF(text)` | Store raw address typing (first 50 chars) |
| `setManualHomeSqFt(n)` | Store user-entered sq ft from the GateOverlay |
| `saveManualSqFtToDb(n)` | Fire-and-forget Firestore write: `{ manualHomeSqFt: n }` |
| `fetchEstimate(address, docId?)` | Call `/api/get-estimate` and update store with result |
| `fetchProfile()` | Load `companies/C_0001` and apply CRM flags to state |
| `logError(msg)` | Write `{ systemError, errorTimestamp }` to existing doc |

---

## Progress Calculation (`calculateProgress`)

Returns `0–100` integer. Checks 11 boolean conditions:

1. `addressData.fullAddress` is set
2. `roofCategory` is set
3. If flat: `flatMaterial !== null`
4. If flat: `needsRedecking !== null`
5. If not flat: `pitch` is set
6. `stories` is set
7. `currentIssues.length > 0`
8. `timeline` is set
9. `contactInfo.firstName` is set
10. `contactInfo.email` is set
11. `contactInfo.phone` is set

Progress updates continuously as fields are filled, not just when steps advance. This is why the progress bar can move forward even while the user is still on a single step.

---

## Step Validation (`validateStep`)

Used to guard navigation. Returns `true` if the step's required data is present.

| Step | Validation rule |
|---|---|
| 0 | `addressData.fullAddress` is truthy |
| 1 | `addressData.fullAddress` is truthy |
| 2 | `roofCategory` is set |
| 3 | `flatMaterial !== null` OR `needsRedecking !== null` |
| 4 | `metalType !== null` |
| 5 | `pitch` is set |
| 6 | `stories` is set |
| 7 | `currentIssues.length > 0` |
| 8 | `timeline` is set |
| 10 | firstName, lastName, email, phone all set |
| 11 | always `true` |

---

## `fetchEstimate` — The Background Pricing Call

Called from `Step01_Address` immediately after address confirmation. Runs while the user answers Steps 1–8.

```
1. dispatch SET_IS_CALCULATING = true
2. POST /api/get-estimate { address, lat, lng, firebaseDocId, captureAdvancedSolarData }
3a. If 429: dispatch SET_SOLAR_STATUS 'Failed: Rate Limited', return early
3b. If other error: throw → catch block dispatches SET_SOLAR_STATUS 'Failed: Network/...'
4. Dispatch SET_QUOTE_DATA (stores full pricing matrix)
5. Dispatch SET_SOLAR_STATUS (stores outcome string)
6. Dispatch SET_SOLAR_DETAILS → stores roofPitchDegrees, roofAreaSquares, boundingBox in leadData (when non-null)
7. If firebaseDocId: syncLeadToDatabase({ solarDataStatus, ipAddress, roofPitchDegrees, roofAreaSquares, boundingBox }) — background write
7. dispatch SET_IS_CALCULATING = false
```

By the time the user reaches Results (Step 11), the estimate is almost always already computed and `isCalculating` is `false`. The skeleton loading state on Results only shows for users who complete the funnel extremely fast.

---

## `fetchProfile` — CRM Configuration Loader

Called once on `QuoteFunnel` mount. Reads `companies/C_0001` from Firestore and applies every field to the reducer state.

```
fetchCompanyProfile() → companies/C_0001
├── enableGhostWrites      → setGhostWritesEnabled(bool) + dispatch SET_ENABLE_GHOST_WRITES
├── captureAdvancedSolarData → dispatch SET_CAPTURE_ADVANCED_SOLAR_DATA
├── allowedStates          → dispatch SET_ALLOWED_STATES
├── showPhoneButton        → dispatch SET_SHOW_PHONE_BUTTON
├── phoneF                 → dispatch SET_PHONE_F
├── calendlyUrl            → dispatch SET_CALENDLY_URL
├── showPromoBanner        → dispatch SET_SHOW_PROMO_BANNER
└── promoBannerText        → dispatch SET_PROMO_BANNER_TEXT
```

If `companies/C_0001` does not exist or fetch fails, a `FALLBACK_LOGO` object is used with safe defaults.

---

## Initial State Defaults

Before `fetchProfile` resolves, the store boots with:

| Field | Default | Why |
|---|---|---|
| `enableGhostWrites` | `true` | Safe default — capture data even if profile fetch is slow |
| `allowedStates` | `['NC']` | Limits to North Carolina until CRM config loads |
| `showPhoneButton` | `false` | Phone CTA hidden until confirmed in CRM |
| `calendlyUrl` | `''` (empty) | Calendly widget hidden until URL is provided |
| `currentStep` | `0` | Always starts at Address |
| `solarDataStatus` | `'pending'` | Indicates estimate not yet started |

---

## Solar API Granular Data Extraction

When `fetchEstimate` resolves with a successful Solar API response, three additional fields are extracted from the JSON payload and stored in `leadData`:

| Field | Source path in Solar API JSON | Conversion |
|---|---|---|
| `roofAreaSquares` | `solarPotential.wholeRoofStats.areaMeters2` | × 10.7639 (→ sq ft) ÷ 100 (→ roofing squares) |
| `roofPitchDegrees` | `solarPotential.roofSegmentStats[0].pitchDegrees` | None — stored as-is in degrees |
| `boundingBox` | `solarPotential.roofSegmentStats[0].boundingBox` | sw/ne lat-lng extracted as `{ latitude, longitude }` objects |

These fields are set to `null` when the Solar API returns any `"Failed:"` status. They are included in:
- The `leadData` state blob (via `SET_SOLAR_DETAILS` action), so they appear in the final `syncToFirebase` submission.
- The ghost-write `syncLeadToDatabase` call immediately after `fetchEstimate` resolves, so the CRM sees them before the user reaches the contact form.
- The server-side `saveEstimateToDoc` Admin SDK write in `route.ts`, which fires in parallel with the above.

**Roofing squares conversion formula:**
```
areaMeters2 × 10.7639 = sq ft
sq ft ÷ 100 = roofing squares
```

---

## Drop-off Tracker

A `useEffect` inside `useFunnelStore` fires on every `currentStep` or `firebaseDocId` change and writes `lastStepCompleted` to the `funnel_damon` document. This lets the CRM see exactly where each session abandoned the funnel without any component-level changes.

### How it works

```
1. useEffect dep array: [state.currentStep, state.firebaseDocId]
2. Guard: skip if firebaseDocId is null (doc not created yet)
3. Guard: skip if lastTrackedStep.current === currentStep (already wrote this step)
4. Update lastTrackedStep.current = currentStep
5. Resolve step name from STEP_LABELS[currentStep]
6. syncLeadToDatabase({ lastStepCompleted: stepName }, docId) — fire-and-forget
```

The `lastTrackedStep` ref prevents a double-write when the docId arrives after the step has already advanced (e.g. the user is on step 1 before the `addDoc` round-trip completes — the effect re-fires when docId is set but the ref guard ensures step 1 is only written once).

### STEP_LABELS mapping

| Index | Label written to Firestore |
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

This tracking covers **all three navigation paths** — `goForward`, `goBackward`, and `goToStep` — because all three dispatch reducer actions that update `currentStep`, which triggers the effect.
