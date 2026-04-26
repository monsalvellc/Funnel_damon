'use client';

import { motion } from 'framer-motion';

interface ProgressBarProps {
  /** 0–100 integer representing funnel completion. */
  progress: number;
  /** Physical step index (0–11) — used to look up the step label. */
  currentStep: number;
  /** 1-based position of this step within the active path sequence. */
  visualStep: number;
  /** Total number of steps in the active path sequence (10 or 11). */
  totalSteps: number;
}

/**
 * Step label map — keyed by physical step index (0–11).
 * Flat Details (3) and Metal Details (4) are distinct labels
 * so the progress bar clearly describes what the user is doing.
 */
const STEP_LABELS: Record<number, string> = {
  0:  'Address',
  1:  'Verification',
  2:  'Roof Type',
  3:  'Flat Details',
  4:  'Metal Details',
  5:  'Pitch',
  6:  'Stories',
  7:  'Issues',
  8:  'Timeline',
  9:  'Financing',
  10: 'Your Info',
  11: 'Results',
};

/**
 * ProgressBar — in-flow bar showing funnel completion.
 *
 * Uses visualStep/totalSteps (sequence-aware) rather than the raw physical
 * step index, so "Step 4 of 10" is always correct regardless of which path
 * (asphalt / flat / metal) the user is on.
 *
 * Hidden on step 0 (hero) so the first impression stays unobstructed.
 */
export default function ProgressBar({
  progress,
  currentStep,
  visualStep,
  totalSteps,
}: ProgressBarProps) {
  if (currentStep === 0) return null;

  const label = STEP_LABELS[currentStep] ?? '';

  return (
    <div
      className="
        relative z-10
        bg-slate-950/70 backdrop-blur-md
        border-b border-white/5
      "
    >
      {/* Step counter row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 max-w-xl mx-auto">
        <span className="text-white/50 text-xs font-medium tracking-wide">
          Step {visualStep} of {totalSteps}
        </span>
        <span className="text-white/70 text-xs font-semibold uppercase tracking-widest">
          {label}
        </span>
        <span className="text-orange-400 text-xs font-bold tabular-nums">
          {progress}%
        </span>
      </div>

      {/* Progress fill track */}
      <div className="h-1 bg-white/10">
        <motion.div
          className="h-full progress-fill rounded-r-full"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
    </div>
  );
}
