# app/ — Application Layer Documentation

The `app/` directory follows the Next.js 14 App Router convention.
It contains the root layout, the single entry-point page, and all server-side API routes.

---

## Directory Structure

```
app/
├── layout.tsx              # Root HTML shell — loads scripts, injects tracking tags
├── page.tsx                # Single-page entry point — renders <QuoteFunnel />
└── api/
    └── get-estimate/
        └── route.ts        # POST — pricing engine + Google Solar API integration
```

---

## layout.tsx

**Purpose:** HTML root shell shared across all pages (only one page exists). Loads all third-party scripts and injects conversion tracking pixels.

### What It Does

1. Sets `<html lang="en">` and `<body>` with `antialiased` class.
2. Loads the **Google Maps JavaScript API** via `<Script>` with `strategy="afterInteractive"`:
   - URL: `https://maps.googleapis.com/maps/api/js?key={NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&v=beta`
   - The `v=beta` channel is **required** for the new `AutocompleteSuggestion` API used in Step01_Address.
   - `strategy="afterInteractive"` means the script loads after hydration — `Step01_Address` polls `window.google.maps.places.AutocompleteSuggestion` every 100ms until it appears.
3. Injects **Google Ads** conversion tracking script raw in `<head>`:
   - Tag: `gtag('config', 'AW-18121619085')`
4. Injects **Meta Pixel** (Facebook) script raw in `<head>`:
   - Pixel ID: `278410202537659`
   - Calls `fbq('init', ...)` and `fbq('track', 'PageView')` on load

Both conversion tags are in `<head>` (not `<body>`) so ad platform scanners can detect them reliably.

### Why Scripts Are Injected Raw

The Google Ads and Meta Pixel scripts use a `<noscript>` fallback and an immediately-invoked initialization pattern that is incompatible with Next.js's `<Script>` component strategy options. They are injected as raw `<script>` tags via `dangerouslySetInnerHTML` equivalents to guarantee they fire at the correct time for attribution.

### Metadata

```typescript
export const metadata = {
  title:       "Free Roofing Quote - Instant Estimate",
  description: "Get an accurate roofing replacement estimate in 60 seconds..."
};
```

---

## page.tsx

**Purpose:** Minimal entry point. Renders only `<QuoteFunnel />`.

```typescript
import QuoteFunnel from '@/components/QuoteFunnel';
export default function Home() {
  return <QuoteFunnel />;
}
```

No layout logic here — `QuoteFunnel` owns all visual structure.

---

## api/get-estimate/route.ts

**Purpose:** Server-side pricing engine. Called once per confirmed lead session — triggered after the user successfully submits contact info on Step 9 (Lead Capture). It no longer fires at Step 0; the call is deferred to eliminate API costs for funnel drop-offs.

### Request

```typescript
POST /api/get-estimate
Content-Type: application/json

{
  address: string,            // Full address string
  lat: number,                // Latitude (0 if manual entry)
  lng: number,                // Longitude (0 if manual entry)
  firebaseDocId?: string,     // Existing funnel_damon doc ID (for server-side ghost writes)
  captureAdvancedSolarData?: boolean  // CRM toggle for extended Solar API data
}
```

### Response

```typescript
{
  groundFloorSqFt: number,       // Raw area in sq ft (before roof factor)
  estimatedRoofSqFt: number,     // Roof area (groundFloorSqFt × 1.15 slope factor)
  squares: number,               // Roof area in roofing "squares" (÷ 100)
  pricingMatrix: {               // Price ranges per material per tier
    asphalt: { good: {min, max}, better: {min, max}, best: {min, max} },
    flat:    { good: {min, max}, better: {min, max}, best: {min, max} },
    metal:   { good: {min, max}, better: {min, max}, best: {min, max} },
  },
  solarDataStatus: string,       // Human-readable outcome string
  ipAddress?: string,            // Requester IP (extracted server-side)
  roofAreaSquares?: number,      // areaMeters2 × 10.7639 ÷ 100 (null on failure)
  roofPitchDegrees?: number,     // roofSegmentStats[0].pitchDegrees (null on failure)
  boundingBox?: {                // roofSegmentStats[0].boundingBox (null on failure)
    sw: { latitude: number, longitude: number },
    ne: { latitude: number, longitude: number }
  }
}
```

### Processing Flow

```
1. Extract IP from request headers (x-forwarded-for → x-real-ip → fallback)
2. Rate limit check: 3 requests per IP per 24 hours (in-memory LRU cache)
   → If exceeded: return 429, dispatch SET_SOLAR_STATUS 'Failed: Rate Limited'
3. Check Firestore address cache: query funnel_damon for normalizedAddress match
   → If cache hit: return cached pricingMatrix, solarDataStatus = 'Cached'
4. Call Google Solar API: /v1/buildingInsights:findClosest?lat=&lng=
   → Extracts areaMeters2 from solarPotential.wholeRoofStats.areaMeters2
   → Converts to sq ft (× 10.7639); divides by 100 for roofing squares (roofAreaSquares)
   → Extracts pitchDegrees from solarPotential.roofSegmentStats[0] (roofPitchDegrees)
   → Extracts boundingBox.sw / .ne lat-lng from solarPotential.roofSegmentStats[0] (boundingBox)
   → If captureAdvancedSolarData: also calls /v1/dataLayers:get for satellite image URL
5. Calculate base price-per-square × squares for each material/tier
6. Write result to existing funnel_damon doc via Firebase Admin SDK
7. Return JSON response
```

### Solar API Fallback Chain

| Condition | Roof area used | `solarDataStatus` |
|---|---|---|
| Solar API returns valid data | Real area from API | `"Success: High-Fidelity Data"` |
| Firestore cache hit | Cached area | `"Cached"` |
| Solar API returns 404 | 1,044 sq ft (97 m²) | `"Failed: 404 No Coverage in Area"` |
| Solar API returns 403 | 1,044 sq ft | `"Failed: 403 API Key/Billing Issue"` |
| Solar API returns 400 | 1,044 sq ft | `"Failed: 400 Bad Request/Coordinates"` |
| Network / unknown error | 1,044 sq ft | `"Failed: Network/Unknown Error"` |
| Rate limited | No pricing | `"Failed: Rate Limited"` |
| `lat === 0` (manual entry) | 1,044 sq ft | `"Failed: 400 Bad Request/Coordinates"` |

When status starts with `"Failed:"`, the Results page (Step10) shows the `GateOverlay` prompting the user for manual interior square footage before revealing prices.

### Base Price-Per-Square Rate Table (hardcoded server-side)

| Material | Good | Better | Best |
|---|---|---|---|
| Asphalt | $390–580 / sq | $440–620 / sq | $510–800 / sq |
| Flat | $500–600 / sq | $650–750 / sq | $800–900 / sq |
| Metal | $525–615 / sq | $640–705 / sq | $720–795 / sq |

Rates are multiplied by the number of squares (roof sq ft ÷ 100) to produce the final dollar ranges in the `pricingMatrix`.

### Rate Limiting

In-memory LRU cache (`lru-cache` package):
- Key: IP address string
- Value: request count within the current 24-hour window
- Max 3 requests per IP per 24 hours
- Cache resets on server restart (not persisted to Firestore or Redis)
- Limit: 3 per IP — returns HTTP 429 if exceeded

### Firestore Writes from This Route

Uses Firebase **Admin SDK** (server-side) — not the client SDK.

**If `firebaseDocId` is provided and Solar API call resolves:**

```
updateDoc(funnel_damon/{firebaseDocId}, {
  estimatedRoofSqFt,
  pricingMatrix,
  normalizedAddress,
  // always written on Solar API success:
  roofPitchDegrees,   // degrees (number) or omitted on failure
  roofAreaSquares,    // areaMeters2 × 10.7639 ÷ 100 (number) or omitted on failure
  boundingBox,        // { sw: {latitude,longitude}, ne: {latitude,longitude} } or omitted on failure
  // if captureAdvancedSolarData:
  advancedSolarMetrics: { segments, imageryDate, rgbUrl }
})
```

These three fields (`roofPitchDegrees`, `roofAreaSquares`, `boundingBox`) are also returned in the API JSON response so the client can store them in `leadData` state and include them in the final `syncToFirebase` submission.

**Roofing squares conversion:**
```
roofAreaSquares = Math.round(areaMeters2 × 10.7639) ÷ 100
```

This write happens regardless of whether the Solar API succeeded or failed, so the CRM always has data quality information before the user reaches Results.
