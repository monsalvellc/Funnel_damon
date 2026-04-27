'use client';

import { useEffect, useMemo, useState } from 'react';
import { InlineWidget } from 'react-calendly';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, Phone, Star, Shield, Tag, Zap,
  Home, Info, Loader2, AlertTriangle, Lock, Unlock, Clock,
} from 'lucide-react';
import { calculateEstimate, buildModifier, formatCurrency } from '@/lib/calculateEstimate';
import type { PricingTier } from '@/lib/calculateEstimate';
import type { FunnelStore } from '@/hooks/useFunnelStore';

interface Props {
  store: FunnelStore;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * The server's fallback roof area when the Solar API has no coverage data.
 * All "Failed:" pricingMatrix values are computed from this baseline,
 * so we can scale them proportionally when the user supplies a manual sq ft.
 *
 * Value: 97 m² × 10.7639 ft²/m² ≈ 1,044 sq ft  (conservative single-story home)
 */
const SERVER_FALLBACK_ROOF_SQ_FT = 1044;

/**
 * MATERIAL_IMAGES — maps roofCategory + tier key to a local image path.
 *
 * Images live in /public/images/materials/ so Next.js serves them statically.
 * An empty string means no image exists yet for that slot; the card gracefully
 * renders without the image block, leaving the checklist full-width.
 *
 * Tier keys must be lowercase to match PricingTier.tier.toLowerCase():
 *   'Good' → 'good', 'Better' → 'better', 'Best' → 'best'
 *
 * To add a new image: drop the file in /public/images/materials/ and fill in
 * the path string below. No other code changes are needed.
 */
/** Maps 'not_sure' → 'asphalt' so pricing matrix and image lookups always resolve. */
function resolveCategory(roofCategory: string | null | undefined): string {
  if (!roofCategory || roofCategory === 'not_sure') return 'asphalt';
  return roofCategory;
}

 const MATERIAL_IMAGES: Record<string, Record<string, string>> = {
  asphalt: {
    good: '/images/materials/asphalt-good.jpg',
    better: '/images/materials/asphalt-better.jpg',
    best: '/images/materials/asphalt-best.jpg',
  },
  metal: {
    good: '/images/materials/metal-good.jpg',
    better: '/images/materials/metal-better.jpg',
    best: '/images/materials/metal-best.jpg',
  },
  flat: {
    good: '/images/materials/flat-good.jpg',
    better: '/images/materials/flat-better.jpg',
    best: '/images/materials/flat-best.jpg',
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOADING SKELETON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function PricingSkeletonCard() {
  return (
    <div className="rounded-3xl border border-white/10 overflow-hidden animate-pulse backdrop-blur-md">
      <div className="bg-white/20 px-5 py-5">
        <div className="h-3 w-16 bg-white/25 rounded mb-3" />
        <div className="h-7 w-48 bg-white/25 rounded mb-2" />
        <div className="h-3 w-32 bg-white/15 rounded" />
      </div>
      <div className="bg-white/12 px-5 py-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="w-3.5 h-3.5 rounded-full bg-white/15 flex-shrink-0" />
            <div className="h-3 bg-white/10 rounded" style={{ width: `${60 + i * 10}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRICE DERIVATION (API PATH)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * deriveApiTiers — Applies the property modifier multiplier to the API's
 * base pricing matrix and merges with static tier content from calculateEstimate.
 *
 * This is used when the Solar API returned real sq footage (solarDataStatus
 * starts with "Success"). The quoteData.pricingMatrix already encodes the
 * correct per-square rates for the actual roof area.
 */
function deriveApiTiers(
  quoteData: NonNullable<FunnelStore['state']['quoteData']>,
  leadData: Parameters<typeof buildModifier>[0]
): [PricingTier, PricingTier, PricingTier] {
  const roofCategory = resolveCategory(leadData.propertyDetails?.roofCategory);
  const { multiplier } = buildModifier(leadData);
  const adj = (val: number) => Math.round((val * multiplier) / 100) * 100;

  // Guard: pricingMatrix may be null/undefined if the API response was partial
  const matrix   = quoteData.pricingMatrix?.[roofCategory] ?? {};
  const apiGood   = matrix['good']   ?? { min: 0, max: 0 };
  const apiBetter = matrix['better'] ?? { min: 0, max: 0 };
  const apiBest   = matrix['best']   ?? { min: 0, max: 0 };

  // Borrow static tier metadata (descriptions, includes, colorClass, recommended)
  // from calculateEstimate without re-running the full price math.
  const { tiers: staticTiers } = calculateEstimate(leadData);

  return [
    { ...staticTiers[0], min: adj(apiGood.min),   max: adj(apiGood.max) },
    { ...staticTiers[1], min: adj(apiBetter.min), max: adj(apiBetter.max) },
    { ...staticTiers[2], min: adj(apiBest.min),   max: adj(apiBest.max) },
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRICE DERIVATION (MANUAL FALLBACK PATH)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * scaleFallbackTiers — Rescales the server's fallback pricingMatrix using the
 * user-supplied interior square footage instead of the hardcoded 1,044 sq ft.
 *
 * Why this approach (scaling) instead of recomputing from scratch:
 *   The server already has the correct per-square rate logic for every
 *   material/tier combination. Rather than duplicating that server-side math
 *   on the client, we simply find how much larger/smaller the real home is
 *   vs. our baseline, then scale every price proportionally.
 *
 * Formula:
 *   1. estimatedRoofSqFt = (manualHomeSqFt / stories) × 1.35
 *      ↳ Divides by stories to approximate the per-floor footprint,
 *        then multiplies by 1.35 for the standard roof-overhang factor.
 *   2. scaleFactor = estimatedRoofSqFt / SERVER_FALLBACK_ROOF_SQ_FT (1,044)
 *   3. Every min/max in pricingMatrix × scaleFactor × buildModifier().multiplier
 *      → rounded to nearest $100 for clean display.
 *
 * @param manualHomeSqFt - Interior sq ft entered by the user
 * @param stories        - Number of above-grade stories (from propertyDetails)
 * @param quoteData      - The server's response (contains fallback pricingMatrix)
 * @param leadData       - Full lead data (needed for modifier + roofCategory)
 * @returns              - Scaled [Good, Better, Best] PricingTier array
 *                         and the computed estimatedRoofSqFt for display
 */
function scaleFallbackTiers(
  manualHomeSqFt: number,
  stories: number,
  quoteData: NonNullable<FunnelStore['state']['quoteData']>,
  leadData: Parameters<typeof buildModifier>[0]
): { tiers: [PricingTier, PricingTier, PricingTier]; roofSqFt: number } {
  const roofCategory = resolveCategory(leadData.propertyDetails?.roofCategory);

  // Step 1: derive roof area from interior sq ft
  const estimatedRoofSqFt = Math.round((manualHomeSqFt / Math.max(stories, 1)) * 1.35);

  // Step 2: proportional scale factor against the server's 1,044 sq ft baseline
  const scaleFactor = estimatedRoofSqFt / SERVER_FALLBACK_ROOF_SQ_FT;

  // Step 3: property modifiers (pitch, stories, urgency, material sub-selection)
  const { multiplier } = buildModifier(leadData);

  // Combined adjustment: scale for size AND adjust for property conditions
  const adj = (val: number) => Math.round((val * scaleFactor * multiplier) / 100) * 100;

  // Guard: pricingMatrix may be null/undefined if the API response was partial
  const matrix    = quoteData.pricingMatrix?.[roofCategory] ?? {};
  const apiGood   = matrix['good']   ?? { min: 0, max: 0 };
  const apiBetter = matrix['better'] ?? { min: 0, max: 0 };
  const apiBest   = matrix['best']   ?? { min: 0, max: 0 };

  // Borrow static tier metadata (descriptions, includes, colorClass, recommended)
  const { tiers: staticTiers } = calculateEstimate(leadData);

  return {
    tiers: [
      { ...staticTiers[0], min: adj(apiGood.min),   max: adj(apiGood.max) },
      { ...staticTiers[1], min: adj(apiBetter.min), max: adj(apiBetter.max) },
      { ...staticTiers[2], min: adj(apiBest.min),   max: adj(apiBest.max) },
    ],
    roofSqFt: estimatedRoofSqFt,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GATE OVERLAY — shown when Solar API failed and user hasn't entered sq ft yet
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface GateOverlayProps {
  onSubmit: (sqFt: number) => void;
}

/**
 * GateOverlay — Semi-transparent card centered over the blurred pricing tiers.
 *
 * Collects the user's interior square footage so we can scale the fallback
 * pricing matrix to their actual home size. The input is validated client-side
 * (must be a positive integer) before being submitted.
 */
// Sq ft options: 700–3500 in steps of 100, then 4000–10000 in steps of 1000.
const SQ_FT_OPTIONS: number[] = [
  ...Array.from({ length: (3500 - 700) / 100 + 1 }, (_, i) => 700 + i * 100),
  ...Array.from({ length: (10000 - 4000) / 1000 + 1 }, (_, i) => 4000 + i * 1000),
];

function GateOverlay({ onSubmit }: GateOverlayProps) {
  const [selected, setSelected] = useState('');
  const [error, setError]       = useState('');

  function handleSubmit() {
    const parsed = parseInt(selected, 10);

    if (!selected || isNaN(parsed)) {
      setError('Please select your approximate square footage');
      return;
    }

    setError('');
    onSubmit(parsed);
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="
        absolute inset-0 z-10
        flex items-center justify-center
        px-4 py-6
      "
    >
      <div className="
        w-full max-w-sm
        bg-slate-900/95 backdrop-blur-md
        border border-orange-500/40
        rounded-3xl p-6 shadow-2xl
      ">
        {/* Icon */}
        <div className="flex items-center justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-orange-500/15 flex items-center justify-center">
            <Lock size={26} className="text-orange-400" />
          </div>
        </div>

        {/* Heading */}
        <h3 className="text-white font-extrabold text-lg text-center mb-2">
          Unlock Your Estimate
        </h3>

        {/* Explanation */}
        <p className="text-white/55 text-sm text-center leading-relaxed mb-5">
          Satellite coverage is unavailable for your area. To unlock your rough estimate,
          please provide the approximate interior square footage of your home.
        </p>

        {/* Dropdown */}
        <div className="mb-3">
          <label className="block text-white/60 text-xs font-semibold uppercase tracking-wide mb-1.5">
            Interior Square Footage
          </label>
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              if (error) setError('');
            }}
            className="
              w-full bg-navy-900/50 border border-white/20 rounded-xl
              px-4 py-3 text-white text-base font-semibold
              focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50
              transition-colors appearance-none cursor-pointer
            "
          >
            <option value="" disabled className="bg-navy-950 text-white/40">
              Select your square footage…
            </option>
            {SQ_FT_OPTIONS.map((sqFt) => (
              <option key={sqFt} value={sqFt} className="bg-navy-950 text-white">
                {sqFt.toLocaleString()} sq ft
              </option>
            ))}
          </select>
          {error && (
            <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
              <AlertTriangle size={11} />
              {error}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          className="
            w-full min-h-[52px] rounded-2xl
            bg-orange-500 hover:bg-orange-600 active:bg-orange-700
            text-white font-bold text-base
            flex items-center justify-center gap-2
            transition-all duration-200 active:scale-[0.98]
            shadow-lg
          "
        >
          <Unlock size={16} />
          Calculate My Estimate
        </button>
      </div>
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRICING UNAVAILABLE FALLBACK CARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function PricingUnavailableCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="
        flex flex-col items-center gap-4 text-center
        bg-white/10 backdrop-blur-md border border-white/15
        rounded-3xl px-6 py-10 mb-6
      "
    >
      <div className="w-16 h-16 rounded-full bg-orange-500/15 flex items-center justify-center">
        <Clock size={30} className="text-orange-400" />
      </div>
      <div>
        <p className="text-white font-extrabold text-lg mb-2">
          Your Custom Roof Estimate is Being Finalized
        </p>
        <p className="text-white/55 text-sm leading-relaxed max-w-sm mx-auto">
          One of our experts is reviewing your property details and will provide
          your exact pricing shortly. You&apos;ll receive a detailed quote via email
          within the next hour.
        </p>
      </div>
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Step10_Results — The Comparison Matrix; reveals the 3-tier estimate.
 *
 * Four possible render states:
 *
 *   A. isCalculating = true
 *      → Skeleton cards while /api/get-estimate is still in-flight.
 *
 *   B. Solar API succeeded  (solarDataStatus starts with "Success")
 *      → Standard path: API sq footage + buildModifier → property-specific prices.
 *
 *   C. Solar API failed  (solarDataStatus starts with "Failed")
 *      C1. manualHomeSqFt not yet entered
 *          → Tier cards are blurred + pointer-events disabled.
 *          → GateOverlay prompts the user for interior sq ft.
 *      C2. manualHomeSqFt entered (> 0)
 *          → Blur lifted; prices rescaled from the server's fallback matrix.
 *          → Warning banner explains this is a rough baseline estimate.
 *
 *   D. pricingMatrix is null/undefined (API returned incomplete data)
 *      → PricingUnavailableCard shown instead of tier cards.
 *      → Promo banner and Calendly widget still render below.
 */
export default function Step10_Results({ store }: Props) {
  const { state, setManualHomeSqFt, saveManualSqFtToDb, logError } = store;
  const { leadData, quoteData, isCalculating } = state;
  const { addressData, propertyDetails, contactInfo } = leadData;

  // ── Error logging — fires once calculation settles ─────────────────────────
  // Runs whenever isCalculating flips to false or quoteData changes.
  // If pricingMatrix is absent or empty at that point, stamp the lead doc so
  // the sales team knows to follow up manually.
  useEffect(() => {
    if (isCalculating) return; // wait until the API call has resolved
    const matrix = quoteData?.pricingMatrix;
    const missing = !matrix || Object.keys(matrix).length === 0;
    if (missing) {
      logError('Missing pricingMatrix data on final render.');
    }
  }, [isCalculating, quoteData, logError]);

  // ── Calendly booking conversion — Google Ads ────────────────────────────────
  // Calendly posts a window message when a booking is confirmed. We listen here
  // (co-located with InlineWidget) and fire the Ads conversion tag on the event.
  useEffect(() => {
    function handleCalendlyMessage(e: MessageEvent) {
      if (e.data?.event === 'calendly.event_scheduled') {
        // Google Ads conversion
        console.log('Google Ads conversion fired');
        // @ts-expect-error — gtag injected globally by <script> in layout.tsx
        window.gtag?.('event', 'conversion', {
          send_to: 'AW-18121619085/2d5_CIWKlqMcEI3th8FD',
          value: 1.0,
          currency: 'USD',
        });

        // Meta Pixel conversion
        console.log('Meta Schedule conversion fired');
        // @ts-expect-error — fbq injected globally by <script> in layout.tsx
        window.fbq?.('track', 'Schedule');
      }
    }

    window.addEventListener('message', handleCalendlyMessage);
    return () => window.removeEventListener('message', handleCalendlyMessage);
  }, []);

  // ── Determine which pricing render path to use ─────────────────────────────

  /**
   * solarFailed — true when the server could not get real roof data.
   * Guard against null/undefined solarDataStatus.
   */
  const solarFailed = (leadData.solarDataStatus ?? '').startsWith('Failed:');

  /**
   * pricingMatrixAvailable — false when quoteData arrived but pricingMatrix
   * is null/undefined (e.g. API returned a partial response).
   * When false, we show PricingUnavailableCard instead of the tier cards.
   */
  const pricingMatrixAvailable = !!quoteData?.pricingMatrix;

  /**
   * manualSqFt — the value the user entered in the gate overlay.
   * Undefined (or 0) means they haven't submitted it yet → gate is active.
   */
  const manualSqFt = leadData.manualHomeSqFt ?? 0;

  /** True once the user has unlocked the fallback estimate. */
  const fallbackUnlocked = solarFailed && manualSqFt > 0;

  /** True when the gate overlay should be visible (failed AND not yet unlocked). */
  const gateActive = solarFailed && manualSqFt === 0;

  // ── Pricing derivation ─────────────────────────────────────────────────────

  /**
   * Convert stories string to a number for the roof area formula.
   * '3+' → 3 (conservative assumption; more stories = smaller per-floor footprint).
   * Guard against null/undefined with fallback to '1'.
   */
  const storiesNum = (propertyDetails?.stories ?? '1') === '3+'
    ? 3
    : parseInt(propertyDetails?.stories ?? '1', 10) || 1;

  const { tiers, sqFootage, completionDays, modifiers, multiplier } = useMemo(() => {
    // ── Path A: still loading ────────────────────────────────────────────────
    if (isCalculating || !quoteData) {
      const fallback = calculateEstimate(leadData);
      return {
        tiers:          fallback.tiers,
        sqFootage:      fallback.squareFootage,
        completionDays: fallback.completionDays,
        modifiers:      fallback.modifiers ?? [],
        multiplier:     fallback.multiplier,
      };
    }

    // ── Path D: quoteData exists but pricingMatrix is missing ────────────────
    // Return safe placeholder values — the tier cards won't render anyway.
    if (!quoteData.pricingMatrix) {
      const fallback = calculateEstimate(leadData);
      return {
        tiers:          fallback.tiers,
        sqFootage:      fallback.squareFootage,
        completionDays: fallback.completionDays,
        modifiers:      fallback.modifiers ?? [],
        multiplier:     fallback.multiplier,
      };
    }

    // ── Path B: Solar API succeeded — use real roof sq footage ───────────────
    if (!solarFailed) {
      const apiTiers                     = deriveApiTiers(quoteData, leadData);
      const { labels, multiplier: mult } = buildModifier(leadData);
      const { completionDays: cd }       = calculateEstimate(leadData);
      return {
        tiers:          apiTiers,
        sqFootage:      quoteData.estimatedRoofSqFt,
        completionDays: cd,
        modifiers:      labels ?? [],
        multiplier:     mult,
      };
    }

    // ── Path C2: Solar failed + manual sq ft entered — scale the matrix ──────
    if (fallbackUnlocked) {
      const { tiers: scaled, roofSqFt }  = scaleFallbackTiers(manualSqFt, storiesNum, quoteData, leadData);
      const { labels, multiplier: mult } = buildModifier(leadData);
      const { completionDays: cd }       = calculateEstimate(leadData);
      return {
        tiers:          scaled,
        sqFootage:      roofSqFt,
        completionDays: cd,
        modifiers:      labels ?? [],
        multiplier:     mult,
      };
    }

    // ── Path C1: Solar failed, gate active — show blurred placeholder prices ─
    // We still derive prices from the fallback matrix so the blurred cards
    // have the right shape. The user can't read or interact with them.
    const { multiplier: mult }                      = buildModifier(leadData);
    const adj                                       = (val: number) => Math.round((val * mult) / 100) * 100;
    const matrix                                    = quoteData.pricingMatrix?.[resolveCategory(propertyDetails?.roofCategory)] ?? {};
    const { tiers: staticTiers, completionDays: cd } = calculateEstimate(leadData);
    const { labels }                                = buildModifier(leadData);
    const placeholderTiers: [PricingTier, PricingTier, PricingTier] = [
      { ...staticTiers[0], min: adj(matrix['good']?.min   ?? 0), max: adj(matrix['good']?.max   ?? 0) },
      { ...staticTiers[1], min: adj(matrix['better']?.min ?? 0), max: adj(matrix['better']?.max ?? 0) },
      { ...staticTiers[2], min: adj(matrix['best']?.min   ?? 0), max: adj(matrix['best']?.max   ?? 0) },
    ];
    return {
      tiers:          placeholderTiers,
      sqFootage:      SERVER_FALLBACK_ROOF_SQ_FT,
      completionDays: cd,
      modifiers:      labels ?? [],
      multiplier:     mult,
    };
  }, [quoteData, leadData, isCalculating, solarFailed, fallbackUnlocked, manualSqFt, storiesNum]);

  // ── Gate submit handler ────────────────────────────────────────────────────

  /**
   * handleGateSubmit — Called when the user clicks "Calculate My Estimate".
   *
   * 1. Updates the store synchronously (triggers immediate re-render with scaled prices).
   * 2. Persists to Firestore in the background (fire-and-forget).
   */
  function handleGateSubmit(sqFt: number) {
    setManualHomeSqFt(sqFt);
    saveManualSqFtToDb(sqFt); // intentionally not awaited — UI updates first
  }

  // ── Display labels ─────────────────────────────────────────────────────────

  const CATEGORY_LABELS: Record<string, string> = {
    asphalt: 'Asphalt Shingles',
    metal:   'Metal Roof',
    flat:    'Flat / Low-Slope',
  };

  const PITCH_LABELS: Record<string, string> = {
    flat:  'Flat',
    low:   'Low Slope',
    steep: 'Steep Pitch',
  };

  // For 'not_sure', the quote is built on asphalt/low-slope defaults — show that explicitly.
  const isNotSure = propertyDetails?.roofCategory === 'not_sure';
  const displayCategoryLabel = isNotSure
    ? 'Asphalt Shingles'
    : (CATEGORY_LABELS[propertyDetails?.roofCategory ?? 'asphalt'] ?? 'Asphalt Shingles');
  const displayPitchLabel = isNotSure
    ? 'Low Slope'
    : (PITCH_LABELS[propertyDetails?.pitch ?? 'low'] ?? 'Low Slope');

  const storiesValue   = propertyDetails?.stories ?? '1';
  const storiesDisplay = `${storiesValue} ${Number(storiesValue) === 1 ? 'Story' : 'Stories'}`;

  const tierDelay = [0.05, 0.15, 0.25];

  // Defensive: always treat modifiers as an array
  const safeModifiers = Array.isArray(modifiers) ? modifiers : [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="step-scroll min-h-dvh">
      <div className="max-w-xl mx-auto px-5 pt-20 pb-16">

        {/* ── Success / Fallback Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle size={40} className="text-green-400" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-green-400/30 animate-ping-slow" />
            </div>
          </div>

          <p className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-2">
            Your Estimate is Ready ✓
          </p>
          <h2 className="text-white text-3xl sm:text-4xl font-extrabold leading-tight mb-3">
            Here&apos;s your<br />personalized quote,
            <span className="text-orange-400"> {contactInfo?.firstName}</span>
          </h2>
          <p className="text-white/50 text-sm">
            Based on your property at{' '}
            <span className="text-white/70 font-medium">{addressData?.street}</span>
          </p>
        </motion.div>

        {/* ── Rough-Estimate Warning Banner (shown after gate is unlocked) ── */}
        <AnimatePresence>
          {fallbackUnlocked && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="
                flex items-start gap-3
                bg-amber-500/10 border border-amber-500/30
                rounded-2xl px-4 py-3 mb-6
              "
            >
              <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-200/80 text-sm leading-relaxed">
                <span className="font-bold text-amber-300">Rough baseline estimate.</span>{' '}
                Because satellite mapping was unavailable for your area, this estimate is based
                on the interior square footage you provided. A detailed, highly accurate quote
                will be sent via email within the next hour.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Property Summary Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-5 mb-8 grid grid-cols-2 sm:grid-cols-3 gap-4"
        >
          {[
            { icon: Home,        label: 'Roof Type',       value: displayCategoryLabel },
            { icon: Zap,         label: 'Est. Roof Sq Ft', value: `~${(sqFootage ?? 0).toLocaleString()} sq ft` },
            { icon: Shield,      label: 'Pitch',           value: displayPitchLabel },
            { icon: Star,        label: 'Stories',         value: storiesDisplay },
            { icon: CheckCircle, label: 'Timeline',        value: completionDays },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Icon size={12} className="text-orange-400" />
                <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">{label}</span>
              </div>
              <span className="text-white text-sm font-bold">{value}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Pricing Tier Cards ── */}
        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest text-center mb-4">
          Your Estimate Range
        </p>

        {isCalculating ? (
          /* Loading skeleton — for users who complete all steps before the API resolves */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-4 mb-6"
          >
            <div className="flex items-center justify-center gap-3 py-4 mb-2">
              <Loader2 size={18} className="text-orange-400 animate-spin" />
              <p className="text-white/60 text-sm font-medium">
                Finalizing your custom estimate…
              </p>
            </div>
            <PricingSkeletonCard />
            <PricingSkeletonCard />
            <PricingSkeletonCard />
          </motion.div>
        ) : !pricingMatrixAvailable ? (
          /* Path D: pricingMatrix missing — show expert-review fallback */
          <PricingUnavailableCard />
        ) : (
          /*
           * Tier cards container.
           *
           * When the gate is active (Solar failed, no manual sq ft yet):
           *   - `blur-md opacity-50 select-none pointer-events-none` hides the
           *     prices visually and prevents any interaction.
           *   - The GateOverlay sits on top via absolute positioning inside the
           *     `relative` wrapper.
           * When unlocked (fallbackUnlocked) or on the happy path (!solarFailed):
           *   - All blur/disabled classes are removed; tier cards are fully interactive.
           */
          <div className="relative mb-6">

            {/* Tier cards — blurred when gate is active */}
            <div
              className={`
                flex flex-col gap-4
                transition-all duration-500
                ${gateActive ? 'blur-md opacity-50 select-none pointer-events-none' : ''}
              `}
            >
              {(tiers ?? []).map((tier, i) => (
                <motion.div
                  key={tier.tier}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: tierDelay[i] ?? 0 }}
                  className={`
                    relative rounded-3xl overflow-hidden border-2
                    ${tier.recommended ? 'border-orange-500 shadow-card-glow' : 'border-white/10'}
                  `}
                >
                  {tier.recommended && (
                    <div className="absolute top-0 inset-x-0 bg-orange-500 text-white text-xs font-bold text-center py-1 tracking-wide">
                      ⭐ MOST POPULAR
                    </div>
                  )}

                  <div className={`bg-gradient-to-r ${tier.colorClass} px-5 ${tier.recommended ? 'pt-7 pb-4' : 'py-4'}`}>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-white/70 text-xs font-bold uppercase tracking-widest">{tier.tier}</p>
                        <p className="text-white font-extrabold text-2xl mt-0.5">
                          {formatCurrency(tier.min)} – {formatCurrency(tier.max)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/50 text-xs">Installed</p>
                        <p className="text-white/70 text-xs font-medium">{completionDays}</p>
                      </div>
                    </div>
                    <p className="text-white/60 text-xs mt-2">{tier.description}</p>
                  </div>

                  {/* Card body — checklist + optional product photo side by side */}
                  <div className="bg-white/15 px-5 py-4">
                    <div className="flex flex-row items-start gap-4">

                      {/* Feature checklist — takes all remaining width */}
                      <ul className="flex-1 space-y-2">
                        {(tier.includes ?? []).map((item) => (
                          <li key={item} className="flex items-start gap-2.5">
                            <CheckCircle size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                            <span className="text-white/70 text-sm">{item}</span>
                          </li>
                        ))}
                      </ul>

                      {/*
                       * Product photo — only rendered when a non-empty path exists
                       * in MATERIAL_IMAGES for this material + tier combination.
                       * Empty strings (metal/flat placeholders) render nothing,
                       * so the checklist naturally expands to fill the full width.
                       */}
                      {(() => {
                        const category = resolveCategory(propertyDetails?.roofCategory);
                        const tierKey  = tier.tier?.toLowerCase() as 'good' | 'better' | 'best';
                        const imgSrc   = MATERIAL_IMAGES[category]?.[tierKey] ?? '';
                        if (!imgSrc) return null;
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imgSrc}
                            alt={`${category} ${tier.tier} tier shingle example`}
                            className="
                              w-24 h-24 flex-shrink-0
                              object-cover rounded-xl
                              border border-white/10
                              shadow-md
                            "
                          />
                        );
                      })()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Gate overlay — only rendered when Solar failed and no manual sq ft yet */}
            {gateActive && <GateOverlay onSubmit={handleGateSubmit} />}
          </div>
        )}

        {/* ── Modifiers fine print ── */}
        {!isCalculating && !gateActive && pricingMatrixAvailable && safeModifiers.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white/12 backdrop-blur-md border border-white/15 rounded-xl px-4 py-3 mb-8 flex items-start gap-2.5"
          >
            <Info size={14} className="text-orange-400/70 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white/50 text-xs font-semibold mb-1">Price adjustments applied:</p>
              <ul className="space-y-0.5">
                {safeModifiers.map((mod) => (
                  <li key={mod} className="text-white/35 text-xs">+ {mod}</li>
                ))}
              </ul>
              <p className="text-white/25 text-xs mt-2">
                Total modifier: ×{multiplier.toFixed(2)} · Est. roof: ~{(sqFootage ?? 0).toLocaleString()} sq ft
                {quoteData && !solarFailed && ` · ${quoteData.squares?.toFixed(1)} squares`}
                {fallbackUnlocked && ` · scaled from ${manualSqFt.toLocaleString()} sq ft interior`}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Promo banner (CRM-toggled) ── */}
        {state.showPromoBanner && state.promoBannerText && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
            className="
              flex items-center gap-4
              bg-gradient-to-r from-orange-500/20 to-orange-600/10
              backdrop-blur-md border border-orange-500/50
              rounded-2xl px-5 py-4 mb-6
            "
          >
            <div className="w-10 h-10 rounded-xl bg-orange-500/25 flex items-center justify-center flex-shrink-0">
              <Tag size={20} className="text-orange-400" />
            </div>
            <p className="text-white font-bold text-base sm:text-lg leading-snug">
              {state.promoBannerText}
            </p>
          </motion.div>
        )}

        {/* ── Step 2: Book Inspection (Calendly inline widget — CRM-toggled) ── */}
        {state.calendlyUrl && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="
              bg-navy-950/60 backdrop-blur-md
              border border-white/10
              rounded-3xl overflow-hidden mb-6
            "
          >
            {/* Card header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-400 font-extrabold text-sm">2</span>
                </div>
                <h3 className="text-white font-extrabold text-lg leading-tight">
                  Book Your Free Roof Inspection
                </h3>
              </div>
              <p className="text-white/45 text-sm ml-11">
                Pick a time that works — no cost, no commitment.
              </p>
            </div>

            {/* Calendly inline widget */}
            <InlineWidget
              url={state.calendlyUrl}
              styles={{ height: '700px' }}
            />
          </motion.div>
        )}

        {/* ── Phone fallback (CRM-toggled) ── */}
        {state.showPhoneButton && state.phoneF && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <button
              onClick={() => { window.location.href = 'tel:' + state.phoneF.replace(/[^\d+]/g, ''); }}
              className="
                w-full min-h-[52px] rounded-2xl bg-white/15 hover:bg-white/25
                border border-white/20 text-white font-semibold
                flex items-center justify-center gap-2
                transition-all duration-200
              "
            >
              <Phone size={18} className="text-orange-400" />
              Prefer to call? {state.phoneF}
            </button>
          </motion.div>
        )}

        {/* Trust footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 pt-6 border-t border-white/15 flex flex-wrap items-center justify-center gap-4"
        >
          {[
            '✓ No upfront cost',
            '✓ Free on-site inspection',
            '✓ Price match guarantee',
            '✓ Fully licensed & insured',
          ].map((text) => (
            <span key={text} className="text-white/35 text-xs font-medium">{text}</span>
          ))}
        </motion.div>

        <p className="text-white/20 text-xs text-center mt-6">
          Estimates are ranges based on property data and market averages.
          Final pricing confirmed after your free inspection.
        </p>
      </div>
    </div>
  );
}
