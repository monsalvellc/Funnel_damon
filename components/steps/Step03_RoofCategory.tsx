'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { FunnelStore, RoofCategory } from '@/hooks/useFunnelStore';

// ─── Roof Type Guide data ─────────────────────────────────────────────────────
// Photos are served from public/images/. Replace each file to update the image.
const ROOF_TYPE_INFO: {
  label: string;
  photo: string;
  cost: string;
  tagline: string;
  lifespan: string;
  tags: string[];
  tagClass: string;
  isHighlighted: boolean;
  badgeClass: string;
  borderAccentClass: string;
}[] = [
  {
    label: 'Asphalt Shingles',
    photo: '/images/roof-type-asphalt.jpg',   // public/images/roof-type-asphalt.jpg
    cost: 'Budget–Mid',
    tagline: 'The most-installed roof type in North America',
    lifespan: '25–50',
    tags: ['Most Popular', 'Easily Repaired', 'Versatile', 'Dependable', 'Budget-Friendly'],
    tagClass: 'bg-orange-500/10 text-orange-300/70',
    isHighlighted: true,
    badgeClass: 'bg-blue-500/20 text-blue-300',
    borderAccentClass: 'border-blue-400/20',
  },
  {
    label: 'Flat / Low Slope',
    photo: '/images/roof-type-flat.jpg',      // public/images/roof-type-flat.jpg
    cost: 'Mid',
    tagline: 'Membrane systems designed for minimal-pitch surfaces',
    lifespan: '20–30',
    tags: ['Low Profile', 'Commercial Grade', 'Accessible', 'Modern Look'],
    tagClass: 'bg-white/10 text-white/50',
    isHighlighted: false,
    badgeClass: 'bg-teal-500/20 text-teal-300',
    borderAccentClass: 'border-teal-400/20',
  },
  {
    label: 'Metal Roof',
    photo: '/images/roof-type-metal.jpg',     // public/images/roof-type-metal.jpg
    cost: 'Premium',
    tagline: 'Long-lasting protection with superior energy performance',
    lifespan: '40–70',
    tags: ['Premium', 'High Upfront Cost', 'Longest Lifespan', 'Energy Efficient'],
    tagClass: 'bg-white/10 text-white/50',
    isHighlighted: false,
    badgeClass: 'bg-orange-500/20 text-orange-300',
    borderAccentClass: 'border-orange-400/20',
  },
];

interface Props {
  store: FunnelStore;
}

const OPTIONS: {
  value: RoofCategory;
  label: string;
  description: string;
  emoji: string;
  detail: string;
}[] = [
  {
    value: 'asphalt',
    label: 'Asphalt Shingles',
    description: 'Most common in the US',
    emoji: '🏠',
    detail: 'Classic look · Affordable · 25–50 yr lifespan',
  },
  {
    value: 'flat',
    label: 'Flat / Low Slope',
    description: 'Membrane or modified bitumen',
    emoji: '🏢',
    detail: 'TPO · EPDM · Modified Bitumen',
  },
  {
    value: 'metal',
    label: 'Metal Roof',
    description: 'Standing seam or corrugated',
    emoji: '⚡',
    detail: 'Longest lifespan · Energy efficient · Premium',
  },
  {
    value: 'not_sure',
    label: 'Not Sure',
    description: "I'm not certain of my roof type",
    emoji: '🤔',
    detail: "No problem — we'll identify it during the inspection",
  },
];

export default function Step03_RoofCategory({ store }: Props) {
  const { state, goForward, goBackward, updatePropertyDetails } = store;
  const selected = state.leadData.propertyDetails.roofCategory;

  // Default to asphalt — the most common roof type. Shown pre-selected on first
  // render. If the user never taps a card, handleContinue commits this default.
  const effectiveSelected: RoofCategory = selected ?? 'asphalt';

  function handleSelect(value: RoofCategory) {
    updatePropertyDetails({ roofCategory: value });
  }

  function handleContinue() {
    if (!selected) updatePropertyDetails({ roofCategory: 'asphalt' });
    goForward();
  }

  return (
    <div className="step-scroll flex flex-col min-h-dvh">
      <div className="flex-1 flex flex-col px-5 pt-20 pb-10 max-w-xl mx-auto w-full">

        {/* Back */}
        <button
          onClick={goBackward}
          className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors mb-8 min-h-[44px] -ml-1"
        >
          <ArrowLeft size={16} />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <p className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-2">
            Step 3 of 10 · Roof Type
          </p>
          <h2 className="text-white text-3xl sm:text-4xl font-extrabold leading-tight">
            What type of roof<br />do you have?
          </h2>
          <p className="text-white/50 text-sm mt-2">
            Select the option that best matches your current roof
          </p>
        </div>

        {/* Option cards */}
        <div className="flex flex-col gap-4">
          {OPTIONS.map((opt) => {
            const isSelected = effectiveSelected === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`
                  option-card w-full text-left rounded-2xl p-5 border-2 min-h-[80px]
                  transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]
                  backdrop-blur-md
                  ${isSelected
                    ? 'border-orange-500 bg-orange-500/20 shadow-card-glow'
                    : 'border-white/10 bg-white/15 hover:border-white/25 hover:bg-white/25'}
                `}
                aria-pressed={isSelected}
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0
                    ${isSelected ? 'bg-orange-500/25' : 'bg-white/20'}
                  `}>
                    {opt.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-base ${isSelected ? 'text-white' : 'text-white/90'}`}>
                        {opt.label}
                      </span>
                      {isSelected && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mt-0.5 ${isSelected ? 'text-orange-300' : 'text-white/50'}`}>
                      {opt.description}
                    </p>
                    <p className="text-white/30 text-xs mt-1">{opt.detail}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Continue button — always orange since a default is always active */}
        <button
          onClick={handleContinue}
          className="w-full mt-6 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-base py-4 rounded-2xl transition-all duration-200 shadow-card-glow flex items-center justify-center gap-2"
        >
          Continue
          <ArrowRight size={18} />
        </button>

        <RoofTypesInfoPanel />

      </div>
    </div>
  );
}

// ─── RoofTypesInfoPanel ───────────────────────────────────────────────────────

function RoofTypesInfoPanel() {
  return (
    <div className="relative overflow-hidden mt-10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-xl border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_24px_rgba(0,0,0,0.25)] rounded-3xl p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-t-3xl" />
      <p className="text-white/40 text-xs font-semibold uppercase tracking-[0.15em] mb-4">
        Roof type guide
      </p>

      <div className="flex flex-col gap-3">
        {ROOF_TYPE_INFO.map((item) => (
          <div
            key={item.label}
            className="relative bg-white/[0.05] border border-white/[0.10] rounded-2xl overflow-hidden flex"
          >
            {/* Most Popular corner badge — Asphalt only */}
            {item.isHighlighted && (
              <span className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl z-10 leading-none tracking-wide">
                ★ Most Popular
              </span>
            )}

            {/* Photo strip — 96 px wide, sourced from public/images/ */}
            <div className="w-24 flex-shrink-0 relative self-stretch overflow-hidden bg-white/5">
              <img
                src={item.photo}
                alt={item.label}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>

            {/* Content */}
            <div className="flex-1 p-4">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-white font-bold text-sm">{item.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${item.badgeClass}`}>
                  {item.cost}
                </span>
              </div>
              <p className="text-white/60 text-xs mb-1.5">{item.tagline}</p>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {item.tags.map((tag) => (
                  <span key={tag} className={`rounded-full text-xs px-2 py-0.5 ${item.tagClass}`}>
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-white/35 text-xs">Typical lifespan: {item.lifespan} years</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-white/35 text-xs mt-4 leading-relaxed">
        Not sure? Select &ldquo;Not Sure&rdquo; above — we&apos;ll identify it during the free inspection.
      </p>
    </div>
  );
}
