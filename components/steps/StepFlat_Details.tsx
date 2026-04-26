'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { syncLeadToDatabase } from '@/services/firebaseService';
import type { FunnelStore, FlatMaterial } from '@/hooks/useFunnelStore';

interface Props {
  store: FunnelStore;
}

const MATERIAL_OPTIONS: { value: FlatMaterial; label: string; detail: string; emoji: string }[] = [
  {
    value: 'EPDM',
    label: 'EPDM',
    detail: 'Rubber membrane · Long lifespan · Low maintenance',
    emoji: '⚫',
  },
  {
    value: 'TPO',
    label: 'TPO',
    detail: 'White membrane · Energy efficient · Most popular',
    emoji: '⬜',
  },
  {
    value: 'Modified Bitumen',
    label: 'Modified Bitumen',
    detail: 'Asphalt-based · Budget-friendly · Easy repairs',
    emoji: '🟤',
  },
];

const REDECK_OPTIONS: { value: boolean | null; label: string; sub: string }[] = [
  { value: true,  label: 'Yes',      sub: 'The deck boards are damaged or rotted' },
  { value: false, label: 'No',       sub: 'The existing deck is in good condition' },
  { value: null,  label: 'Not Sure', sub: 'We will assess it during the inspection' },
];

/**
 * StepFlat_Details — Flat / Low-Slope roof sub-questions.
 *
 * Two questions on one screen:
 *   Q1 — What membrane material are you considering?
 *   Q2 — Does the roof deck need complete re-decking?
 *
 * Continue becomes active once both questions have been answered.
 * Answers are ghost-written to Firestore before advancing.
 */
export default function StepFlat_Details({ store }: Props) {
  const { state, goForward, goBackward, updatePropertyDetails } = store;
  const { propertyDetails, firebaseDocId } = state.leadData;

  // `materialTouched` distinguishes "user hasn't clicked yet" from "user chose Not Sure"
  const [localMaterial, setLocalMaterial] = useState<FlatMaterial | null>(
    propertyDetails.flatMaterial
  );
  const [materialTouched, setMaterialTouched] = useState<boolean>(
    // Already answered if a material is set OR if redeck was already answered (returning user)
    propertyDetails.flatMaterial !== null || propertyDetails.needsRedecking !== null
  );

  const [localRedeck, setLocalRedeck] = useState<boolean | null | 'unset'>(
    propertyDetails.needsRedecking === null && propertyDetails.flatMaterial === null
      ? 'unset'
      : propertyDetails.needsRedecking
  );

  const materialAnswered = materialTouched;
  const redeckAnswered   = localRedeck !== 'unset';
  const canContinue      = materialAnswered && redeckAnswered;

  function selectMaterial(value: FlatMaterial | null) {
    setLocalMaterial(value);
    setMaterialTouched(true);
  }

  function handleContinue() {
    if (!canContinue) return;

    const redeckValue = localRedeck === 'unset' ? null : localRedeck as boolean | null;

    updatePropertyDetails({
      flatMaterial:   localMaterial,
      needsRedecking: redeckValue,
    });

    // Ghost-write to Firestore immediately
    if (firebaseDocId) {
      syncLeadToDatabase(
        { flatMaterial: localMaterial, needsRedecking: redeckValue },
        firebaseDocId
      ).catch((err) =>
        console.warn('[StepFlat_Details] Firestore ghost write failed:', err)
      );
    }

    setTimeout(() => goForward(), 150);
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
            Flat Roof Details
          </p>
          <h2 className="text-white text-3xl sm:text-4xl font-extrabold leading-tight">
            Tell us more about<br />your flat roof
          </h2>
          <p className="text-white/50 text-sm mt-2">
            These details help us give you a more accurate price range
          </p>
        </div>

        {/* Q1 — Material */}
        <div className="mb-8">
          <p className="text-white/70 text-sm font-semibold mb-3">
            What type of material are you considering?
          </p>
          <div className="flex flex-col gap-3">
            {MATERIAL_OPTIONS.map((opt) => {
              const isSelected = localMaterial === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => selectMaterial(opt.value)}
                  className={`
                    option-card w-full text-left rounded-2xl p-4 border-2
                    transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]
                    ${isSelected
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/25'}
                  `}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl flex-shrink-0">{opt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-white/90'}`}>
                          {opt.label}
                        </span>
                        {isSelected && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold">
                            ✓
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${isSelected ? 'text-orange-300' : 'text-white/40'}`}>
                        {opt.detail}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Not Sure option */}
            <button
              onClick={() => selectMaterial(null)}
              className={`
                option-card w-full text-left rounded-2xl p-4 border-2
                transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]
                ${materialTouched && localMaterial === null
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/25'}
              `}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl flex-shrink-0">🤷</span>
                <div>
                  <span className={`font-bold text-sm ${materialTouched && localMaterial === null ? 'text-white' : 'text-white/90'}`}>
                    Not Sure
                  </span>
                  <p className="text-xs mt-0.5 text-white/40">
                    We&apos;ll recommend the best option during the inspection
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Q2 — Re-decking */}
        <div className="mb-8">
          <p className="text-white/70 text-sm font-semibold mb-3">
            Does the roof need complete re-decking?
          </p>
          <div className="flex flex-col gap-3">
            {REDECK_OPTIONS.map((opt) => {
              const isSelected = localRedeck !== 'unset' && localRedeck === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  onClick={() => setLocalRedeck(opt.value)}
                  className={`
                    option-card w-full text-left rounded-2xl p-4 border-2
                    transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]
                    ${isSelected
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/25'}
                  `}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-white/90'}`}>
                        {opt.label}
                      </span>
                      <p className={`text-xs mt-0.5 ${isSelected ? 'text-orange-300' : 'text-white/40'}`}>
                        {opt.sub}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold flex-shrink-0 ml-3">
                        ✓
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Continue */}
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className={`
            w-full min-h-[56px] rounded-2xl font-bold text-base
            transition-all duration-200 active:scale-[0.98]
            ${canContinue
              ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
              : 'bg-white/10 text-white/30 cursor-not-allowed'}
          `}
        >
          {canContinue ? 'Continue →' : 'Answer both questions to continue'}
        </button>

        <p className="text-white/25 text-xs text-center mt-4">
          Answers can be refined during your free on-site inspection.
        </p>
      </div>
    </div>
  );
}
