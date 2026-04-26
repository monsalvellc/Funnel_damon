'use client';

import { ArrowLeft, DollarSign, Ban } from 'lucide-react';
import type { FunnelStore } from '@/hooks/useFunnelStore';

interface Props {
  store: FunnelStore;
}

/**
 * Step08_Financing — "Are you interested in financing options?"
 *
 * Simple Yes / No binary toggle.
 * Financing interest is stored as `boolean | null` in propertyDetails.
 * This data is used for lead qualification and is passed to the CRM.
 *
 * Auto-advances on selection.
 */
export default function Step08_Financing({ store }: Props) {
  const { state, goForward, goBackward, updatePropertyDetails } = store;
  const selected = state.leadData.propertyDetails.financing;

  /**
   * handleSelect — commits financing preference and advances.
   * @param value - boolean (true = interested, false = not interested)
   */
  function handleSelect(value: boolean) {
    updatePropertyDetails({ financing: value });
    setTimeout(() => goForward(), 300);
  }

  const yesSelected = selected === true;
  const noSelected = selected === false;

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

        <div className="mb-10 text-center">
          <p className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-2">
            Step 8 of 10 · Financing
          </p>
          <h2 className="text-white text-3xl sm:text-4xl font-extrabold leading-tight">
            Interested in<br />financing options?
          </h2>
          <p className="text-white/50 text-sm mt-3 max-w-xs mx-auto">
            We partner with lenders for 0% APR plans and low monthly payments
          </p>
        </div>

        {/* Financing benefit callout */}
        <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-4 mb-8 text-center">
          <p className="text-white/70 text-sm font-medium">
            💳 &nbsp;As low as <span className="text-orange-400 font-bold">$149/mo</span> for qualified homeowners
          </p>
          <p className="text-white/30 text-xs mt-1">
            12-month same-as-cash · 5-year fixed rate options available
          </p>
        </div>

        {/* Yes / No large cards — side by side on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* YES */}
          <button
            onClick={() => handleSelect(true)}
            className={`
              option-card flex flex-col items-center justify-center gap-3
              rounded-2xl border-2 py-8 px-6 min-h-[140px]
              transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
              backdrop-blur-md
              ${yesSelected
                ? 'border-orange-500 bg-orange-500/20 shadow-card-glow'
                : 'border-white/10 bg-white/15 hover:border-white/25 hover:bg-white/25'}
            `}
            aria-pressed={yesSelected}
          >
            <div className={`
              w-16 h-16 rounded-full flex items-center justify-center
              ${yesSelected ? 'bg-orange-500/25' : 'bg-green-500/20'}
            `}>
              <DollarSign size={28} className={yesSelected ? 'text-orange-400' : 'text-green-400'} />
            </div>
            <div className="text-center">
              <p className={`font-extrabold text-xl ${yesSelected ? 'text-white' : 'text-white/90'}`}>Yes</p>
              <p className={`text-sm mt-1 ${yesSelected ? 'text-orange-300' : 'text-white/40'}`}>
                Show me options
              </p>
            </div>
            {yesSelected && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-orange-500 text-white text-xs font-bold">Selected ✓</span>
            )}
          </button>

          {/* NO */}
          <button
            onClick={() => handleSelect(false)}
            className={`
              option-card flex flex-col items-center justify-center gap-3
              rounded-2xl border-2 py-8 px-6 min-h-[140px]
              transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
              backdrop-blur-md
              ${noSelected
                ? 'border-orange-500 bg-orange-500/20 shadow-card-glow'
                : 'border-white/10 bg-white/15 hover:border-white/25 hover:bg-white/25'}
            `}
            aria-pressed={noSelected}
          >
            <div className={`
              w-16 h-16 rounded-full flex items-center justify-center
              ${noSelected ? 'bg-orange-500/25' : 'bg-slate-500/20'}
            `}>
              <Ban size={28} className={noSelected ? 'text-orange-400' : 'text-slate-400'} />
            </div>
            <div className="text-center">
              <p className={`font-extrabold text-xl ${noSelected ? 'text-white' : 'text-white/90'}`}>No</p>
              <p className={`text-sm mt-1 ${noSelected ? 'text-orange-300' : 'text-white/40'}`}>
                Paying out of pocket
              </p>
            </div>
            {noSelected && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-orange-500 text-white text-xs font-bold">Selected ✓</span>
            )}
          </button>
        </div>

        <p className="text-white/25 text-xs text-center mt-6">
          Either option gives you full access to your quote
        </p>
      </div>
    </div>
  );
}
