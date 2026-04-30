# services/ — Firebase Integration Layer Documentation

The `services/` directory contains all Firestore read/write logic for the public-facing funnel.
The funnel ONLY writes to the `funnel_damon` collection and ONLY reads from the `companies` collection.

---

## firebaseService.ts

Initializes the Firebase **client SDK** as a singleton (safe for Next.js hot-reload). Exports five functions.

---

## Collections

### `funnel_damon` — Lead Documents

One document per user session. Document is grown progressively via ghost writes before being "sealed" with the full `leadData` blob on Step 9 submission.

**Document lifecycle:**

```
addDoc (Step01, first ghost write)
  ↓ companyId, isRead: false, typeCastF, createdAt, source
updateDoc (Step01, address commit)
  ↓ addressF
updateDoc (on every step transition — drop-off tracker)
  ↓ lastStepCompleted
updateDoc (server-side, after /api/get-estimate)
  ↓ solarDataStatus, ipAddress
updateDoc (StepFlat_Details, on Continue)
  ↓ flatMaterial, needsRedecking
updateDoc (StepMetal_Details, on card tap)
  ↓ metalType
updateDoc (Step09_LeadCapture, on form submit — FINAL)
  ↓ leadData (full blob), status: 'new', submittedAt, updatedAt
updateDoc (Step10_Results, if GateOverlay submitted)
  ↓ manualHomeSqFt
updateDoc (Step10_Results, if pricingMatrix is missing)
  ↓ systemError, errorTimestamp
```

**Field registry:**

| Field | Type | Set by | When |
|---|---|---|---|
| `companyId` | string | `addDoc` only | First ghost write |
| `isRead` | boolean | `addDoc` only | First ghost write (false) |
| `source` | string | Every write | Always `'roofing-quote-funnel-web'` |
| `createdAt` | Timestamp | `addDoc` only | First ghost write |
| `updatedAt` | Timestamp | Every write | Always server-side timestamp |
| `typeCastF` | string (max 50) | Step01 debounce | User typing in address field |
| `addressF` | string | Step01 commit | Autocomplete selection |
| `solarDataStatus` | string | Server Admin SDK | After `/api/get-estimate` resolves |
| `ipAddress` | string | Server Admin SDK | After `/api/get-estimate` resolves |
| `flatMaterial` | string or null | StepFlat_Details | On "Continue" button |
| `needsRedecking` | boolean or null | StepFlat_Details | On "Continue" button |
| `metalType` | string or null | StepMetal_Details | On card tap |
| `leadData` | object | Step09 final submit | On "See My Price" submit |
| `status` | `'new'` | Step09 final submit | On "See My Price" submit |
| `submittedAt` | Timestamp | Step09 final submit | On "See My Price" submit |
| `manualHomeSqFt` | number | Step10 GateOverlay | On "Calculate My Estimate" |
| `lastStepCompleted` | string | `useFunnelStore` drop-off tracker | On every step transition |
| `roofPitchDegrees` | number or null | `useFunnelStore.fetchEstimate` | After Solar API resolves (null on failure) |
| `roofAreaSquares` | number or null | `useFunnelStore.fetchEstimate` | After Solar API resolves (null on failure) |
| `boundingBox` | object or null | `useFunnelStore.fetchEstimate` | After Solar API resolves (null on failure) |
| `systemError` | string | Step10 error logger | If pricingMatrix is missing |
| `errorTimestamp` | Timestamp | Step10 error logger | If pricingMatrix is missing |

> **Note:** The `isRead` flag (false on creation) drives the "Unread" badge in the CRM dashboard. Ghost writes use `updateDoc` with `{ merge: true }` behavior — they NEVER overwrite `isRead`, preserving the CRM's read-tracking.

### `companies` — Tenant Configuration

Read-only from the funnel's perspective. One document per tenant.

Document ID: `C_0001` (hardcoded — single-tenant setup).

**Fields read:**

| Field | Type | Default | Effect on funnel |
|---|---|---|---|
| `logoUrl` | string | Fallback Firebase Storage URL | Logo in `LogoHeader` |
| `enableGhostWrites` | boolean | `true` | Gates all `syncLeadToDatabase` calls |
| `captureAdvancedSolarData` | boolean | `false` | Adds roof segments + imagery URL to Solar API call |
| `allowedStates` | string[] | `['NC']` | Rejects addresses outside these states |
| `showPhoneButton` | boolean | `false` | Shows/hides phone CTA on Results |
| `phoneF` | string | `''` | Phone number shown on Results CTA |
| `calendlyUrl` | string | `''` | Shows/hides Calendly widget on Results |
| `showPromoBanner` | boolean | `false` | Shows/hides promo banner on Results |
| `promoBannerText` | string | `''` | Banner copy text |

---

## Exported Functions

### `fetchCompanyProfile()`

```typescript
async function fetchCompanyProfile(): Promise<ServiceResult<CompanyProfile>>
```

Reads `companies/C_0001`. Falls back to `FALLBACK_LOGO` if document is missing or fetch fails.
Called by `QuoteFunnel` on mount (twice — once for CRM flags, once for `logoUrl`).

**Firestore operation:** `getDoc` (read-only)

---

### `setGhostWritesEnabled(enabled: boolean)`

```typescript
function setGhostWritesEnabled(enabled: boolean): void
```

Sets the module-level `_ghostWritesEnabled` flag. Called by `useFunnelStore.fetchProfile()` after the company profile loads.

When `false`: `syncLeadToDatabase` returns `{ success: true }` immediately without touching Firestore.

When `true` (default): all ghost writes proceed normally.

**No Firestore operation.**

---

### `syncLeadToDatabase(data, docId?)`

```typescript
async function syncLeadToDatabase(
  data: GhostLeadData,
  docId?: string | null
): Promise<SyncLeadResult>
```

**The ghost-write workhorse.** Accepts a partial `GhostLeadData` payload and writes only the fields explicitly provided.

| `docId` | Operation | Result |
|---|---|---|
| `null` / `undefined` | `addDoc` → creates new document | Returns new `docId` |
| Provided | `updateDoc` → merges into existing document | Returns same `docId` |

Always checked against `_ghostWritesEnabled` first. Returns `{ success: true }` mock if disabled.

**Used by:** Step01_Address (2×), StepFlat_Details (1×), StepMetal_Details (1×), useFunnelStore.fetchEstimate (1×), useFunnelStore.saveManualSqFtToDb (1×)

---

### `syncToFirebase(leadData, docId?)`

```typescript
async function syncToFirebase(
  leadData: LeadData,
  docId?: string | null
): Promise<ServiceResult<LeadDocument>>
```

**The final submission write.** Writes the complete `LeadData` object plus `status: 'new'` and `submittedAt`.

**NOT gated by `_ghostWritesEnabled`** — this write always proceeds regardless of the CRM toggle.

| `docId` | Operation |
|---|---|
| Provided | `updateDoc` — stamps the ghost document with the full lead payload |
| `null` | `addDoc` — creates a new document (ghost capture was skipped or failed) |

**Used by:** Step09_LeadCapture.handleSubmit (1×)

**This is the only write that:**
- Sets `status: 'new'`
- Sets `submittedAt`
- Writes the full `leadData` blob

---

### `updateLeadStatus(leadId, status)`

```typescript
async function updateLeadStatus(
  leadId: string,
  status: 'new' | 'contacted' | 'converted' | 'lost'
): Promise<ServiceResult>
```

Updates only the `status` field on a `funnel_damon` document. Intended for CRM dashboard use — not called anywhere in the public funnel today.

---

### `logLeadError(leadId, errorMsg)`

```typescript
async function logLeadError(leadId: string, errorMsg: string): Promise<void>
```

Stamps `{ systemError, errorTimestamp }` onto an existing `funnel_damon` document.
Called by `useFunnelStore.logError()` which is triggered from `Step10_Results` when `pricingMatrix` is missing.

Failures are swallowed — this is a diagnostic write and must never surface to the user.

---

## Ghost Write Flag — Important Notes

- `_ghostWritesEnabled` is a **module-level variable**, not React state. It survives re-renders.
- It is set once, synchronously, when `fetchProfile` resolves.
- All `syncLeadToDatabase` calls that happen BEFORE `fetchProfile` resolves use the default value (`true`) — this is intentional so the first ghost write (user typing address) is captured even on slow connections.
- Disabling ghost writes in the CRM will stop ALL partial data capture. The final Step09 write (`syncToFirebase`) is unaffected and will still create a document.

---

## Firestore Security

The client SDK uses **anonymous public write access** to `funnel_damon`. Firestore security rules (not in this repo) must enforce:
- Allow write to `funnel_damon` from any unauthenticated client
- Restrict reads on `funnel_damon` to authenticated CRM users only
- Allow reads on `companies` (for logo and config) from any client
- Block all writes to `companies` from the public funnel

The `firebaseAdmin.ts` (server-only, in `lib/`) uses the Admin SDK with service account credentials to bypass security rules — this is how `/api/get-estimate` can write `solarDataStatus` and `ipAddress` to the same documents.

---

## Solar API Granular Data — `funnel_damon` Fields

Three new fields are written to `funnel_damon` after every successful Solar API response. They are written via **two parallel paths**:

1. **Server-side (Admin SDK)** — `saveEstimateToDoc` in `app/api/get-estimate/route.ts` writes them in the same `update()` call as `estimatedRoofSqFt` and `pricingMatrix`.
2. **Client-side (client SDK)** — `useFunnelStore.fetchEstimate` calls `syncLeadToDatabase` with the fields immediately after the API response resolves.

| Field | Type | Source in Google Solar API JSON | Conversion |
|---|---|---|---|
| `roofPitchDegrees` | `number \| null` | `solarPotential.roofSegmentStats[0].pitchDegrees` | None — stored in degrees |
| `roofAreaSquares` | `number \| null` | `solarPotential.wholeRoofStats.areaMeters2` | `areaMeters2 × 10.7639 ÷ 100` |
| `boundingBox` | `{ sw: {latitude, longitude}, ne: {latitude, longitude} } \| null` | `solarPotential.roofSegmentStats[0].boundingBox` | sw/ne extracted as lat-lng objects |

All three fields are `null` when the Solar API returns any `"Failed:"` status (404, 403, 400, or network error). The `GhostLeadData` interface accepts `undefined` (field omitted from write) as well as `null` (explicit null stored in Firestore).

These fields are also included in the `leadData` blob written by `syncToFirebase` on final submission (Step09), since `SET_SOLAR_DETAILS` places them directly into `leadData` state.
