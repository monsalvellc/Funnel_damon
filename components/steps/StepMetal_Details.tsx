'use client';

import { ArrowLeft } from 'lucide-react';
import { syncLeadToDatabase } from '@/services/firebaseService';
import type { FunnelStore, MetalType } from '@/hooks/useFunnelStore';

interface Props {
  store: FunnelStore;
}

const OPTIONS: {
  value: MetalType;
  label: string;
  description: string;
  detail: string;
  emoji: string;
  priceHint: string;
}[] = [
  {
    value: 'Standing Seam',
    label: 'Standing Seam',
    description: 'Concealed fasteners, premium finish',
    detail: 'Most durable · Weather-tight · Architectural look',
    emoji: '🏗️',
    priceHint: 'Premium tier',
  },
  {
    value: 'Corrugated (Tin)',
    label: 'Corrugated / Tin',
    description: 'Exposed fasteners, classic look',
    detail: 'Budget-friendly · Easy to install · Agricultural style',
    emoji: '🏚️',
    priceHint: 'Economy tier',
  },
];

/**
 * StepMetal_Details — Metal roof panel style selection.
 *
 * Single question: Standing Seam vs. Corrugated/Tin.
 * Selecting a card immediately ghost-writes to Firestore and advances the funnel.
 */
export default function StepMetal_Details({ store }: Props) {
  const { state, goForward, goBackward, updatePropertyDetails } = store;
  const { propertyDetails, firebaseDocId } = state.leadData;
  const selected = propertyDetails.metalType;

  function handleSelect(value: MetalType) {
    updatePropertyDetails({ metalType: value });

    if (firebaseDocId) {
      syncLeadToDatabase({ metalType: value }, firebaseDocId).catch((err) =>
        console.warn('[StepMetal_Details] Firestore ghost write failed:', err)
      );
    }

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
            Metal Roof Details
          </p>
          <h2 className="text-white text-3xl sm:text-4xl font-extrabold leading-tight">
            What style of metal<br />roof do you want?
          </h2>
          <p className="text-white/50 text-sm mt-2">
            Panel style is the biggest factor in metal roof pricing
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
                  option-card w-full text-left rounded-2xl p-5 border-2 min-h-[100px]
                  transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]
                  ${isSelected
                    ? 'border-orange-500 bg-orange-500/10 shadow-card-glow'
                    : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/8'}
                `}
                aria-pressed={isSelected}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`
                    w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0
                    ${isSelected ? 'bg-orange-500/20' : 'bg-white/8'}
                  `}>
                    {opt.emoji}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-base ${isSelected ? 'text-white' : 'text-white/90'}`}>
                        {opt.label}
                      </span>
                      <span className={`
                        text-xs font-semibold px-2 py-0.5 rounded-full
                        ${isSelected ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}
                      `}>
                        {opt.priceHint}
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

        <p className="text-white/25 text-xs text-center mt-6">
          Not sure? We can walk you through both options during the free inspection.
        </p>
      </div>
    </div>
  );
}
