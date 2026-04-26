'use client';

import { ArrowLeft } from 'lucide-react';
import type { FunnelStore, Stories } from '@/hooks/useFunnelStore';

interface Props {
  store: FunnelStore;
}

const OPTIONS: {
  value: Stories;
  label: string;
  description: string;
  emoji: string;
  impact: string;
}[] = [
  {
    value: '1',
    label: '1 Story',
    description: 'Single-floor home',
    emoji: '🏡',
    impact: 'Standard access · Base pricing',
  },
  {
    value: '2',
    label: '2 Stories',
    description: 'Two-floor home',
    emoji: '🏘️',
    impact: 'Extended staging required · +15%',
  },
  {
    value: '3+',
    label: '3+ Stories',
    description: 'Three or more floors',
    emoji: '🏗️',
    impact: 'Crane / rigging required · +30%',
  },
];

/**
 * Step05_Stories — "How many stories is your home?"
 *
 * Stories count drives the biggest single labor modifier in calculateEstimate.
 * A 3+ story home costs 30% more due to specialized equipment and safety requirements.
 *
 * Single-select; auto-advances on tap.
 */
export default function Step05_Stories({ store }: Props) {
  const { state, goForward, goBackward, updatePropertyDetails } = store;
  const selected = state.leadData.propertyDetails.stories;

  /**
   * handleSelect — commits stories selection and advances the funnel.
   * @param value - Stories value ('1' | '2' | '3+')
   */
  function handleSelect(value: Stories) {
    updatePropertyDetails({ stories: value });
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
            Step 5 of 10 · Stories
          </p>
          <h2 className="text-white text-3xl sm:text-4xl font-extrabold leading-tight">
            How many stories<br />is your home?
          </h2>
          <p className="text-white/50 text-sm mt-2">
            This affects the equipment and crew size we&apos;ll need
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
                    w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0
                    ${isSelected ? 'bg-orange-500/25' : 'bg-white/20'}
                  `}>
                    {opt.emoji}
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
      </div>
    </div>
  );
}
