'use client';

import { ArrowLeft } from 'lucide-react';
import type { FunnelStore, RoofPitch } from '@/hooks/useFunnelStore';

interface Props {
  store: FunnelStore;
}

const OPTIONS: {
  value: RoofPitch;
  label: string;
  description: string;
  visual: string;
  impact: string;
}[] = [
  {
    value: 'low',
    label: 'Low Slope',
    description: 'Gentle slope, walkable without equipment',
    visual: '╱',
    impact: 'Moderate pitch · Minor adjustment',
  },
  {
    value: 'steep',
    label: 'Steep Pitch',
    description: 'Sharp angle, requires safety equipment',
    visual: '⟋',
    impact: 'Complex install · Price adjusted +20%',
  },
];

/**
 * Step04_Pitch — "What is the pitch/slope of your roof?"
 *
 * Pitch is a key price modifier: steep roofs add significant labor cost.
 * This data feeds directly into the buildModifier() function in calculateEstimate.ts.
 *
 * Single-select; auto-advances on selection (no explicit Next button).
 */
export default function Step04_Pitch({ store }: Props) {
  const { state, goForward, goBackward, updatePropertyDetails } = store;
  const selected = state.leadData.propertyDetails.pitch;

  /**
   * handleSelect — commits pitch selection and advances to next step.
   * @param value - RoofPitch value ('flat' | 'low' | 'steep')
   */
  function handleSelect(value: RoofPitch) {
    updatePropertyDetails({ pitch: value });
    setTimeout(() => goForward(), 300);
  }

  return (
    <div className="step-scroll flex flex-col min-h-dvh">
      <div className="flex-1 flex flex-col px-5 pt-20 pb-10 max-w-xl mx-auto w-full">

        <button
          onClick={goBackward}
          className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors mb-8 min-h-[44px] -ml-1"
        >
          <ArrowLeft size={16} />
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="mb-8">
          <p className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-2">
            Step 4 of 10 · Pitch
          </p>
          <h2 className="text-white text-3xl sm:text-4xl font-extrabold leading-tight">
            What&apos;s the pitch<br />of your roof?
          </h2>
          <p className="text-white/50 text-sm mt-2">
            Look at your roof from the street — how steep is the angle?
          </p>
        </div>

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
                  <div className={`
                    w-14 h-14 rounded-xl flex items-center justify-center text-3xl font-black flex-shrink-0
                    ${isSelected ? 'bg-orange-500/25 text-orange-300' : 'bg-white/20 text-white/40'}
                  `}>
                    {opt.visual}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-base ${isSelected ? 'text-white' : 'text-white/90'}`}>
                        {opt.label}
                      </span>
                      {isSelected && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold">✓</span>
                      )}
                    </div>
                    <p className={`text-sm mt-0.5 ${isSelected ? 'text-orange-300' : 'text-white/50'}`}>
                      {opt.description}
                    </p>
                    <p className="text-white/30 text-xs mt-1">{opt.impact}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-white/25 text-xs text-center mt-6">
          Your pitch affects labor complexity. An inspector will confirm on-site.
        </p>
      </div>
    </div>
  );
}
