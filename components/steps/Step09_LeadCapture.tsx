'use client';

import { useState, useCallback } from 'react';
import {
  ArrowLeft, Lock, User, Mail, Phone, Loader2, ChevronRight,
  Layers, Droplets, Shield, Hammer, Magnet, CheckCircle2,
} from 'lucide-react';
import type { FunnelStore } from '@/hooks/useFunnelStore';
import { syncToFirebase } from '@/services/firebaseService';

interface Props {
  store: FunnelStore;
}

/** Field-level validation errors displayed inline. */
interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  submit?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATORS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address';
  return undefined;
}

function validatePhone(phone: string): string | undefined {
  if (!phone.trim()) return 'Phone number is required';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return 'Enter a valid 10-digit US phone number';
  return undefined;
}

function validateForm(fields: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}): FormErrors {
  const errors: FormErrors = {};
  if (!fields.firstName.trim()) errors.firstName = 'First name is required';
  if (!fields.lastName.trim()) errors.lastName = 'Last name is required';
  const emailError = validateEmail(fields.email);
  if (emailError) errors.email = emailError;
  const phoneError = validatePhone(fields.phone);
  if (phoneError) errors.phone = phoneError;
  return errors;
}

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function Step09_LeadCapture({ store }: Props) {
  const { state, goForward, goBackward, updateContactInfo, setSubmitting, fetchEstimate } = store;
  const { contactInfo } = state.leadData;

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleChange = useCallback(
    (field: keyof typeof contactInfo, value: string) => {
      const formatted = field === 'phone' ? formatPhoneInput(value) : value;
      updateContactInfo({ [field]: formatted });
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors, updateContactInfo]
  );

  const handleBlur = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = useCallback(async () => {
    setTouched({ firstName: true, lastName: true, email: true, phone: true });

    const formErrors = validateForm(contactInfo);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const saveResult = await syncToFirebase(state.leadData, state.firebaseDocId);

      if (!saveResult.success) {
        setErrors({ submit: 'Something went wrong. Please try again.' });
        return;
      }

      console.log('[LeadCapture] Lead saved successfully — ID:', saveResult.data?.id);

      if (state.leadData.addressData) {
        await fetchEstimate(state.leadData.addressData, state.firebaseDocId);
      }

      goForward();
    } catch (err) {
      console.error('[LeadCapture] Unexpected submission error:', err);
      setErrors({ submit: 'An unexpected error occurred. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }, [contactInfo, state.leadData, state.firebaseDocId, goForward, setSubmitting, fetchEstimate]);

  const isSubmitting = state.isSubmitting;

  return (
    <div className="step-scroll flex flex-col min-h-dvh">
      <div className="flex-1 flex flex-col px-5 pt-20 pb-10 max-w-xl mx-auto w-full">

        <button
          onClick={goBackward}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors mb-8 min-h-[44px] -ml-1 disabled:opacity-40"
        >
          <ArrowLeft size={16} />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <p className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-2">
            Step 9 of 10 · Almost Done!
          </p>
          <h2 className="text-white text-3xl sm:text-4xl font-extrabold leading-tight">
            Your estimate is ready!
          </h2>
          <p className="text-white/60 text-base mt-2">
            Where should we send your personalized report?
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-3xl p-6 space-y-4 mb-6">

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">
                First Name
              </label>
              <div className={`
                flex items-center gap-2.5 bg-white/15 rounded-xl px-3 py-3.5 border
                transition-colors min-h-[52px]
                ${touched.firstName && errors.firstName ? 'border-red-400/60' : 'border-white/10 focus-within:border-orange-400/60'}
              `}>
                <User size={15} className="text-white/30 flex-shrink-0" />
                <input
                  type="text"
                  value={contactInfo.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  onBlur={() => handleBlur('firstName')}
                  placeholder="Jane"
                  disabled={isSubmitting}
                  className="flex-1 bg-transparent text-white text-sm font-medium placeholder:text-white/25 outline-none"
                  autoComplete="given-name"
                />
              </div>
              {touched.firstName && errors.firstName && (
                <p className="text-red-400 text-xs mt-1">{errors.firstName}</p>
              )}
            </div>

            <div>
              <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">
                Last Name
              </label>
              <div className={`
                flex items-center gap-2.5 bg-white/15 rounded-xl px-3 py-3.5 border
                transition-colors min-h-[52px]
                ${touched.lastName && errors.lastName ? 'border-red-400/60' : 'border-white/10 focus-within:border-orange-400/60'}
              `}>
                <User size={15} className="text-white/30 flex-shrink-0" />
                <input
                  type="text"
                  value={contactInfo.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  onBlur={() => handleBlur('lastName')}
                  placeholder="Smith"
                  disabled={isSubmitting}
                  className="flex-1 bg-transparent text-white text-sm font-medium placeholder:text-white/25 outline-none"
                  autoComplete="family-name"
                />
              </div>
              {touched.lastName && errors.lastName && (
                <p className="text-red-400 text-xs mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">
              Email Address
            </label>
            <div className={`
              flex items-center gap-2.5 bg-white/8 rounded-xl px-3 py-3.5 border
              transition-colors min-h-[52px]
              ${touched.email && errors.email ? 'border-red-400/60' : 'border-white/10 focus-within:border-orange-400/60'}
            `}>
              <Mail size={15} className="text-white/30 flex-shrink-0" />
              <input
                type="email"
                value={contactInfo.email}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                placeholder="jane@example.com"
                disabled={isSubmitting}
                className="flex-1 bg-transparent text-white text-sm font-medium placeholder:text-white/25 outline-none"
                autoComplete="email"
              />
            </div>
            {touched.email && errors.email && (
              <p className="text-red-400 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">
              Phone Number
            </label>
            <div className={`
              flex items-center gap-2.5 bg-white/8 rounded-xl px-3 py-3.5 border
              transition-colors min-h-[52px]
              ${touched.phone && errors.phone ? 'border-red-400/60' : 'border-white/10 focus-within:border-orange-400/60'}
            `}>
              <Phone size={15} className="text-white/30 flex-shrink-0" />
              <input
                type="tel"
                value={contactInfo.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                onBlur={() => handleBlur('phone')}
                placeholder="(555) 000-0000"
                disabled={isSubmitting}
                className="flex-1 bg-transparent text-white text-sm font-medium placeholder:text-white/25 outline-none"
                autoComplete="tel"
              />
            </div>
            {touched.phone && errors.phone && (
              <p className="text-red-400 text-xs mt-1">{errors.phone}</p>
            )}
          </div>

          {/* Submit error */}
          {errors.submit && (
            <div className="bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{errors.submit}</p>
            </div>
          )}
        </div>

        {/* Education panel — sits between form card and CTA */}
        <RoofingEducationPanel />

        {/* CTA button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`
            w-full min-h-[60px] rounded-2xl font-bold text-lg
            flex items-center justify-center gap-2.5
            transition-all duration-200
            ${isSubmitting
              ? 'bg-orange-500/50 cursor-not-allowed text-white/70'
              : 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white shadow-lg hover:shadow-xl active:scale-[0.98]'}
          `}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Preparing Your Results…
            </>
          ) : (
            <>
              See My Price
              <ChevronRight size={22} />
            </>
          )}
        </button>

        {/* Trust line */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          <Lock size={12} className="text-white/30" />
          <p className="text-white/30 text-xs">
            Your info is encrypted and never sold to third parties
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── RoofingEducationPanel ────────────────────────────────────────────────────

function RoofingEducationPanel() {
  return (
    <div className="flex flex-col gap-5 mb-6">

      {/* ── Section 1: Shingle Grades ── */}
      <div className="relative overflow-hidden bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-xl border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_24px_rgba(0,0,0,0.25)] rounded-3xl p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-t-3xl" />
        <div className="flex items-center gap-2 mb-1">
          <Layers size={14} className="text-orange-400" />
          <p className="text-orange-400 text-xs font-bold uppercase tracking-widest">What goes on your roof</p>
        </div>
        <h4 className="text-white font-bold text-base mb-4">Shingle Grades: Good · Better · Best</h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {/* Good */}
          <div className="bg-white/[0.05] border border-white/[0.10] rounded-2xl p-4 flex flex-col">
            <p className="text-white font-semibold text-sm mb-2">Good — 3-Tab</p>
            <ul className="space-y-1 mb-3 flex-1">
              <li className="text-white/50 text-xs leading-relaxed">Single flat layer, uniform appearance</li>
              <li className="text-white/50 text-xs leading-relaxed">Wind: 60–70 mph · Lifespan: 20–25 yrs</li>
              <li className="text-white/50 text-xs leading-relaxed">Best for: budget replacements, rentals, secondary structures</li>
            </ul>
            <p className="text-white/50 text-xs leading-relaxed mb-1">
              <span className="text-white/70">Brands:</span> GAF Royal Sovereign, CertainTeed XT 25, Owens Corning Supreme
            </p>
            <p className="text-white/35 text-xs italic mt-1">
              Many insurers &amp; HOAs no longer approve 3-tab on primary residences.
            </p>
          </div>

          {/* Better — subtly emphasised */}
          <div className="relative bg-white/[0.05] border border-white/[0.10] rounded-2xl p-4 flex flex-col">
            <span className="absolute -top-2.5 right-3 inline-flex items-center px-2 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold shadow-sm">
              Most Popular
            </span>
            <p className="text-white font-semibold text-sm mb-2">Better — Architectural</p>
            <ul className="space-y-1 mb-3 flex-1">
              <li className="text-white/50 text-xs leading-relaxed">Multi-layer laminated, dimensional shadow lines</li>
              <li className="text-white/50 text-xs leading-relaxed">Wind: 110–130 mph · Lifespan: 30–50 yrs</li>
              <li className="text-white/50 text-xs leading-relaxed">Best for: most residential replacements — the industry standard</li>
            </ul>
            <p className="text-white/50 text-xs leading-relaxed mb-1">
              <span className="text-white/70">Brands:</span> GAF Timberline HDZ, CertainTeed Landmark, Owens Corning Duration
            </p>
            <p className="text-white/35 text-xs italic mt-1">
              Qualifies for significantly better manufacturer warranty coverage.
            </p>
          </div>

          {/* Best */}
          <div className="bg-white/[0.05] border border-white/[0.10] rounded-2xl p-4 flex flex-col">
            <p className="text-white font-semibold text-sm mb-2">Best — Designer / Luxury</p>
            <ul className="space-y-1 mb-3 flex-1">
              <li className="text-white/50 text-xs leading-relaxed">Thick multi-layer, mimics slate or cedar shake</li>
              <li className="text-white/50 text-xs leading-relaxed">Wind: 130+ mph, Class 4 impact available · Lifespan: 40–70 yrs</li>
              <li className="text-white/50 text-xs leading-relaxed">Best for: high-end homes, HOA communities, max curb appeal</li>
            </ul>
            <p className="text-white/50 text-xs leading-relaxed">
              <span className="text-white/70">Brands:</span> GAF Grand Sequoia / Camelot II, CertainTeed Grand Manor, Owens Corning Berkshire
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 2: Underlayment & Ice and Water ── */}
      <div className="relative overflow-hidden bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-xl border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_24px_rgba(0,0,0,0.25)] rounded-3xl p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-t-3xl" />
        <div className="flex items-center gap-2 mb-1">
          <Droplets size={14} className="text-orange-400" />
          <p className="text-orange-400 text-xs font-bold uppercase tracking-widest">What&apos;s under your shingles matters just as much</p>
        </div>
        <h4 className="text-white font-bold text-base mb-4">The Layer Beneath: Underlayment &amp; Ice and Water Shield</h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          <div>
            <p className="text-white font-semibold text-sm mb-2">Synthetic Underlayment</p>
            <p className="text-white/50 text-sm leading-relaxed">
              Every install uses a synthetic felt underlayment across the entire roof deck. Unlike old organic felt paper, synthetic underlayment is tear-resistant, UV-stable, and provides a secondary water barrier if any shingles are damaged. It&apos;s the safety net your shingles never have to count on — unless they need to.
            </p>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-1">
              Ice &amp; Water Shield{' '}
              <span className="text-orange-400 text-xs font-medium">— Not every contractor includes this. We do.</span>
            </p>
            <p className="text-white/50 text-sm leading-relaxed mb-3">
              A self-adhesive rubberized membrane installed in the roof&apos;s most vulnerable areas before underlayment goes down:
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-orange-400 text-xs font-bold flex-shrink-0 mt-0.5">•</span>
                <span className="text-white/50 text-xs leading-relaxed">
                  <span className="text-white/80 font-medium">Eaves</span> — at least 24–36 inches up from the gutter line to stop ice dam backup
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400 text-xs font-bold flex-shrink-0 mt-0.5">•</span>
                <span className="text-white/50 text-xs leading-relaxed">
                  <span className="text-white/80 font-medium">Valleys</span> — where two slopes meet; the single most common source of roof leaks
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400 text-xs font-bold flex-shrink-0 mt-0.5">•</span>
                <span className="text-white/50 text-xs leading-relaxed">
                  <span className="text-white/80 font-medium">Penetrations</span> — around every chimney, vent stack, and skylight where flashing alone isn&apos;t enough
                </span>
              </li>
            </ul>
            <p className="text-white/35 text-xs italic mt-3">
              Skipping ice &amp; water shield in valleys is one of the most common reasons a roof leaks within five years. We install it as standard regardless of local code requirements.
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 3: Drip Edge ── */}
      <div className="relative overflow-hidden bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-xl border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_24px_rgba(0,0,0,0.25)] rounded-3xl p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-t-3xl" />
        <div className="flex items-center gap-2 mb-1">
          <Droplets size={14} className="text-orange-400" />
          <p className="text-orange-400 text-xs font-bold uppercase tracking-widest">The $50 detail that prevents $5,000 in rot</p>
        </div>
        <h4 className="text-white font-bold text-base mb-3">Drip Edge: The Detail Most Contractors Skip</h4>

        <p className="text-white/50 text-sm leading-relaxed mb-4">
          You&apos;ve probably noticed that when you pick up a mug of coffee, a small drop of liquid travels along the bottom of the mug rather than dropping straight down — it follows the curve and ends up on your hand or the table. The same physics happen at your roofline. Without a drip edge, rainwater follows the underside of your shingles and wicks back along the wood fascia via capillary action. Over time, that trapped moisture rots the fascia boards, the soffit, and eventually the rafter tails underneath.
        </p>

        <p className="text-white font-semibold text-sm mb-1">What drip edge does</p>
        <p className="text-white/50 text-sm leading-relaxed mb-4">
          A metal drip edge is installed along every eave and rake before shingles go down. Its outward-angled lip creates a physical break in the surface tension. Water hits the edge, releases, and falls cleanly into the gutter rather than traveling back under your roof.
        </p>

        <p className="text-white font-semibold text-sm mb-1">Why it matters for your warranty</p>
        <p className="text-white/50 text-sm leading-relaxed mb-4">
          GAF, CertainTeed, and Owens Corning all require drip edge installation as part of their full manufacturer warranty coverage. A roof installed without it can result in denied warranty claims — even if the shingles themselves perform perfectly. We always install drip edge. It&apos;s also required by the International Residential Code (IRC R905.2.8.5) on all new asphalt shingle installations.
        </p>

        <div className="bg-white/[0.05] border border-white/[0.10] rounded-2xl px-4 py-3">
          <p className="text-white/40 text-xs leading-relaxed">
            <span className="text-white/60 font-semibold">Bonus protection:</span> Drip edge also seals the gap between the deck and fascia, blocking entry for carpenter bees, wasps, and small rodents that would otherwise nest in the soffit space.
          </p>
        </div>
      </div>

      {/* ── Section 4: Installation Quality ── */}
      <div className="relative overflow-hidden bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-xl border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_24px_rgba(0,0,0,0.25)] rounded-3xl p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-t-3xl" />
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 size={14} className="text-orange-400" />
          <p className="text-orange-400 text-xs font-bold uppercase tracking-widest">Installation quality is everything</p>
        </div>
        <h4 className="text-white font-bold text-base mb-4">How It&apos;s Installed: The Details Your Quote Doesn&apos;t Mention</h4>

        <div className="space-y-5">

          {/* Row 1 — Button cap nails */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Hammer size={15} className="text-orange-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-1">Button Cap Nails, Not Staples</p>
              <p className="text-white/50 text-sm leading-relaxed">
                Cheaper crews still use staples because staple guns are faster. The problem: staples have two narrow legs and a small crown — they tear through underlayment under wind load and have been banned for shingle installation in several states including Florida. We use button cap nails throughout. The wide plastic cap distributes holding pressure across a larger area of underlayment, keeping it tight and tear-resistant even in storm conditions. Every shingle is then secured with ring-shank coil nails nailed into the correct strike zone. A nail even a quarter inch outside the designated nailing band significantly reduces wind uplift resistance.
              </p>
            </div>
          </div>

          {/* Row 2 — Deck prep */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Shield size={15} className="text-blue-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-1">Deck Prep: Old Nails Out, Clean Surface In</p>
              <p className="text-white/50 text-sm leading-relaxed">
                Before any new material touches your deck, our crew removes the old roofing entirely and inspects every board. Any raised or backed-out nails are pulled and re-driven flush — a nail head sitting even slightly proud creates a bump under the new shingles that eventually leads to cracking or a stress fracture in the shingle above it. Any soft or rotted decking boards are replaced before installation begins. Your new roof is only as strong as what it&apos;s nailed into.
              </p>
            </div>
          </div>

          {/* Row 3 — Cleanup */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Magnet size={15} className="text-green-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-1">Cleanup: We Run Magnets — Multiple Times</p>
              <p className="text-white/50 text-sm leading-relaxed">
                A roof tear-off scatters thousands of old nails into gutters, landscaping, the driveway, and the grass. A single roofing nail in a tire costs more than most homeowners think and is entirely avoidable. After the job is complete we run magnetic sweepers across the entire property — driveway, lawn perimeter, flower beds — in multiple passes. We also clear gutters of debris before we leave. Our goal is to leave your property in better condition than we found it. That standard isn&apos;t optional to us; it&apos;s how we&apos;d want our own homes treated.
              </p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
