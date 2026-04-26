'use client';

import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { FunnelStore, RoofIssue } from '@/hooks/useFunnelStore';

interface Props {
  store: FunnelStore;
}

const OPTIONS: {
  value: RoofIssue;
  label: string;
  description: string;
  emoji: string;
  urgency: string;
}[] = [
  {
    value: 'leaking',
    label: 'Active Leak',
    description: 'Water is getting into the home',
    emoji: '💧',
    urgency: 'Urgent — prioritized scheduling',
  },
  {
    value: 'missing_shingles',
    label: 'Missing / Damaged Shingles',
    description: 'Visible shingles are gone or broken',
    emoji: '🔧',
    urgency: 'Moderate — repair or full replacement',
  },
  {
    value: 'old_age',
    label: 'Age / Wear',
    description: 'Roof is nearing or past its lifespan',
    emoji: '⏳',
    urgency: 'Proactive — great time to replace',
  },
  {
    value: 'new_construction',
    label: 'New Construction',
    description: 'Building a new home or addition',
    emoji: '🏗️',
    urgency: 'New build — quote & scheduling',
  },
];

/**
 * Step06_Issues — "What issues are you experiencing?" (multi-select)
 *
 * Unlike previous steps, this is a MULTI-SELECT step.
 * The user can select one or more issues before clicking "Continue".
 * At least one selection is required (validated via validateStep in useFunnelStore).
 *
 * Three or more issues apply a +5% modifier in calculateEstimate.
 *
 * @param store - Full FunnelStore from useFunnelStore()
 */
export default function Step06_Issues({ store }: Props) {
  const { state, goForward, goBackward, updatePropertyDetails } = store;
  const selected = state.leadData.propertyDetails.currentIssues;

  /**
   * toggleIssue — Adds or removes a RoofIssue from the currentIssues array.
   * Maintains immutability by creating a new array on every update.
   *
   * @param value - RoofIssue to toggle
   */
  function toggleIssue(value: RoofIssue) {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    updatePropertyDetails({ currentIssues: next });
  }

  const canAdvance = selected.length > 0;

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
            Step 6 of 10 · Current Issues
          </p>
          <h2 className="text-white text-3xl sm:text-4xl font-extrabold leading-tight">
            What issues are<br />you experiencing?
          </h2>
          <p className="text-white/50 text-sm mt-2">
            Select all that apply — you can choose more than one
          </p>
        </div>

        <div className="flex flex-col gap-3 mb-8">
          {OPTIONS.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleIssue(opt.value)}
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
                    <p className="text-white/30 text-xs mt-1">{opt.urgency}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Multi-select CTA */}
        <button
          onClick={() => canAdvance && goForward()}
          disabled={!canAdvance}
          className={`
            w-full min-h-[56px] rounded-2xl font-bold text-lg
            transition-all duration-200 flex items-center justify-center gap-2
            ${canAdvance
              ? 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white shadow-lg hover:shadow-xl active:scale-[0.98]'
              : 'bg-white/20 text-white/30 cursor-not-allowed'}
          `}
        >
          {canAdvance ? (
            <>Continue <ChevronRight size={20} /></>
          ) : (
            'Select at least one issue'
          )}
        </button>

        {selected.length > 0 && (
          <p className="text-white/40 text-xs text-center mt-3">
            {selected.length} issue{selected.length > 1 ? 's' : ''} selected
            {selected.length >= 3 && ' · Multiple issues noted for pricing'}
          </p>
        )}
      </div>
    </div>
  );
}
