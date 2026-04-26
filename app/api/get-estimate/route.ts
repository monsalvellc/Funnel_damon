import { NextRequest, NextResponse } from 'next/server';
import { LRUCache } from 'lru-cache';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IN-MEMORY RATE LIMITER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Module-level singleton — survives across warm serverless invocations.
// Tracks request counts per IP. Each entry expires after 24 hours (ttl).
const rateLimitCache = new LRUCache<string, number>({
  max: 500,
  ttl: 1000 * 60 * 60 * 24,
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRICE-PER-SQUARE RATE TABLE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PRICE_PER_SQUARE: Record<string, Record<string, [number, number]>> = {
  asphalt: {
    good:   [390, 580],    // 3-tab, basic underlayment
    better: [440, 620],    // architectural shingles, synthetic underlayment
    best:   [510, 800],    // designer shingles, full weather system
  },
  flat: {
    good:   [500,  600],   // Modified Bitumen baseline
    better: [650,  750],   // TPO / minor redecking
    best:   [800,  900],   // EPDM + full redecking
  },
  metal: {
    good:   [525,  615],   // Corrugated/Tin, exposed fastener
    better: [640,  705],   // Standing Seam mid
    best:   [720,  795],   // Premium standing seam
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type PricingMatrix = Record<string, Record<string, { min: number; max: number }>>;

export interface AdvancedSolarMetrics {
  imageryDate:      unknown;        // { year, month, day } object from the API
  imageryQuality:   string;
  roofSegmentStats: unknown[];      // array with pitchDegrees, azimuthDegrees, planeHeightMeters per segment
  solarPanelsCount: number;
  rgbUrl:           string | null;  // aerial satellite photo URL from dataLayers endpoint
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIRESTORE HELPERS — rate limiting, address caching, doc updates
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * checkRateLimit — Returns true if this IP has exceeded 3 requests in the
 * last 24 hours. Entirely in-memory via LRUCache; zero Firestore reads.
 * Increments the counter on every allowed request.
 */
function checkRateLimit(ipAddress: string): boolean {
  const count = rateLimitCache.get(ipAddress) ?? 0;
  if (count >= 3) return true;
  rateLimitCache.set(ipAddress, count + 1);
  return false;
}

/**
 * checkAddressCache — Returns cached estimate data if any prior funnel_damon
 * document already has a valid result for this normalised address.
 * Fails open — a Firestore outage falls through to the Solar API.
 */
async function checkAddressCache(normalizedAddress: string): Promise<{
  estimatedRoofSqFt: number;
  pricingMatrix: PricingMatrix;
  solarDataStatus: string;
} | null> {
  try {
    const snap = await adminDb
      .collection('funnel_damon')
      .where('normalizedAddress', '==', normalizedAddress)
      .limit(1)
      .get();
    if (snap.empty) return null;

    const data = snap.docs[0].data();
    if (!data.estimatedRoofSqFt || !data.pricingMatrix) return null;

    return {
      estimatedRoofSqFt: data.estimatedRoofSqFt as number,
      pricingMatrix:     data.pricingMatrix as PricingMatrix,
      solarDataStatus:   (data.solarDataStatus as string) || 'Success: High-Fidelity Data',
    };
  } catch (err) {
    console.warn('[Cache] Firestore query failed — falling through to Solar API:', err);
    return null;
  }
}

/**
 * saveEstimateToDoc — Merges pricing data (and optionally advanced solar metrics)
 * into the caller's funnel_damon document. Fire-and-forget; errors are warned, not thrown.
 */
async function saveEstimateToDoc(
  firebaseDocId: string,
  data: {
    estimatedRoofSqFt: number;
    pricingMatrix: PricingMatrix;
    normalizedAddress: string;
    advancedSolarMetrics?: AdvancedSolarMetrics;
  }
): Promise<void> {
  try {
    await adminDb.collection('funnel_damon').doc(firebaseDocId).update({
      estimatedRoofSqFt:  data.estimatedRoofSqFt,
      pricingMatrix:      data.pricingMatrix,
      normalizedAddress:  data.normalizedAddress,
      ...(data.advancedSolarMetrics ? { advancedSolarMetrics: data.advancedSolarMetrics } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[saveEstimateToDoc] Merged estimate into funnel_damon/${firebaseDocId}`);
  } catch (err) {
    console.warn('[saveEstimateToDoc] Firestore write failed:', err);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATA SERVICE ADAPTER — Google Solar API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PropertyData {
  estimatedRoofSqFt: number;
  solarDataStatus: string;
  advancedSolarMetrics?: AdvancedSolarMetrics;
}

/**
 * fetchDataLayersRgbUrl — Calls the Solar dataLayers endpoint to get the aerial
 * satellite photo URL. Returns null if the request fails or the field is absent.
 */
async function fetchDataLayersRgbUrl(lat: number, lng: number, apiKey: string): Promise<string | null> {
  try {
    const url =
      `https://solar.googleapis.com/v1/dataLayers:get` +
      `?location.latitude=${lat}` +
      `&location.longitude=${lng}` +
      `&radiusMeters=50` +
      `&view=IMAGERY_LAYERS` +
      `&key=${apiKey}`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.warn(`[dataLayers] Unexpected status ${res.status} — skipping rgbUrl`);
      return null;
    }
    const json = await res.json();
    return (json?.rgbUrl as string) ?? null;
  } catch (err) {
    console.warn('[dataLayers] Fetch failed — skipping rgbUrl:', err);
    return null;
  }
}

async function fetchGoogleSolarData(
  lat: number,
  lng: number,
  captureAdvanced: boolean
): Promise<PropertyData> {
  const FALLBACK_SQ_FT = Math.round(97 * 10.7639);

  const apiKey = process.env.GOOGLE_SOLAR_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn('[SolarAPI] No API key found — using baseline');
    return {
      estimatedRoofSqFt: FALLBACK_SQ_FT,
      solarDataStatus: 'Failed: 403 API Key/Billing Issue',
    };
  }

  const url =
    `https://solar.googleapis.com/v1/buildingInsights:findClosest` +
    `?location.latitude=${lat}` +
    `&location.longitude=${lng}` +
    `&requiredQuality=HIGH` +
    `&key=${apiKey}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });

    if (res.status === 404) {
      console.warn(`[SolarAPI] 404 — building not mapped at (${lat}, ${lng}). Using baseline.`);
      return { estimatedRoofSqFt: FALLBACK_SQ_FT, solarDataStatus: 'Failed: 404 No Coverage in Area' };
    }
    if (res.status === 403) {
      console.warn(`[SolarAPI] 403 — API key invalid or billing not enabled. Using baseline.`);
      return { estimatedRoofSqFt: FALLBACK_SQ_FT, solarDataStatus: 'Failed: 403 API Key/Billing Issue' };
    }
    if (res.status === 400) {
      console.warn(`[SolarAPI] 400 — bad coordinates (lat=${lat}, lng=${lng}). Using baseline.`);
      return { estimatedRoofSqFt: FALLBACK_SQ_FT, solarDataStatus: 'Failed: 400 Bad Request/Coordinates' };
    }
    if (!res.ok) {
      console.warn(`[SolarAPI] Unexpected status ${res.status} for (${lat}, ${lng}). Using baseline.`);
      return { estimatedRoofSqFt: FALLBACK_SQ_FT, solarDataStatus: 'Failed: Network/Unknown Error' };
    }

    const json = await res.json();
    const areaMeters2: number | undefined = json?.solarPotential?.wholeRoofStats?.areaMeters2;

    if (!areaMeters2 || areaMeters2 <= 0) {
      console.warn(`[SolarAPI] areaMeters2 missing or zero for (${lat}, ${lng}). Using baseline.`);
      return { estimatedRoofSqFt: FALLBACK_SQ_FT, solarDataStatus: 'Failed: 404 No Coverage in Area' };
    }

    const estimatedRoofSqFt = Math.round(areaMeters2 * 10.7639);
    console.log(
      `[SolarAPI] Success (${lat}, ${lng}) → ${areaMeters2.toFixed(1)} m² → ${estimatedRoofSqFt} sq ft`
    );

    if (!captureAdvanced) {
      return { estimatedRoofSqFt, solarDataStatus: 'Success: High-Fidelity Data' };
    }

    // ── Advanced extraction ────────────────────────────────────────────────
    const [rgbUrl] = await Promise.all([
      fetchDataLayersRgbUrl(lat, lng, apiKey),
    ]);

    const advancedSolarMetrics: AdvancedSolarMetrics = {
      imageryDate:      json?.imageryDate ?? null,
      imageryQuality:   (json?.imageryQuality as string) ?? 'UNKNOWN',
      roofSegmentStats: (json?.solarPotential?.roofSegmentStats as unknown[]) ?? [],
      solarPanelsCount: (json?.solarPotential?.maxArrayPanelsCount as number) ?? 0,
      rgbUrl,
    };

    console.log(
      `[SolarAPI] Advanced metrics captured — ${advancedSolarMetrics.roofSegmentStats.length} segments, rgbUrl=${rgbUrl ? 'yes' : 'no'}`
    );

    return {
      estimatedRoofSqFt,
      solarDataStatus: 'Success: High-Fidelity Data',
      advancedSolarMetrics,
    };
  } catch (err) {
    console.warn(`[SolarAPI] Network/fetch error for (${lat}, ${lng}):`, err);
    return { estimatedRoofSqFt: FALLBACK_SQ_FT, solarDataStatus: 'Failed: Network/Unknown Error' };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MATH ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildPricingMatrix(estimatedRoofSqFt: number) {
  const squares = estimatedRoofSqFt / 100;
  const pricingMatrix: PricingMatrix = {};

  for (const [material, tiers] of Object.entries(PRICE_PER_SQUARE)) {
    pricingMatrix[material] = {};
    for (const [tierName, [rateMin, rateMax]] of Object.entries(tiers)) {
      pricingMatrix[material][tierName] = {
        min: Math.round((rateMin * squares) / 100) * 100,
        max: Math.round((rateMax * squares) / 100) * 100,
      };
    }
  }

  return { estimatedRoofSqFt, squares, pricingMatrix };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTE HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, lat, lng, firebaseDocId, captureAdvancedSolarData } = body as {
      address?: string;
      lat?: number;
      lng?: number;
      firebaseDocId?: string | null;
      captureAdvancedSolarData?: boolean;
    };

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return NextResponse.json(
        { error: 'address is required and must be a non-empty string' },
        { status: 400 }
      );
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'lat and lng are required numeric coordinates' },
        { status: 400 }
      );
    }

    // ── IP extraction ────────────────────────────────────────────────────────
    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // ── Rate limit ───────────────────────────────────────────────────────────
    const limited = checkRateLimit(ipAddress);
    if (limited) {
      console.warn(`[RateLimit] Blocked IP ${ipAddress} — exceeded 3 requests in 24h`);
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // ── Normalise address + cache check ──────────────────────────────────────
    const normalizedAddress = address.trim().toLowerCase();
    const cached = await checkAddressCache(normalizedAddress);

    if (cached) {
      console.log(`[Cache] Hit for "${normalizedAddress}"`);
      const { estimatedRoofSqFt, pricingMatrix, solarDataStatus } = cached;
      const squares = estimatedRoofSqFt / 100;

      return NextResponse.json({
        estimatedRoofSqFt,
        squares: parseFloat(squares.toFixed(2)),
        pricingMatrix,
        solarDataStatus,
        fromCache: true,
        ipAddress,
      });
    }

    // ── Cache miss — call Solar API ──────────────────────────────────────────
   const captureAdvanced = captureAdvancedSolarData === true;
    const { estimatedRoofSqFt, solarDataStatus, advancedSolarMetrics } =
      await fetchGoogleSolarData(lat, lng, captureAdvanced);
    const { squares, pricingMatrix } = buildPricingMatrix(estimatedRoofSqFt);

    // ── Persist to Firestore doc (if we have a docId) ────────────────────────
    if (firebaseDocId) {
      saveEstimateToDoc(firebaseDocId, {
        estimatedRoofSqFt,
        pricingMatrix,
        normalizedAddress,
        ...(advancedSolarMetrics ? { advancedSolarMetrics } : {}),
      }).catch((err) =>
        console.warn('[POST] saveEstimateToDoc rejected unexpectedly:', err)
      );
    }

    return NextResponse.json({
      estimatedRoofSqFt,
      squares: parseFloat(squares.toFixed(2)),
      pricingMatrix,
      solarDataStatus,
      ipAddress,
      ...(advancedSolarMetrics ? { advancedSolarMetrics } : {}),
    });
  } catch (err) {
    console.error('[/api/get-estimate] Unhandled error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
