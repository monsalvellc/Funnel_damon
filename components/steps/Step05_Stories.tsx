'use client';

import { useState } from 'react';
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
  details: string[];
}[] = [
  {
    value: '1',
    label: '1 Story',
    description: 'Single-floor home',
    emoji: '🏡',
    impact: 'Standard access · Base pricing',
    details: ['Ground-level access', 'No staging needed', 'Standard ladders'],
  },
  {
    value: '2',
    label: '2 Stories',
    description: 'Two-floor home',
    emoji: '🏘️',
    impact: 'Extended staging required · +15%',
    details: ['Elevated reach required', 'Perimeter staging set', 'Pump jack or scaffold'],
  },
  {
    value: '3+',
    label: '3+ Stories',
    description: 'Three or more floors',
    emoji: '🏗️',
    impact: 'Crane / rigging required · +30%',
    details: ['Crane or rigging needed', 'Full staging system', 'Specialized lift equipment'],
  },
];

export default function Step05_Stories({ store }: Props) {
  const { state, goForward, goBackward, updatePropertyDetails } = store;
  const [selected, setSelected] = useState<Stories>(
    state.leadData.propertyDetails.stories ?? '1'
  );

  function handleContinue() {
    updatePropertyDetails({ stories: selected });
    goForward();
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
                onClick={() => setSelected(opt.value)}
                className={`
                  option-card w-full text-left rounded-2xl p-5 border-2
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
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {opt.details.map((detail) => (
                        <span
                          key={detail}
                          className={`text-xs px-2 py-0.5 rounded-full border ${
                            isSelected
                              ? 'border-orange-400/30 text-orange-200/60'
                              : 'border-white/10 text-white/30'
                          }`}
                        >
                          {detail}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleContinue}
          className="mt-6 w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold text-base rounded-2xl py-4 transition-colors duration-200"
        >
          Continue
        </button>

        <p className="mt-4 text-white/30 text-xs italic text-center leading-relaxed">
          Every modifier is calculated upfront and shown in your estimate range — no surprise add-ons at the time of signing.
        </p>

        <StoriesInfoPanel />

      </div>
    </div>
  );
}

// ─── StoriesInfoPanel ─────────────────────────────────────────────────────────
function StoriesInfoPanel() {
  return (
    <div className="relative overflow-hidden mt-10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-xl border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_24px_rgba(0,0,0,0.25)] rounded-3xl p-6 mb-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-t-3xl" />
      <p className="text-white/40 text-xs font-semibold uppercase tracking-[0.15em] mb-4">Access &amp; staging guide</p>

      <div className="grid grid-cols-3 gap-3">

        {/* 1 Story */}
        <div className="bg-white/[0.05] border border-white/[0.10] rounded-2xl p-4 flex flex-col gap-2">
          <span className="text-2xl">🏡</span>
          <p className="text-white font-semibold text-xs leading-snug">1 Story</p>
          <ul className="space-y-1.5 flex-1">
            <li className="text-white/50 text-xs leading-relaxed">Ground-level ladder access</li>
            <li className="text-white/50 text-xs leading-relaxed">No staging required</li>
            <li className="text-white/50 text-xs leading-relaxed">Standard crew · Base pricing</li>
          </ul>
        </div>

        {/* 2 Stories */}
        <div className="bg-white/[0.05] border border-white/[0.10] rounded-2xl p-4 flex flex-col gap-2">
          <span className="text-2xl">🏘️</span>
          <p className="text-white font-semibold text-xs leading-snug">2 Stories</p>
          <ul className="space-y-1.5 flex-1">
            <li className="text-white/50 text-xs leading-relaxed">Extended reach required</li>
            <li className="text-white/50 text-xs leading-relaxed">Pump jack or scaffold</li>
            <li className="text-white/50 text-xs leading-relaxed">+15% crew adjustment</li>
          </ul>
        </div>

        {/* 3+ Stories */}
        <div className="bg-white/[0.05] border border-white/[0.10] rounded-2xl p-4 flex flex-col gap-2">
          <span className="text-2xl">🏗️</span>
          <p className="text-white font-semibold text-xs leading-snug">3+ Stories</p>
          <ul className="space-y-1.5 flex-1">
            <li className="text-white/50 text-xs leading-relaxed">Crane or rigging needed</li>
            <li className="text-white/50 text-xs leading-relaxed">Full staging system</li>
            <li className="text-white/50 text-xs leading-relaxed">+30% crew adjustment</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
