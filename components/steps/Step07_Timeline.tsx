'use client';

import { ArrowLeft } from 'lucide-react';
import type { FunnelStore, Timeline } from '@/hooks/useFunnelStore';

interface Props {
  store: FunnelStore;
}

const OPTIONS: {
  value: Timeline;
  label: string;
  description: string;
  emoji: string;
  badge?: string;
  badgeColor?: string;
}[] = [
  {
    value: 'emergency',
    label: 'As Soon As Possible',
    description: 'I need this done urgently (leak, storm damage)',
    emoji: '🚨',
    badge: 'Priority',
    badgeColor: 'bg-red-500',
  },
  {
    value: '1-3months',
    label: '1–3 Months',
    description: 'I\'m ready to plan and move forward soon',
    emoji: '📅',
    badge: 'Most Common',
    badgeColor: 'bg-green-600',
  },
  {
    value: 'researching',
    label: 'Just Researching',
    description: 'I want to compare options and budget',
    emoji: '🔍',
  },
];

/**
 * Step07_Timeline — "When do you want to start?"
 *
 * The 'emergency' selection triggers a +10% scheduling surcharge
 * in buildModifier() within calculateEstimate.ts.
 *
 * Single-select; auto-advances on tap.
 */
export default function Step07_Timeline({ store }: Props) {
  const { state, goForward, goBackward, updatePropertyDetails } = store;
  const selected = state.leadData.propertyDetails.timeline;

  /**
   * handleSelect — commits timeline and advances.
   * @param value - Timeline value ('emergency' | '1-3months' | 'researching')
   */
  function handleSelect(value: Timeline) {
    updatePropertyDetails({ timeline: value });
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
            Step 7 of 10 · Timeline
          </p>
          <h2 className="text-white text-3xl sm:text-4xl font-extrabold leading-tight">
            When do you want<br />to start?
          </h2>
          <p className="text-white/50 text-sm mt-2">
            Your timeline helps us match you with available crews
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-base ${isSelected ? 'text-white' : 'text-white/90'}`}>
                        {opt.label}
                      </span>
                      {opt.badge && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-white text-xs font-bold ${opt.badgeColor}`}>
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold">✓</span>
                      )}
                    </div>
                    <p className={`text-sm mt-0.5 ${isSelected ? 'text-orange-300' : 'text-white/50'}`}>
                      {opt.description}
                    </p>
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
