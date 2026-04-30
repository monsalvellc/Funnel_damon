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
 */
export default function Step07_Timeline({ store }: Props) {
  const { state, goForward, goBackward, updatePropertyDetails } = store;
  const selected = state.leadData.propertyDetails.timeline;

  // Default to the most common option so the button is always active.
  const effectiveSelected: Timeline = selected ?? '1-3months';

  function handleSelect(value: Timeline) {
    updatePropertyDetails({ timeline: value });
  }

  function handleContinue() {
    if (!selected) updatePropertyDetails({ timeline: '1-3months' });
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

        <button
          onClick={handleContinue}
          className="w-full mt-6 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-base py-4 rounded-2xl transition-all duration-200 shadow-card-glow"
        >
          Continue
        </button>

        <QualityInstallationPanel />

      </div>
    </div>
  );
}

// ─── Info Panel ───────────────────────────────────────────────────────────────

function QualityInstallationPanel() {
  return (
    <div className="relative overflow-hidden mt-10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-xl border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_24px_rgba(0,0,0,0.25)] rounded-3xl p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-t-3xl" />
      
      <div className="mb-6">
        <h3 className="text-white font-bold text-base mb-1">The Anatomy of a Quality Install</h3>
        <p className="text-white/50 text-xs leading-relaxed">
          We believe the materials you <em>don&apos;t</em> see are just as important as the shingles you do. Here is how we ensure your roof is built to last.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        
        {/* Step 1: Prep & Underlayment */}
        <div className="border border-white/[0.10] bg-white/[0.05] rounded-2xl overflow-hidden flex flex-col">
          <div className="w-full h-36 bg-slate-800 overflow-hidden relative">
            <img 
              src="/images/quality-decking.jpg" 
              alt="Clean Decking and Synthetic Underlayment" 
              className="w-full h-full object-cover absolute inset-0"
            />
          </div>
          <div className="p-4 flex items-start gap-3">
            <span className="text-xl leading-none mt-0.5 flex-shrink-0">🪵</span>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-white mb-1">Clean Decking &amp; Synthetic Underlayment</h4>
              <p className="text-white/50 text-xs leading-relaxed">
                A great roof starts with a clean slate. We strip your roof to the bare wood and <strong>remove ALL old nails</strong>. Then, we install premium synthetic underlayment, ensuring it is properly nailed and staggered to create an impenetrable watertight barrier.
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: Edge & Flashing */}
        <div className="border border-white/[0.10] bg-white/[0.05] rounded-2xl overflow-hidden flex flex-col">
          <div className="w-full h-36 bg-slate-800 overflow-hidden relative">
            <img 
              src="/images/quality-flashing.jpg" 
              alt="F5/F8 Drip Edge and Custom Flashing" 
              className="w-full h-full object-cover absolute inset-0"
            />
          </div>
          <div className="p-4 flex items-start gap-3">
            <span className="text-xl leading-none mt-0.5 flex-shrink-0">🛡️</span>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-white mb-1">F5/F8 Drip Edge &amp; Custom Flashing</h4>
              <p className="text-white/50 text-xs leading-relaxed">
                We never cut corners on the perimeter. We use proper F5 and F8 drip edge of the correct length, securely attached to protect your fascia from rot. We also completely re-do all flashing around chimneys, vents, and valleys to guarantee no leaks.
              </p>
            </div>
          </div>
        </div>

        {/* Step 3: Clean-up & Warranty */}
        <div className="border border-white/[0.10] bg-white/[0.05] rounded-2xl overflow-hidden flex flex-col">
          <div className="w-full h-36 bg-slate-800 overflow-hidden relative">
            <img 
              src="/images/quality-cleanup.jpg" 
              alt="Meticulous Clean-up and Inspection" 
              className="w-full h-full object-cover absolute inset-0"
            />
          </div>
          <div className="p-4 flex items-start gap-3">
            <span className="text-xl leading-none mt-0.5 flex-shrink-0">🧹</span>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-white mb-1">Meticulous Clean-up &amp; Warranty</h4>
              <p className="text-white/50 text-xs leading-relaxed">
                Quality matters until our trucks pull away. Multiple crew members conduct a thorough, sweeping clean-up of your property, followed by a strict final inspection. We stand behind our detailed installation with an industry-leading warranty.
              </p>
            </div>
          </div>
        </div>

      </div>

      <p className="text-white/30 text-xs text-center mt-5 px-2 font-medium">
        Trustworthy materials + detailed installation = True peace of mind.
      </p>
    </div>
  );
}