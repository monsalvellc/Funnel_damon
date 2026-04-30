'use client';

import { ArrowLeft, TrendingUp, Droplets, ShieldCheck } from 'lucide-react';
import type { FunnelStore, RoofPitch } from '@/hooks/useFunnelStore';

interface Props {
  store: FunnelStore;
}

const OPTIONS: {
  value: RoofPitch;
  label: string;
  description: string;
  visual: string;
  impact: string;
}[] = [
  {
    value: 'low',
    label: 'Low Slope',
    description: 'Gentle slope, walkable without equipment',
    visual: '╱',
    impact: 'Moderate pitch · Minor adjustment',
  },
  {
    value: 'steep',
    label: 'Steep Pitch',
    description: 'Sharp angle, requires safety equipment',
    visual: '⟋',
    impact: 'Complex install · Price adjusted +20%',
  },
];

export default function Step04_Pitch({ store }: Props) {
  const { state, goForward, goBackward, updatePropertyDetails } = store;
  const selected = state.leadData.propertyDetails.pitch;
  // 'low' is the default — visible immediately, committed to store on Continue if untouched
  const effectiveSelected: RoofPitch = selected ?? 'low';

  function handleSelect(value: RoofPitch) {
    updatePropertyDetails({ pitch: value });
  }

  function handleContinue() {
    if (!selected) updatePropertyDetails({ pitch: 'low' });
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
            Step 4 of 10 · Pitch
          </p>
          <h2 className="text-white text-3xl sm:text-4xl font-extrabold leading-tight">
            What&apos;s the pitch<br />of your roof?
          </h2>
          <p className="text-white/50 text-sm mt-2">
            Look at your roof from the street — how steep is the angle?
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
                    w-14 h-14 rounded-xl flex items-center justify-center text-3xl font-black flex-shrink-0
                    ${isSelected ? 'bg-orange-500/25 text-orange-300' : 'bg-white/20 text-white/40'}
                  `}>
                    {opt.visual}
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

        <p className="text-white/25 text-xs text-center mt-4">
          Your pitch affects labor complexity. An inspector will confirm on-site.
        </p>

        <PitchInfoPanel />
      </div>
    </div>
  );
}

// ─── PitchInfoPanel ───────────────────────────────────────────────────────────
// Photo slots — place images in public/images/ using the filenames listed below.
// Each <img> falls back to a dark placeholder when the file is not yet present.
function PitchInfoPanel() {
  return (
    <div className="relative overflow-hidden mt-10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-xl border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_24px_rgba(0,0,0,0.25)] rounded-3xl p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-t-3xl" />
      <h3 className="text-white font-bold text-sm mb-1">How Pitch Affects Your Quote</h3>
      <p className="text-white/50 text-xs leading-relaxed mb-5">
        Pitch affects more than your quote — it shapes how your roof performs for decades. Steeper angles shed water faster and can extend shingle life, but demand more from every crew member on-site. Lower slopes are simpler to install but require tighter waterproofing details at every seam and transition.
      </p>

      {/* SVG Diagram */}
      <div className="bg-white/[0.05] border border-white/[0.10] rounded-2xl p-4 mb-5">
        <svg viewBox="0 0 400 210" className="w-full" aria-hidden="true" overflow="visible">

          {/* Dashed center divider */}
          <line
            x1="200" y1="8" x2="200" y2="205"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            strokeDasharray="5 4"
          />

          {/* ── LOW SLOPE (left, blue tones) ──────────────────────────── */}
          <polygon
            points="25,180 100,161 175,180"
            fill="rgba(59,130,246,0.18)"
            stroke="rgba(96,165,250,0.75)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line x1="25" y1="180" x2="50" y2="180" stroke="rgba(96,165,250,0.3)" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 47,180 A 22,22 0 0,0 46.3,174.6" fill="none" stroke="rgba(96,165,250,0.85)" strokeWidth="1.5" strokeLinecap="round" />
          <text x="50" y="174" fill="rgba(147,197,253,0.9)" fontSize="8.5" fontFamily="system-ui,sans-serif" fontWeight="600">3:12</text>
          <text x="100" y="200" textAnchor="middle" fill="rgba(147,197,253,0.75)" fontSize="11" fontFamily="system-ui,sans-serif" fontWeight="600">Low Slope</text>

          {/* ── STEEP PITCH (right, orange tones) ─────────────────────── */}
          <polygon
            points="225,180 300,124 375,180"
            fill="rgba(249,115,22,0.15)"
            stroke="rgba(251,146,60,0.75)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line x1="225" y1="180" x2="252" y2="180" stroke="rgba(251,146,60,0.3)" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 247,180 A 22,22 0 0,0 242.6,166.8" fill="none" stroke="rgba(251,146,60,0.85)" strokeWidth="1.5" strokeLinecap="round" />
          <text x="250" y="165" fill="rgba(253,186,116,0.9)" fontSize="8.5" fontFamily="system-ui,sans-serif" fontWeight="600">9:12</text>
          <text x="300" y="200" textAnchor="middle" fill="rgba(253,186,116,0.75)" fontSize="11" fontFamily="system-ui,sans-serif" fontWeight="600">Steep Pitch</text>

        </svg>
      </div>

      {/* Explanation rows — each with a photo header */}
      <div className="flex flex-col gap-3 mb-4">

        {/* Low slope */}
        <div className="bg-white/[0.05] border border-white/[0.10] rounded-2xl overflow-hidden">
          {/* public/images/pitch-low-slope.jpg — photo of a low-slope / gently-pitched residential roof */}
          <div className="w-full h-36 bg-slate-800 overflow-hidden">
            <img
              src="/images/pitch-low-slope.jpg"
              alt="Low slope roof"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-4 flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-500/20">
              <TrendingUp size={16} className="text-blue-400" />
            </div>
            <div>
              <p className="text-white text-xs font-semibold mb-1">Low slope — accessible, but drainage-sensitive</p>
              <p className="text-white/50 text-xs leading-relaxed">
                Gentler angles are walkable without harnesses, keeping labor at the base rate. The trade-off: water exits more slowly, so proper membrane installation and tight lap sealing at every seam is critical to prevent long-term ponding damage at flashings and transitions.
              </p>
            </div>
          </div>
        </div>

        {/* Steep pitch */}
        <div className="bg-white/[0.05] border border-white/[0.10] rounded-2xl overflow-hidden">
          {/* public/images/pitch-steep.jpg — photo of a steep-pitched residential roof, ideally showing the dramatic angle */}
          <div className="w-full h-36 bg-slate-800 overflow-hidden">
            <img
              src="/images/pitch-steep.jpg"
              alt="Steep pitch roof"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-4 flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-orange-500/20">
              <TrendingUp size={16} className="text-orange-400" />
            </div>
            <div>
              <p className="text-white text-xs font-semibold mb-1">Steep pitch — fast drainage, specialized crew</p>
              <p className="text-white/50 text-xs leading-relaxed">
                High-angle roofs shed rain quickly, reducing pooling and extending shingle life — especially around the ridge. The complexity comes during installation: safety harnesses and walk boards are required by code, pace is slower, and material waste increases at hips and valleys. The +20% modifier already reflects all of this in your estimate range.
              </p>
            </div>
          </div>
        </div>

        {/* Valleys, skylights & chimneys */}
        <div className="bg-white/[0.05] border border-white/[0.10] rounded-2xl overflow-hidden">
          {/* public/images/pitch-valleys.jpg — close-up of a roof valley, chimney flashing, or skylight transition */}
          <div className="w-full h-36 bg-slate-800 overflow-hidden">
            <img
              src="/images/pitch-valleys.jpg"
              alt="Roof valley and chimney transition"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-4 flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-sky-500/20">
              <Droplets size={16} className="text-sky-400" />
            </div>
            <div>
              <p className="text-white text-xs font-semibold mb-1">Valleys, skylights &amp; chimney transitions</p>
              <p className="text-white/50 text-xs leading-relaxed">
                Wherever two roof planes meet or a penetration breaks the field — a valley, chimney, or skylight — water concentrates under pressure. We install self-sealing ice &amp; water shield beneath the shingles in these zones, reinforced step flashing at vertical surfaces, and on steeper roofs an additional underlayment layer to handle the higher water velocity running through each transition.
              </p>
            </div>
          </div>
        </div>

        {/* Drip edge */}
        <div className="bg-white/[0.05] border border-white/[0.10] rounded-2xl overflow-hidden">
          {/* public/images/pitch-drip-edge.jpg — close-up of metal drip edge installed at a roof eave or rake edge */}
          <div className="w-full h-36 bg-slate-800 overflow-hidden">
            <img
              src="/images/pitch-drip-edge.jpg"
              alt="Drip edge installation at roof eave"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-4 flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-500/20">
              <ShieldCheck size={16} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-white text-xs font-semibold mb-1">Drip edge — your first defense against rot</p>
              <p className="text-white/50 text-xs leading-relaxed">
                Without drip edge, water running off the roof&apos;s eave wicks back underneath by surface tension — the same way liquid creeps up the inside of a full mug. A properly installed drip edge breaks that tension, directing water cleanly off the eave and into the gutter. This protects the fascia board and decking edge from the slow, invisible rot that often goes unnoticed until replacement time.
              </p>
            </div>
          </div>
        </div>

      </div>

      <p className="text-white/30 text-xs text-center">
        An inspector will confirm your exact pitch on-site before any work begins.
      </p>
    </div>
  );
}
