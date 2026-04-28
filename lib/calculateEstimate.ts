/**
 * calculateEstimate.ts — Pricing logic for the 3-tier Comparison Matrix (Step 10).
 *
 * Flat roof pricing:  $500–$900 per roofing square ($5.00–$9.00/sq ft)
 * Metal roof pricing: $525–$795 per roofing square ($5.25–$7.95/sq ft)
 * Asphalt pricing:    National RSMeans averages, Southeast US market (2024)
 *
 * All prices are for a standard 1,800 sq ft (18-square) home.
 * In production, replace with live parcel data (Regrid / CoreLogic API).
 */

import type { LeadData, RoofCategory } from '@/hooks/useFunnelStore';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface PricingTier {
  tier: 'Good' | 'Better' | 'Best';
  min: number;
  max: number;
  description: string;
  includes: string[];
  colorClass: string;
  recommended: boolean;
}

export interface EstimateResult {
  squareFootage: number;
  roofCategory: RoofCategory;
  tiers: [PricingTier, PricingTier, PricingTier];
  completionDays: string;
  modifiers: string[];
  multiplier: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BASE PRICE TABLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Raw base price ranges in USD for 18 roofing squares (1,800 sq ft).
 * Format: [good_min, good_max, better_min, better_max, best_min, best_max]
 *
 * Flat  — $500–$900/sq × 18sq:  Good=$9k–$10.8k, Better=$11.7k–$13.5k, Best=$14.4k–$16.2k
 * Metal — $525–$795/sq × 18sq:  Good=$9.45k–$11.1k, Better=$11.5k–$12.7k, Best=$13k–$14.3k
 */
const BASE_PRICES: Record<'asphalt' | 'flat' | 'metal', [number, number, number, number, number, number]> = {
  asphalt: [6_500,  9_000,   9_000, 13_500,  13_500, 19_000],
  flat:    [9_000, 10_800,  11_700, 13_500,  14_400, 16_200],
  metal:   [9_450, 11_100,  11_500, 12_700,  13_000, 14_300],
};

/** Static marketing content for each tier, keyed by roof category. */
const TIER_CONTENT: Record<'asphalt' | 'flat' | 'metal', Omit<PricingTier, 'min' | 'max'>[]> = {
  asphalt: [
    {
      tier: 'Good',
      description: '3-tab shingles, standard underlayment, code-minimum flashing.',
      includes: [
        '20-year 3-tab shingles',
        'Standard Synthetic underlayment',
        'Basic ridge cap No Drip Edge',
        '5-year workmanship warranty',
      ],
      colorClass: 'from-slate-600 to-slate-700',
      recommended: false,
    },
    {
      tier: 'Better',
      description: 'Architectural shingles, ice & water shield, full ridge vent.',
      includes: [
        '30-year architectural shingles',
        'Synthetic underlayment',
        'Ice & water shield (eaves + valleys)',
        'Ridge vent system',
        'Drip Edge System',
        '10-year workmanship warranty',
      ],
      colorClass: 'from-blue-600 to-blue-800',
      recommended: true,
    },
    {
      tier: 'Best',
      description: 'Designer shingles, premium moisture system, lifetime guarantee.',
      includes: [
        '30-year architectural designer shingles',
        'Valley reinforcing system',
        'Full drip edge',
        'Ice & water shield (eaves + valleys)',
        'Attic inspection included',
        '10-20 year materia + workmanship warranty',
      ],
      colorClass: 'from-orange-500 to-orange-700',
      recommended: false,
    },
  ],
  flat: [
    {
      tier: 'Good',
      description: 'Modified bitumen, 2-ply system, standard flashing.',
      includes: [
        '2-ply modified bitumen membrane',
        'Standard HVAC curb flashing',
        'Basic interior drain system',
        '5-year warranty',
      ],
      colorClass: 'from-slate-600 to-slate-700',
      recommended: false,
    },
    {
      tier: 'Better',
      description: '60-mil TPO membrane, fully adhered, tapered insulation.',
      includes: [
        '60-mil TPO membrane',
        'Fully adhered installation',
        'Tapered polyiso insulation',
        'Drain redesign included',
        '10-year warranty',
      ],
      colorClass: 'from-blue-600 to-blue-800',
      recommended: true,
    },
    {
      tier: 'Best',
      description: 'EPDM or PVC membrane, R-25 insulation, 20-year material & labor.',
      includes: [
        '80-mil EPDM or PVC membrane',
        'R-25 polyiso insulation board',
        'Overflow drain system',
        'Full re-decking if needed',
        '20-year material & labor warranty',
      ],
      colorClass: 'from-orange-500 to-orange-700',
      recommended: false,
    },
  ],
  metal: [
    {
      tier: 'Good',
      description: 'Corrugated steel/tin, exposed fasteners, Galvalume coating.',
      includes: [
        '26-gauge corrugated steel panels',
        'Exposed fastener system',
        'Galvalume anti-rust coating',
        '10-year finish warranty',
      ],
      colorClass: 'from-slate-600 to-slate-700',
      recommended: false,
    },
    {
      tier: 'Better',
      description: 'Standing seam, concealed fasteners, Kynar 500® finish.',
      includes: [
        '24-gauge standing seam panels',
        'Concealed fastener system',
        'Kynar 500® color coating',
        'Lifetime rust-through warranty',
        '15-year workmanship warranty',
      ],
      colorClass: 'from-blue-600 to-blue-800',
      recommended: true,
    },
    {
      tier: 'Best',
      description: 'Premium aluminum, custom color, architectural finish.',
      includes: [
        '22-gauge aluminum panels',
        'Custom color matching (any RAL)',
        'Copper accent options',
        'Full manufacturer system warranty',
        'Lifetime workmanship warranty',
      ],
      colorClass: 'from-orange-500 to-orange-700',
      recommended: false,
    },
  ],
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CATEGORY RESOLVER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type PricingCategory = 'asphalt' | 'flat' | 'metal';

const VALID_CATEGORIES = new Set<PricingCategory>(['asphalt', 'flat', 'metal']);

/**
 * Maps any unknown/null/undefined value (e.g. 'not_sure') to a PricingCategory
 * so BASE_PRICES and TIER_CONTENT lookups never return undefined.
 * Defaults to 'asphalt' — the most common residential roof type.
 */
function resolveRoofCategory(value: string | null | undefined): PricingCategory {
  if (value && VALID_CATEGORIES.has(value as PricingCategory)) return value as PricingCategory;
  return 'asphalt';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MODIFIER LOGIC
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * buildModifier — Calculates a cumulative price multiplier from property details.
 *
 * Property modifiers (additive):
 *   2 stories         → +15%   (increased staging & safety equipment)
 *   3+ stories        → +30%   (crane / specialized rigging)
 *   Steep pitch       → +20%   (slower install, extra safety gear)
 *   Low pitch         → +5%    (minor additional prep)
 *   Emergency         → +10%   (priority scheduling surcharge)
 *   3+ issues         → +5%    (extra tear-off labor)
 *
 * Material sub-selection modifiers (only for the relevant category):
 *   TPO membrane      → +10%   (premium material vs. Modified Bitumen baseline)
 *   Full re-decking   → +15%   (additional structural labor and materials)
 *   Standing Seam     → +15%   (concealed fastener system premium)
 */
export function buildModifier(leadData: LeadData): { multiplier: number; labels: string[] } {
  let multiplier = 1.0;
  const labels: string[] = [];

  const p = leadData.propertyDetails;
  const resolvedCategory = resolveRoofCategory(p?.roofCategory);

  // ── Stories ────────────────────────────────────────────────────────────────
  if (p.stories === '2') {
    multiplier += 0.15;
    labels.push('Multi-story home (+15%)');
  } else if (p.stories === '3+') {
    multiplier += 0.30;
    labels.push('3+ story home (+30%)');
  }

  // ── Pitch ─────────────────────────────────────────────────────────────────
  if (p.pitch === 'steep') {
    multiplier += 0.20;
    labels.push('Steep pitch (+20%)');
  } else if (p.pitch === 'low') {
    multiplier += 0.05;
    labels.push('Low pitch (+5%)');
  }

  // ── Timeline ───────────────────────────────────────────────────────────────
  if (p.timeline === 'emergency') {
    multiplier += 0.10;
    labels.push('Emergency scheduling (+10%)');
  }

  // ── Issue count ────────────────────────────────────────────────────────────
  if (p.currentIssues.length >= 3) {
    multiplier += 0.05;
    labels.push('Multiple issues (+5%)');
  }

  // ── Flat-roof sub-selections ───────────────────────────────────────────────
  if (resolvedCategory === 'flat') {
    if (p.flatMaterial === 'TPO') {
      multiplier += 0.10;
      labels.push('TPO membrane (+10%)');
    }
    if (p.needsRedecking === true) {
      multiplier += 0.15;
      labels.push('Full re-decking (+15%)');
    }
  }

  // ── Metal-roof sub-selection ───────────────────────────────────────────────
  if (resolvedCategory === 'metal' && p.metalType === 'Standing Seam') {
    multiplier += 0.15;
    labels.push('Standing seam panels (+15%)');
  }

  return { multiplier, labels };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RECOMMENDED TIER LOGIC
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * recommendedTierIndex — Returns which tier (0=Good, 1=Better, 2=Best) should
 * carry the "Most Popular" badge based on the user's material sub-selection.
 *
 * Flat:  EPDM → Best (2), TPO → Better (1), default → Better (1)
 * Metal: Standing Seam → Better (1), Corrugated → Good (0)
 * Asphalt: always Better (1)
 */
function recommendedTierIndex(leadData: LeadData): number {
  const p = leadData.propertyDetails;

  if (p.roofCategory === 'flat') {
    if (p.flatMaterial === 'EPDM') return 2;
    return 1;
  }

  if (p.roofCategory === 'metal') {
    if (p.metalType === 'Standing Seam') return 1;
    if (p.metalType === 'Corrugated (Tin)') return 0;
    return 1; // default
  }

  return 1; // asphalt → Better
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN EXPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function calculateEstimate(leadData: LeadData): EstimateResult {
  const roofCategory = resolveRoofCategory(leadData.propertyDetails?.roofCategory);
  const [gMin, gMax, bMin, bMax, bestMin, bestMax] = BASE_PRICES[roofCategory];
  const { multiplier, labels } = buildModifier(leadData);
  const recIdx = recommendedTierIndex(leadData);

  const adj = (val: number) => Math.round((val * multiplier) / 100) * 100;

  const rawPrices: [number, number][] = [
    [gMin, gMax],
    [bMin, bMax],
    [bestMin, bestMax],
  ];

  const tiers = TIER_CONTENT[roofCategory].map((content, i) => ({
    ...content,
    recommended: i === recIdx,
    min: adj(rawPrices[i][0]),
    max: adj(rawPrices[i][1]),
  })) as [PricingTier, PricingTier, PricingTier];

  const completionMap: Record<PricingCategory, string> = {
    asphalt: '1–3 business days',
    metal:   '3–7 business days',
    flat:    '2–4 business days',
  };

  return {
    squareFootage: 1800,
    roofCategory,
    tiers,
    completionDays: completionMap[roofCategory],
    modifiers: labels,
    multiplier,
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}
