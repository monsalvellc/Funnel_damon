/**
 * firebaseService.ts — Firebase integration layer for the roofing quote funnel.
 *
 * Firestore collections:
 *   funnel_damon  — the ONLY collection the public funnel writes to.
 *                   One document per session, grown progressively:
 *                   ghost writes (Steps 01–08) → final submission (Step09).
 *                   Authenticated CRM collections are never touched here.
 *   companies     — company branding (logo URL, name) keyed by company ID.
 *
 * Environment variables (all set in .env.local):
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';

import type { LeadData } from '@/hooks/useFunnelStore';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIREBASE INITIALISATION — singleton pattern for Next.js hot-reload safety
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db  = getFirestore(app);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPANY PROFILE — companies/C_0001
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CompanyProfile {
  name: string;
  logoUrl: string;
  primaryColor?: string;
  phone?: string;
  /** CRM-controlled toggle. When false, syncLeadToDatabase is a no-op. */
  enableGhostWrites?: boolean;
  /** CRM-controlled toggle. When true, Solar API returns roof segments, pitch, imagery date, and satellite image URL. */
  captureAdvancedSolarData?: boolean;
  /** 2-letter state abbreviations the funnel accepts. Use ['ALL'] to allow every state. */
  allowedStates?: string[];
  /** CRM-controlled toggle. When true, the phone call button is shown on the Results page. */
  showPhoneButton?: boolean;
  /** Company phone number displayed on the Results page (e.g. "(336) 505-7977"). */
  phoneF?: string;
  /** Calendly booking URL for the inline widget on the Results page. Empty string hides the widget. */
  calendlyUrl?: string;
  /** CRM-controlled toggle. When true, the promo banner is shown on the Results page. */
  showPromoBanner?: boolean;
  /** Promotional text displayed in the banner between pricing tiers and the Calendly widget. */
  promoBannerText?: string;
}

/** Known-good logo URL — used as fallback if the Firestore document is absent. */
const FALLBACK_LOGO: CompanyProfile = {
  name: 'Damon Roofing Co.',
  logoUrl:
    'https://firebasestorage.googleapis.com/v0/b/roofingleadapp.firebasestorage.app/o/companies%2FC_0001%2Flogo_1774831833794.jpg?alt=media&token=ce0efabf-566d-4d5d-ba77-20c7d758c0ab',
  enableGhostWrites: true,
  captureAdvancedSolarData: false,
  allowedStates: ['NC'],
  showPhoneButton: false,
  phoneF: '',
  calendlyUrl: '',
  showPromoBanner: false,
  promoBannerText: '',
};

/**
 * fetchCompanyProfile — Reads branding from companies/C_0001.
 * Falls back to FALLBACK_LOGO (enableGhostWrites: true) if the document is
 * absent or the field is undefined, so the funnel is always safe to run.
 */
export async function fetchCompanyProfile(): Promise<ServiceResult<CompanyProfile>> {
  try {
    const snap = await getDoc(doc(db, 'companies', 'C_0001'));

    if (!snap.exists()) {
      console.warn('[firebaseService] companies/C_0001 not found — using fallback');
      return { success: true, data: FALLBACK_LOGO };
    }

    const data = snap.data() as CompanyProfile;
    // If the field hasn't been written to Firestore yet, default it to true.
    if (data.enableGhostWrites === undefined) data.enableGhostWrites = true;
    if (data.captureAdvancedSolarData === undefined) data.captureAdvancedSolarData = false;
    if (!Array.isArray(data.allowedStates) || data.allowedStates.length === 0) data.allowedStates = ['NC'];
    if (data.showPhoneButton === undefined) data.showPhoneButton = false;
    if (data.phoneF === undefined) data.phoneF = '';
    if (data.calendlyUrl === undefined) data.calendlyUrl = '';
    if (data.showPromoBanner === undefined) data.showPromoBanner = false;
    if (data.promoBannerText === undefined) data.promoBannerText = '';
    return { success: true, data };
  } catch (err) {
    console.error('[firebaseService] fetchCompanyProfile failed:', err);
    return { success: true, data: FALLBACK_LOGO };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GHOST-WRITE FEATURE FLAG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Module-level flag — the single source of truth for whether ghost writes are
 * permitted. Defaults to true so the funnel works before the profile loads.
 * Only syncLeadToDatabase checks this; syncToFirebase (final submission) never
 * does, so the final Step09 write is always processed.
 */
let _ghostWritesEnabled = true;

/**
 * setGhostWritesEnabled — Called by useFunnelStore after fetchCompanyProfile
 * resolves. Updates the module-level flag so every subsequent call to
 * syncLeadToDatabase respects the CRM toggle without any component changes.
 */
export function setGhostWritesEnabled(enabled: boolean): void {
  _ghostWritesEnabled = enabled;
  console.log(`[firebaseService] Ghost writes ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GHOST LEAD / funnel_damon COLLECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GhostLeadData — partial data accepted by syncLeadToDatabase.
 *
 * Each field is optional so callers send only what changed.
 * Undefined fields are omitted from the write to avoid overwriting
 * previously saved values.
 *
 * Field name notes:
 *   phoneNumerF — intentional schema spelling; do NOT correct the typo,
 *                 as it is the locked Firestore field name in funnel_damon.
 */
export interface GhostLeadData {
  /**
   * Auto-injected on document creation (addDoc only). Associates the lead with
   * the primary tenant profile. Never passed by callers; set internally by
   * syncLeadToDatabase.
   */
  companyId?: string;
  /**
   * Auto-injected on document creation (addDoc only). Drives the "Unread" badge
   * in the CRM dashboard. Set to false so every new lead starts unread.
   * The CRM flips this to true when a user opens the lead; subsequent ghost
   * writes must never overwrite it, which is why it is addDoc-only.
   */
  isRead?: boolean;
  /** Raw address string typed in Step01 (max 50 chars). */
  typeCastF?: string;
  /** Validated address selected from the autocomplete dropdown. */
  addressF?: string;
  /** Timeline / urgency selection from Step07. */
  urgency?: string;
  /** First name from Step09. */
  firstNameF?: string;
  /** Last name from Step09. */
  lastNameF?: string;
  /** Phone number from Step09. Field name locked per Firestore schema. */
  phoneNumerF?: string;
  /** Email address from Step09. */
  emailF?: string;
  /**
   * Solar API outcome string from /api/get-estimate.
   * Written immediately after fetchEstimate resolves so the CRM sees data
   * quality before the user completes Step09.
   * Also included automatically in the full leadData blob on final submit.
   */
  solarDataStatus?: string;
  /** Flat-roof membrane material from StepFlat_Details. */
  flatMaterial?: string | null;
  /** Whether full re-decking is needed, from StepFlat_Details. */
  needsRedecking?: boolean | null;
  /** Metal roof panel style from StepMetal_Details. */
  metalType?: string | null;
  /**
   * Interior square footage manually entered by the user on Step10 when the
   * Solar API returns a "Failed:" status. Used by the sales team to generate
   * an accurate quote when satellite coverage is unavailable.
   */
  manualHomeSqFt?: number;
  /**
   * Requester's IP address, extracted server-side by /api/get-estimate and
   * returned in the response payload. Saved by useFunnelStore after the
   * estimate resolves so the CRM can see traffic origin per lead.
   */
  ipAddress?: string;
}

export interface SyncLeadResult {
  success: boolean;
  /**
   * Firestore document ID.
   * On first write (addDoc) this is a new auto-generated ID.
   * On subsequent writes (updateDoc) this is the same ID echoed back.
   * Store in useFunnelStore.firebaseDocId immediately after the first success.
   */
  docId?: string;
  error?: string;
}

/**
 * syncLeadToDatabase — Upsert handler for the funnel_damon collection.
 *
 *   docId absent → addDoc  (first write; creates the session document)
 *   docId present → updateDoc (all subsequent writes in the same session)
 *
 * The sparse payload pattern ensures only explicitly provided fields are
 * written, preventing overwrites of previously captured data.
 *
 * Field registry — funnel_damon collection:
 *   typeCastF       ← raw address typing,    Step01_Address,     debounce ghost write
 *   addressF        ← validated address,     Step01_Address,     on autocomplete selection
 *   solarDataStatus ← Solar API outcome,     useFunnelStore,     after fetchEstimate resolves
 *   ipAddress       ← requester IP,          useFunnelStore,     after fetchEstimate resolves
 *   flatMaterial    ← membrane material,     StepFlat_Details,   on Continue
 *   needsRedecking  ← re-deck needed,        StepFlat_Details,   on Continue
 *   metalType       ← metal panel style,     StepMetal_Details,  on Continue
 *   urgency         ← timeline value,        Step07_Timeline,    on card selection
 *   firstNameF      ← first name,            Step09_LeadCapture, on form submit
 *   lastNameF       ← last name,             Step09_LeadCapture, on form submit
 *   phoneNumerF     ← phone number,          Step09_LeadCapture, on form submit (name locked)
 *   emailF          ← email address,         Step09_LeadCapture, on form submit
 *
 * To add a new field:
 *   1. Add it to GhostLeadData with a JSDoc comment.
 *   2. Add a conditional entry in the payload block below.
 *   3. Call syncLeadToDatabase() from the relevant step, passing firebaseDocId.
 *   4. Add it to the registry above.
 */
export async function syncLeadToDatabase(
  data: GhostLeadData,
  docId?: string | null
): Promise<SyncLeadResult> {
  // Feature-flag gate — when the CRM disables ghost writes, return a mock
  // success immediately so callers behave normally without touching Firestore.
  if (!_ghostWritesEnabled) {
    console.log('[firebaseService] Ghost writes disabled — skipping write');
    return { success: true, docId: docId ?? undefined };
  }

  // Build a sparse payload — only write fields explicitly provided
  const payload: Record<string, unknown> = {
    source: 'roofing-quote-funnel-web',
  };

  if (data.typeCastF      !== undefined) payload.typeCastF      = data.typeCastF.slice(0, 50);
  if (data.addressF       !== undefined) payload.addressF       = data.addressF;
  if (data.urgency        !== undefined) payload.urgency        = data.urgency;
  if (data.firstNameF     !== undefined) payload.firstNameF     = data.firstNameF;
  if (data.lastNameF      !== undefined) payload.lastNameF      = data.lastNameF;
  if (data.phoneNumerF    !== undefined) payload.phoneNumerF    = data.phoneNumerF;
  if (data.emailF         !== undefined) payload.emailF         = data.emailF;
  if (data.solarDataStatus !== undefined) payload.solarDataStatus = data.solarDataStatus;
  if (data.flatMaterial    !== undefined) payload.flatMaterial    = data.flatMaterial;
  if (data.needsRedecking  !== undefined) payload.needsRedecking  = data.needsRedecking;
  if (data.metalType       !== undefined) payload.metalType       = data.metalType;
  if (data.manualHomeSqFt !== undefined) payload.manualHomeSqFt = data.manualHomeSqFt;
  if (data.ipAddress      !== undefined) payload.ipAddress      = data.ipAddress;

  try {
    if (docId) {
      await updateDoc(doc(db, 'funnel_damon', docId), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      console.log(`[firebaseService] updateDoc → funnel_damon/${docId}`, payload);
      return { success: true, docId };
    } else {
      const ref = await addDoc(collection(db, 'funnel_damon'), {
        ...payload,
        companyId: 'C_0001',
        isRead:    false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`[firebaseService] addDoc → funnel_damon/${ref.id}`, payload);
      return { success: true, docId: ref.id };
    }
  } catch (err) {
    console.error('[firebaseService] syncLeadToDatabase failed:', err);
    return { success: false, error: String(err) };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FINAL LEAD SUBMISSION — funnel_damon collection (Step09 gate)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface LeadDocument {
  id: string;
  createdAt: string;
  source: 'roofing-quote-funnel-web';
  leadData: LeadData;
  status: 'new' | 'contacted' | 'converted' | 'lost';
}

/**
 * syncToFirebase — Final submission write for the funnel_damon collection.
 * Called from Step09_LeadCapture after the user submits their contact info.
 *
 * Strategy:
 *   docId present → updateDoc on the existing ghost document, stamping it
 *                   with the full leadData blob + status:'new' + submittedAt.
 *                   This keeps the entire funnel journey in one document.
 *   docId absent  → addDoc fallback (ghost capture was skipped or failed).
 *
 * The funnel only has write access to funnel_damon. Authenticated CRM
 * collections (customers, jobs, etc.) are never referenced here.
 *
 * @param leadData - Full LeadData from useFunnelStore state
 * @param docId    - Existing funnel_damon document ID from ghost capture
 */
export async function syncToFirebase(
  leadData: LeadData,
  docId?: string | null
): Promise<ServiceResult<LeadDocument>> {
  const payload = {
    leadData,
    status:      'new' as const,
    source:      'roofing-quote-funnel-web' as const,
    submittedAt: serverTimestamp(),
    updatedAt:   serverTimestamp(),
  };

  try {
    if (docId) {
      await updateDoc(doc(db, 'funnel_damon', docId), payload);
      console.log(`[firebaseService] updateDoc (final) → funnel_damon/${docId}`);

      return {
        success: true,
        data: {
          id:        docId,
          createdAt: new Date().toISOString(),
          source:    'roofing-quote-funnel-web',
          leadData,
          status:    'new',
        },
      };
    } else {
      const ref = await addDoc(collection(db, 'funnel_damon'), {
        ...payload,
        createdAt: serverTimestamp(),
      });
      console.log(`[firebaseService] addDoc (final, no ghost doc) → funnel_damon/${ref.id}`);

      return {
        success: true,
        data: {
          id:        ref.id,
          createdAt: new Date().toISOString(),
          source:    'roofing-quote-funnel-web',
          leadData,
          status:    'new',
        },
      };
    }
  } catch (err) {
    console.error('[firebaseService] syncToFirebase failed:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * updateLeadStatus — Patches the status field on a funnel_damon document.
 */
export async function updateLeadStatus(
  leadId: string,
  status: LeadDocument['status']
): Promise<ServiceResult> {
  try {
    await updateDoc(doc(db, 'funnel_damon', leadId), {
      status,
      updatedAt: serverTimestamp(),
    });
    console.log(`[firebaseService] updateLeadStatus → funnel_damon/${leadId} status=${status}`);
    return { success: true };
  } catch (err) {
    console.error('[firebaseService] updateLeadStatus failed:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * logLeadError — Stamps a systemError message onto an existing funnel_damon
 * document so the sales team can see exactly what went wrong on the Results
 * page and follow up manually.
 *
 * Fields written (merged, not replaced):
 *   systemError      — human-readable error description string
 *   errorTimestamp   — server-side Firestore timestamp
 *
 * Failures are swallowed so a secondary write error never surfaces to the user.
 */
export async function logLeadError(leadId: string, errorMsg: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'funnel_damon', leadId), {
      systemError:      errorMsg,
      errorTimestamp:   serverTimestamp(),
    });
    console.log(`[firebaseService] logLeadError → funnel_damon/${leadId}:`, errorMsg);
  } catch (err) {
    console.error('[firebaseService] logLeadError failed (non-fatal):', err);
  }
}

