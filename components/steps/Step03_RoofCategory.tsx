'use client';

import { ArrowLeft } from 'lucide-react';
import type { FunnelStore, RoofCategory } from '@/hooks/useFunnelStore';

interface Props {
  store: FunnelStore;
}

/** Visual config for each roof category option card. */
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

/**
 * Step03_RoofCategory — "What type of roof do you have?"
 *
 * Renders three large tappable option cards.
 * Selecting any card immediately calls updatePropertyDetails + goForward()
 * for a zero-friction experience (no explicit "Next" button needed).
 *
 * @param store - Full FunnelStore from useFunnelStore()
 */
export default function Step03_RoofCategory({ store }: Props) {
  const { state, goForward, goBackward, updatePropertyDetails } = store;
  const selected = state.leadData.propertyDetails.roofCategory;

  /**
   * handleSelect — Commits the selected roof category and advances the funnel.
   *
   * @param value - RoofCategory enum value ('asphalt' | 'flat' | 'metal')
   */
  function handleSelect(value: RoofCategory) {
    updatePropertyDetails({ roofCategory: value });
    setTimeout(() => goForward(), 300);
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
            const isSelected = selected === opt.value;
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
                  {/* Icon */}
                  <div className={`
                    w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0
                    ${isSelected ? 'bg-orange-500/25' : 'bg-white/20'}
                  `}>
                    {opt.emoji}
                  </div>

                  {/* Labels */}
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

      </div>
    </div>
  );
}
