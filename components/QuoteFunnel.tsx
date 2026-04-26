'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFunnelStore } from '@/hooks/useFunnelStore';
import { fetchCompanyProfile } from '@/services/firebaseService';
import ProgressBar      from '@/components/ProgressBar';
import BackgroundMedia  from '@/components/BackgroundMedia';

// Step components
import Step01_Address    from '@/components/steps/Step01_Address';
import Step02_Verify     from '@/components/steps/Step02_Verification';
import Step03_Roof       from '@/components/steps/Step03_RoofCategory';
import StepFlat_Details  from '@/components/steps/StepFlat_Details';
import StepMetal_Details from '@/components/steps/StepMetal_Details';
import Step04_Pitch      from '@/components/steps/Step04_Pitch';
import Step05_Stories    from '@/components/steps/Step05_Stories';
import Step06_Issues     from '@/components/steps/Step06_Issues';
import Step07_Timeline   from '@/components/steps/Step07_Timeline';
import Step09_Lead       from '@/components/steps/Step09_LeadCapture';
import Step10_Results    from '@/components/steps/Step10_Results';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANIMATION VARIANTS — "Card Deck" horizontal slide
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const cardVariants = {
  enter: (direction: string) => ({
    x: direction === 'forward' ? '100%' : '-100%',
    opacity: 0,
    scale: 0.97,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x:       { type: 'spring', stiffness: 320, damping: 32, mass: 0.8 },
      opacity: { duration: 0.25, ease: 'easeOut' },
      scale:   { duration: 0.25, ease: 'easeOut' },
    },
  },
  exit: (direction: string) => ({
    x: direction === 'forward' ? '-35%' : '35%',
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] },
  }),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGO HEADER — in document flow, scrolls naturally with page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface LogoHeaderProps {
  logoUrl: string | null;
}

function LogoHeader({ logoUrl }: LogoHeaderProps) {
  return (
    <div
      className="relative z-20 pt-6 md:pt-8 flex items-center justify-center pointer-events-none"
      aria-label="Company logo"
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt="Company logo"
          className="h-20 md:h-28 w-auto object-contain max-w-xs md:max-w-sm drop-shadow-2xl pointer-events-auto"
          onError={(e) => {
            (e.target as HTMLImageElement).style.visibility = 'hidden';
          }}
        />
      ) : (
        <div className="h-20 md:h-28 w-48 md:w-64 rounded-xl bg-white/10 shimmer-bg pointer-events-auto" />
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ORCHESTRATOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * QuoteFunnel — Top-level orchestrator for the 10-step roofing quote funnel.
 *
 * Layout layers (back to front):
 * -z-10  Background image (/bg-main.jpg) — fixed, covers full viewport.
 * -z-10  Dark overlay (bg-slate-950/80)  — ensures white text stays readable.
 * -z-10  Dot-grid texture                — subtle depth.
 * z-10   Flanking decorative images      — fixed, lg:block only (hidden on mobile).
 * z-20   Main content column             — in document flow; scrolls naturally.
 * LogoHeader  — scrolls with body; disappears when user scrolls down.
 * ProgressBar — scrolls with body (in-flow, not sticky).
 * Step cards  — horizontal slide animation; body drives vertical scroll.
 *
 * Body scroll (globals.css):
 * body { overflow-x: hidden } — clips horizontal slide overshoot.
 * .step-scroll { min-height: 100dvh } — each step fills the viewport minimum.
 */
export default function QuoteFunnel() {
  const store = useFunnelStore();
  const { state, progress, visualStep, visualTotal } = store;
  const { currentStep, direction } = state;

  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch CRM settings (like the advanced data toggle) into global state
    store.fetchProfile();

    // 2. Fetch the logo for this component's local state
    fetchCompanyProfile()
      .then((result) => {
        if (result.success && result.data?.logoUrl) {
          setLogoUrl(result.data.logoUrl);
        }
      })
      .catch((err) => {
        console.error('[QuoteFunnel] fetchCompanyProfile failed:', err);
      });
  }, []); // Empty dependency array ensures this only runs once on load

  function renderStep() {
    switch (currentStep) {
      case 0:  return <Step01_Address    store={store} />;
      case 1:  return <Step02_Verify     store={store} />;
      case 2:  return <Step03_Roof       store={store} />;
      case 3:  return <StepFlat_Details  store={store} />;
      case 4:  return <StepMetal_Details store={store} />;
      case 5:  return <Step04_Pitch      store={store} />;
      case 6:  return <Step05_Stories    store={store} />;
      case 7:  return <Step06_Issues     store={store} />;
      case 8:  return <Step07_Timeline   store={store} />;
      case 10: return <Step09_Lead       store={store} />;
      case 11: return <Step10_Results    store={store} />;
      default: return null;
    }
  }

  return (
    /*
     * Page root — no fixed height, no overflow-hidden.
     * Body scroll drives the vertical dimension; the fixed background
     * layers below ensure the visual fills the viewport at all times.
     */
    <div className="relative min-h-dvh">

      {/* ── Fixed background (video or image, configured in BackgroundMedia.tsx) ── */}
      <BackgroundMedia />

      {/*
       * ── Flanking decorative images (desktop only) ──
       * Fixed so they stay vertically centred as the user scrolls.
       * hidden on mobile/tablet (<lg) so they never obscure the funnel UI.
       * Adjust w-* to match the actual art dimensions of your PNG files.
       */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/side-left.png"
        alt=""
        aria-hidden="true"
        className="hidden lg:block fixed left-0 top-1/2 -translate-y-1/2 z-10 w-52 xl:w-72 object-contain pointer-events-none select-none"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/side-right.png"
        alt=""
        aria-hidden="true"
        className="hidden lg:block fixed right-0 top-1/2 -translate-y-1/2 z-10 w-52 xl:w-72 object-contain pointer-events-none select-none"
      />

      {/* ── Main content column (in document flow) ── */}
      <div className="relative z-20">

        {/* Logo — scrolls naturally with the page */}
        <LogoHeader logoUrl={logoUrl} />

        {/* Progress bar — in flow directly below logo */}
        <ProgressBar
          progress={progress}
          currentStep={currentStep}
          visualStep={visualStep}
          totalSteps={visualTotal}
        />

        {/*
         * Slide animation wrapper.
         * overflow-x:clip (not overflow-hidden) clips horizontal slide overshoot
         * without creating a scroll container, so the body can still scroll
         * vertically for long steps like Step10_Results.
         *
         * AnimatePresence mode="wait" ensures only one step card is in the DOM
         * at a time, so there is no layout-height doubling during transitions.
         */}
        <div className="[overflow-x:clip]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={cardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full"
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}