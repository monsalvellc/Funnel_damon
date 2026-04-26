'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Lock, User, Mail, Phone, Loader2, ChevronRight } from 'lucide-react';
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

/**
 * validateEmail — checks for a valid email format using a standard regex.
 *
 * @param email - Raw string from the email input
 * @returns     Error message string, or undefined if valid
 */
function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address';
  return undefined;
}

/**
 * validatePhone — strips non-numeric characters and validates US phone length.
 *
 * @param phone - Raw string from the phone input (may include dashes, parens)
 * @returns     Error message string, or undefined if valid
 */
function validatePhone(phone: string): string | undefined {
  if (!phone.trim()) return 'Phone number is required';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return 'Enter a valid 10-digit US phone number';
  return undefined;
}

/**
 * validateForm — runs all field validators and returns a FormErrors object.
 * An empty object means the form is valid.
 *
 * @param fields - ContactInfo fields from the form state
 * @returns      FormErrors object (may be empty if all valid)
 */
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

/**
 * formatPhoneInput — auto-formats a phone number as the user types.
 * Input: "9193334444" → Output: "(919) 333-4444"
 *
 * @param raw - Raw string including any previously formatted characters
 * @returns  Formatted phone string
 */
function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Step09_LeadCapture — The Gate; collects contact info before revealing results.
 *
 * Submission flow:
 * 1. Validate all fields client-side.
 * 2. Call syncToFirebase() to write the full LeadData to Firestore.
 * 3. On success → goForward() to reveal the Results step.
 * 4. On error → show inline error message, keep user on this step.
 *
 * The store.setSubmitting() flag shows a loading spinner on the button
 * and disables the form to prevent double-clicks.
 */
export default function Step09_LeadCapture({ store }: Props) {
  const { state, goForward, goBackward, updateContactInfo, setSubmitting } = store;
  const { contactInfo } = state.leadData;

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  /**
   * handleChange — updates a single ContactInfo field on every keystroke.
   * Phone field is auto-formatted as the user types.
   *
   * @param field - Field key within ContactInfo
   * @param value - New raw string value from the input
   */
  const handleChange = useCallback(
    (field: keyof typeof contactInfo, value: string) => {
      const formatted = field === 'phone' ? formatPhoneInput(value) : value;
      updateContactInfo({ [field]: formatted });
      // Clear error as user types
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors, updateContactInfo]
  );

  const handleBlur = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = useCallback(async () => {
    // Mark all fields touched so errors appear
    setTouched({ firstName: true, lastName: true, email: true, phone: true });

    const formErrors = validateForm(contactInfo);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      // Write to Firebase — update the existing ghost doc in funnel_damon
      const saveResult = await syncToFirebase(state.leadData, state.firebaseDocId);

      if (!saveResult.success) {
        setErrors({ submit: 'Something went wrong. Please try again.' });
        return;
      }

      console.log('[LeadCapture] Lead saved successfully — ID:', saveResult.data?.id);
      goForward();
    } catch (err) {
      console.error('[LeadCapture] Unexpected submission error:', err);
      setErrors({ submit: 'An unexpected error occurred. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }, [contactInfo, state.leadData, goForward, setSubmitting]);

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
