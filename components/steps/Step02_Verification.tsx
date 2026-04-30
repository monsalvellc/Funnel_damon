'use client';

import { useState } from 'react';
import { MapPin, CheckCircle, ArrowLeft, Satellite, AlertTriangle, Shield, MessageCircle } from 'lucide-react';
import type { FunnelStore } from '@/hooks/useFunnelStore';

interface Props {
  store: FunnelStore;
}

/**
 * Step02_Verification — Visual confirmation of the selected property.
 *
 * Flow:
 * 1. Mount: shimmer overlay covers the map area while the Static Map image loads.
 * 2. img onLoad: shimmer fades out, satellite image cross-fades in.
 * 3. img onError: shimmer clears, dark fallback placeholder shown instead.
 * 4. User clicks "Confirm My Property" → goForward().
 *
 * Static Map URL notes:
 *   • center=address.fullAddress works for both autocomplete picks and manual entries.
 *   • markers=color:red|lat,lng is only appended when we have valid (non-zero) coords,
 *     so manual-entry users still see the right neighbourhood without a misplaced pin.
 *   • size=800x400 is requested; the img renders at 100% of its container width via
 *     object-cover, so this is a 2× HiDPI source for Retina screens.
 *   • Reuses NEXT_PUBLIC_FIREBASE_API_KEY — this works when Maps Static API is
 *     enabled on the same GCP project as Firebase.
 *     Enable it at: GCP Console → APIs & Services → Maps Static API.
 */
export default function Step02_Verification({ store }: Props) {
  const { state, goForward, goBackward } = store;
  const address = state.leadData.addressData;

  // lat === 0 means manual entry — no image request will be made, so start
  // with isLoading: false to skip the shimmer and show the placeholder directly.
  const hasCoords = !!address && address.lat !== 0 && address.lng !== 0;

  /** True while the satellite image is in-flight. False immediately for manual entries. */
  const [isLoading, setIsLoading] = useState(hasCoords);
  /** True if the Maps Static API returned an error (bad key, quota, network). */
  const [imgError,  setImgError]  = useState(false);

  if (!address) return null;

  // ── Static Map URL ────────────────────────────────────────────────────────
  const staticMapUrl = hasCoords
    ? `https://maps.googleapis.com/maps/api/staticmap` +
      `?center=${address.lat},${address.lng}` +
      `&zoom=19` +
      `&size=800x400` +
      `&maptype=satellite` +
      `&markers=color:red|${address.lat},${address.lng}` +
      `&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    : null;

  return (
    <div className="step-scroll flex flex-col min-h-dvh">
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-20 max-w-xl mx-auto w-full">

        {/* Back button */}
        <button
          onClick={goBackward}
          className="self-start flex items-center gap-1.5 text-white/50 hover:text-white transition-colors mb-6 min-h-[44px] -ml-1"
        >
          <ArrowLeft size={16} />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Eyebrow */}
        <div className="text-center mb-6 w-full">
          <p className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-2">
            Step 2 of 10 · Property Found
          </p>
          <h2 className="text-white text-3xl sm:text-4xl font-extrabold leading-tight">
            Is this your property?
          </h2>
          <p className="text-white/50 text-sm mt-2">
            We pulled satellite imagery to pre-fill your estimate
          </p>
        </div>

        {/* ── Satellite map card ── */}
        <div className="w-full bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl mb-6">

          {/* Map image area */}
          <div className="relative w-full h-52 sm:h-64 bg-slate-800 overflow-hidden">

            {staticMapUrl && !imgError && (
              <img
                src={staticMapUrl}
                alt={`Satellite view of ${address.fullAddress}`}
                className={`
                  absolute inset-0 w-full h-full object-cover
                  transition-opacity duration-500
                  ${isLoading ? 'opacity-0' : 'opacity-100'}
                `}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setImgError(true);
                }}
              />
            )}

            {/* Shimmer overlay — covers the img while it loads, then fades out */}
            <div
              className={`
                absolute inset-0 shimmer-bg
                transition-opacity duration-500
                ${isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}
              `}
            />

            {imgError && (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-600 to-slate-800 flex flex-col items-center justify-center gap-3">
                <Satellite size={36} className="text-white/25" />
                <p className="text-white/40 text-xs font-medium text-center px-6">
                  Satellite view of {address.street}
                </p>
                <p className="text-white/25 text-xs text-center px-6">
                  Map image unavailable — confirm your address below
                </p>
              </div>
            )}

            {/* Satellite live badge — shown once image is ready */}
            {!isLoading && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-white text-xs font-semibold">Satellite</span>
              </div>
            )}
          </div>

          {/* Address info row */}
          <div className="px-5 py-4 flex items-start gap-3">
            {isLoading ? (
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-white/10 rounded shimmer-bg w-3/4" />
                <div className="h-3 bg-white/10 rounded shimmer-bg w-1/2" />
              </div>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin size={16} className="text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-base leading-tight">{address.street}</p>
                  <p className="text-white/50 text-sm mt-0.5">
                    {address.city}{address.city && address.state ? ', ' : ''}{address.state} {address.zip}
                  </p>
                  {hasCoords && (
                    <p className="text-white/30 text-xs mt-1">
                      {address.lat.toFixed(4)}°N, {Math.abs(address.lng).toFixed(4)}°W
                    </p>
                  )}
                </div>
                <CheckCircle size={20} className="text-green-400 flex-shrink-0 mt-1" />
              </>
            )}
          </div>
        </div>

        {/* ── Confirm CTA ── */}
        {!isLoading && (
          <button
            onClick={goForward}
            className="
              w-full min-h-[56px] rounded-2xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700
              text-white font-bold text-lg shadow-lg hover:shadow-xl
              transition-all duration-200 active:scale-[0.98]
              flex items-center justify-center gap-2
            "
          >
            <CheckCircle size={20} />
            Confirm My Property
          </button>
        )}

        {!isLoading && (
          <button
            onClick={goBackward}
            className="
              mt-3 w-full min-h-[48px] rounded-2xl
              bg-white/10 hover:bg-white/15 active:bg-white/20
              backdrop-blur-sm border border-white/20 hover:border-white/30
              text-white/70 hover:text-white font-medium text-sm
              transition-all duration-200 active:scale-[0.98]
              flex items-center justify-center gap-2
            "
          >
            <ArrowLeft size={15} />
            That&apos;s not my address — go back
          </button>
        )}

        <SatelliteInfoPanel />
      </div>
    </div>
  );
}

// ── SatelliteInfoPanel ────────────────────────────────────────────────────────
function SatelliteInfoPanel() {
  return (
    <div className="relative overflow-hidden w-full bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-xl border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_24px_rgba(0,0,0,0.25)] rounded-3xl mt-4 mb-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-t-3xl" />

      {/* Content rows */}
      <div className="px-5 py-5 space-y-3">

        <h3 className="text-white font-bold text-base mb-2">How it works</h3>

        {/* Row 1 — What the system measures */}
        <div className="flex items-start gap-3 bg-white/[0.05] border border-white/[0.10] rounded-2xl p-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckCircle size={15} className="text-green-400" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-snug">What the system measures</p>
            <p className="text-white/50 text-xs leading-relaxed mt-0.5">
              Exterior roofline footprint, ridge lines, and total slope area — derived directly from satellite data.
            </p>
          </div>
        </div>

        {/* Row 2 — What it cannot assess */}
        <div className="flex items-start gap-3 bg-white/[0.05] border border-white/[0.10] rounded-2xl p-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle size={15} className="text-orange-400" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-snug">What it cannot assess</p>
            <p className="text-white/50 text-xs leading-relaxed mt-0.5">
              Structural damage, underlayment condition, decking rot, flashing integrity, and attic ventilation.
            </p>
          </div>
        </div>

        {/* Row 3 — Free on-site inspection */}
        <div className="flex items-start gap-3 bg-white/[0.05] border border-white/[0.10] rounded-2xl p-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Shield size={15} className="text-blue-400" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-snug">Free on-site inspection — always included</p>
            <p className="text-white/50 text-xs leading-relaxed mt-0.5">
              Every job starts with a complimentary in-person inspection before scheduling begins.
            </p>
          </div>
        </div>

        {/* Row 4 — Full free consultation */}
        <div className="flex items-start gap-3 bg-white/[0.05] border border-white/[0.10] rounded-2xl p-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MessageCircle size={15} className="text-violet-400" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-snug">Full free consultation — before you commit</p>
            <p className="text-white/50 text-xs leading-relaxed mt-0.5">
              We walk you through every line of your estimate in person before anything is scheduled. No pressure, no surprises — just clear answers so you can decide with confidence.
            </p>
          </div>
        </div>

        {/* Trust quote */}
        <div className="border border-white/10 rounded-2xl px-4 py-3">
          <p className="text-white/40 text-xs leading-relaxed italic">
            &ldquo;We believe transparency builds better relationships than surprise invoices. This estimate is yours — no obligation.&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
