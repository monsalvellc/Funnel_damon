'use client';

import { useReducer, useCallback, useEffect, useRef } from 'react';
import {
  syncLeadToDatabase,
  setGhostWritesEnabled,
  fetchCompanyProfile,
  logLeadError,
} from '@/services/firebaseService';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUOTE DATA TYPE (populated by /api/get-estimate)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface BoundingBox {
  sw: { latitude: number; longitude: number };
  ne: { latitude: number; longitude: number };
}

export interface QuoteData {
  groundFloorSqFt: number;
  estimatedRoofSqFt: number;
  squares: number;
  pricingMatrix: {
    [material: string]: {
      [tier: string]: { min: number; max: number };
    };
  };
  solarDataStatus: string;
  /** Requester's IP address, extracted server-side and returned in the response. */
  ipAddress?: string;
  /** Pitch of the primary roof segment in degrees. Null when Solar API fails. */
  roofPitchDegrees?: number | null;
  /** Whole-roof area in roofing squares (sq ft ÷ 100). Null when Solar API fails. */
  roofAreaSquares?: number | null;
  /** Bounding box of the primary roof segment (sw/ne lat-lng). Null when Solar API fails. */
  boundingBox?: BoundingBox | null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEATURE FLAGS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ENABLE_GHOST_CAPTURE = true;

/**
 * Human-readable label for each physical step index.
 * Used by the drop-off tracker to write lastStepCompleted to Firestore.
 */
export const STEP_LABELS: Record<number, string> = {
  0:  'Address Entry',
  1:  'Roof Verification',
  2:  'Roof Type',
  3:  'Flat Roof Details',
  4:  'Metal Roof Details',
  5:  'Pitch',
  6:  'Stories',
  7:  'Issues',
  8:  'Timeline',
  10: 'Lead Capture',
  11: 'Results',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOMAIN TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AddressData {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  fullAddress: string;
}

export type RoofCategory = 'asphalt' | 'flat' | 'metal' | 'not_sure';
export type RoofPitch = 'flat' | 'low' | 'steep';
export type Stories = '1' | '2' | '3+';
export type RoofIssue = 'leaking' | 'missing_shingles' | 'old_age' | 'new_construction';
export type Timeline = 'emergency' | '1-3months' | 'researching';

/** Flat-roof membrane material selected by the user on the Flat Details step. */
export type FlatMaterial = 'EPDM' | 'TPO' | 'Modified Bitumen';

/** Metal roof style selected by the user on the Metal Details step. */
export type MetalType = 'Standing Seam' | 'Corrugated (Tin)';

export interface PropertyDetails {
  roofCategory: RoofCategory | null;
  pitch: RoofPitch | null;
  stories: Stories | null;
  currentIssues: RoofIssue[];
  timeline: Timeline | null;
  /** Flat roofs only — membrane material. Null until answered (or if not flat). */
  flatMaterial: FlatMaterial | null;
  /** Flat roofs only — whether full re-decking is needed. Null until answered. */
  needsRedecking: boolean | null;
  /** Metal roofs only — panel style. No longer collected (Metal Details step removed). */
  metalType: MetalType | null;
}

export interface ContactInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface LeadData {
  addressData: AddressData | null;
  propertyDetails: PropertyDetails;
  contactInfo: ContactInfo;
  /**
   * Solar API outcome string. Possible values:
   *   'Success: High-Fidelity Data'
   *   'Failed: 404 No Coverage in Area'
   *   'Failed: 403 API Key/Billing Issue'
   *   'Failed: 400 Bad Request/Coordinates'
   *   'Failed: Network/Unknown Error'
   */
  solarDataStatus: string;
  /**
   * Interior square footage entered manually by the user when the Solar API
   * returns a "Failed:" status (no satellite coverage). Undefined until the
   * user submits the fallback input on Step 10. Once set, the Results page
   * recalculates the pricing matrix client-side using this value.
   */
  manualHomeSqFt?: number;
  /** Pitch of the primary roof segment in degrees, from solarPotential.roofSegmentStats[0]. */
  roofPitchDegrees?: number | null;
  /** Whole-roof area in roofing squares (areaMeters2 × 10.7639 ÷ 100). */
  roofAreaSquares?: number | null;
  /** Bounding box of the primary roof segment from solarPotential.roofSegmentStats[0]. */
  boundingBox?: BoundingBox | null;
}

export type Direction = 'forward' | 'backward';

export interface FunnelState {
  currentStep: number;
  direction: Direction;
  leadData: LeadData;
  isSubmitting: boolean;
  isCalculating: boolean;
  quoteData: QuoteData | null;
  firebaseDocId: string | null;
  typeCastF: string;
  /** Mirrors companies/C_0001.enableGhostWrites. Default true until profile loads. */
  enableGhostWrites: boolean;
  /** Mirrors companies/C_0001.captureAdvancedSolarData. Default false until profile loads. */
  captureAdvancedSolarData: boolean;
  /** Mirrors companies/C_0001.allowedStates. Default ['NC'] until profile loads. */
  allowedStates: string[];
  /** Mirrors companies/C_0001.showPhoneButton. Default false until profile loads. */
  showPhoneButton: boolean;
  /** Mirrors companies/C_0001.phoneF. Display-formatted phone number. Default '' until profile loads. */
  phoneF: string;
  /** Mirrors companies/C_0001.calendlyUrl. Empty string hides the Calendly widget. Default '' until profile loads. */
  calendlyUrl: string;
  /** Mirrors companies/C_0001.showPromoBanner. Default false until profile loads. */
  showPromoBanner: boolean;
  /** Mirrors companies/C_0001.promoBannerText. Empty string hides the banner. Default '' until profile loads. */
  promoBannerText: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP SEQUENCE ROUTING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Physical step indices (0-based), matching QuoteFunnel's renderStep switch:
 *
 *   0  Address        6  Stories
 *   1  Verification   7  Issues
 *   2  Roof Type      8  Timeline
 *   3  Flat Details  10  Lead Capture
 *   4  Metal Details 11  Results
 *   5  Pitch
 *
 * Step 9 (Financing) has been removed from the funnel entirely.
 * Each roof category visits a different subset of these indices.
 */
export function getStepSequence(roofCategory: RoofCategory | null): readonly number[] {
  switch (roofCategory) {
    case 'flat':
      // Skip Pitch (5) and Metal Details (4); skip Financing (9) — removed
      return [0, 1, 2, 3, 6, 7, 8, 10, 11];
    case 'metal':
    case 'not_sure':
    case 'asphalt':
    default:
      // Skip Flat Details (3), Metal Details (4), and Financing (9) — removed
      return [0, 1, 2, 5, 6, 7, 8, 10, 11];
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INITIAL STATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const INITIAL_STATE: FunnelState = {
  currentStep: 0,
  direction: 'forward',
  isSubmitting: false,
  isCalculating: false,
  quoteData: null,
  firebaseDocId: null,
  typeCastF: '',
  enableGhostWrites: true,
  captureAdvancedSolarData: false,
  allowedStates: ['NC'],
  showPhoneButton: false,
  phoneF: '',
  calendlyUrl: '',
  showPromoBanner: false,
  promoBannerText: '',
  leadData: {
    addressData: null,
    propertyDetails: {
      roofCategory: null,
      pitch: null,
      stories: null,
      currentIssues: [],
      timeline: null,
      flatMaterial: null,
      needsRedecking: null,
      metalType: null,
    },
    contactInfo: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    },
    solarDataStatus: 'pending',
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REDUCER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Action =
  | { type: 'GO_FORWARD' }
  | { type: 'GO_BACKWARD' }
  | { type: 'GO_TO_STEP'; payload: number }
  | { type: 'SET_ADDRESS'; payload: AddressData }
  | { type: 'UPDATE_PROPERTY'; payload: Partial<PropertyDetails> }
  | { type: 'UPDATE_CONTACT'; payload: Partial<ContactInfo> }
  | { type: 'SET_SUBMITTING'; payload: boolean }
  | { type: 'SET_IS_CALCULATING'; payload: boolean }
  | { type: 'SET_QUOTE_DATA'; payload: QuoteData }
  | { type: 'SET_FIREBASE_DOC_ID'; payload: string }
  | { type: 'SET_TYPE_CAST_F'; payload: string }
  | { type: 'SET_SOLAR_STATUS'; payload: string }
  | { type: 'SET_MANUAL_HOME_SQ_FT'; payload: number }
  | { type: 'SET_ENABLE_GHOST_WRITES'; payload: boolean }
  | { type: 'SET_CAPTURE_ADVANCED_SOLAR_DATA'; payload: boolean }
  | { type: 'SET_ALLOWED_STATES'; payload: string[] }
  | { type: 'SET_SHOW_PHONE_BUTTON'; payload: boolean }
  | { type: 'SET_PHONE_F'; payload: string }
  | { type: 'SET_CALENDLY_URL'; payload: string }
  | { type: 'SET_SHOW_PROMO_BANNER'; payload: boolean }
  | { type: 'SET_PROMO_BANNER_TEXT'; payload: string }
  | {
      type: 'SET_SOLAR_DETAILS';
      payload: {
        roofPitchDegrees?: number | null;
        roofAreaSquares?: number | null;
        boundingBox?: BoundingBox | null;
      };
    };

function funnelReducer(state: FunnelState, action: Action): FunnelState {
  switch (action.type) {
    case 'GO_FORWARD': {
      const seq = getStepSequence(state.leadData.propertyDetails.roofCategory);
      const idx = seq.indexOf(state.currentStep);
      const next = idx !== -1 && idx < seq.length - 1 ? seq[idx + 1] : state.currentStep;
      return { ...state, direction: 'forward', currentStep: next };
    }

    case 'GO_BACKWARD': {
      const seq = getStepSequence(state.leadData.propertyDetails.roofCategory);
      const idx = seq.indexOf(state.currentStep);
      const prev = idx > 0 ? seq[idx - 1] : state.currentStep;
      return { ...state, direction: 'backward', currentStep: prev };
    }

    case 'GO_TO_STEP':
      return {
        ...state,
        direction: action.payload > state.currentStep ? 'forward' : 'backward',
        currentStep: Math.max(0, Math.min(action.payload, 11)),
      };

    case 'SET_ADDRESS':
      return {
        ...state,
        leadData: { ...state.leadData, addressData: action.payload },
      };

    case 'UPDATE_PROPERTY':
      return {
        ...state,
        leadData: {
          ...state.leadData,
          propertyDetails: {
            ...state.leadData.propertyDetails,
            ...action.payload,
          },
        },
      };

    case 'UPDATE_CONTACT':
      return {
        ...state,
        leadData: {
          ...state.leadData,
          contactInfo: { ...state.leadData.contactInfo, ...action.payload },
        },
      };

    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.payload };

    case 'SET_IS_CALCULATING':
      return { ...state, isCalculating: action.payload };

    case 'SET_QUOTE_DATA':
      return { ...state, quoteData: action.payload };

    case 'SET_FIREBASE_DOC_ID':
      return { ...state, firebaseDocId: action.payload };

    case 'SET_TYPE_CAST_F':
      return { ...state, typeCastF: action.payload };

    case 'SET_SOLAR_STATUS':
      return {
        ...state,
        leadData: { ...state.leadData, solarDataStatus: action.payload },
      };

    case 'SET_MANUAL_HOME_SQ_FT':
      return {
        ...state,
        leadData: { ...state.leadData, manualHomeSqFt: action.payload },
      };

    case 'SET_ENABLE_GHOST_WRITES':
      return { ...state, enableGhostWrites: action.payload };

    case 'SET_CAPTURE_ADVANCED_SOLAR_DATA':
      return { ...state, captureAdvancedSolarData: action.payload };

    case 'SET_ALLOWED_STATES':
      return { ...state, allowedStates: action.payload };

    case 'SET_SHOW_PHONE_BUTTON':
      return { ...state, showPhoneButton: action.payload };

    case 'SET_PHONE_F':
      return { ...state, phoneF: action.payload };

    case 'SET_CALENDLY_URL':
      return { ...state, calendlyUrl: action.payload };

    case 'SET_SHOW_PROMO_BANNER':
      return { ...state, showPromoBanner: action.payload };

    case 'SET_PROMO_BANNER_TEXT':
      return { ...state, promoBannerText: action.payload };

    case 'SET_SOLAR_DETAILS':
      return {
        ...state,
        leadData: { ...state.leadData, ...action.payload },
      };

    default:
      return state;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROGRESS CALCULATOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function calculateProgress(leadData: LeadData): number {
  const p = leadData.propertyDetails;
  const c = leadData.contactInfo;

  const checks: boolean[] = [
    !!leadData.addressData?.fullAddress,
    !!p.roofCategory,
    // Flat sub-details count when the roof is flat
    p.roofCategory !== 'flat' || p.flatMaterial !== null,
    p.roofCategory !== 'flat' || p.needsRedecking !== null,
    // Pitch counts for non-flat roofs
    p.roofCategory === 'flat' || !!p.pitch,
    !!p.stories,
    p.currentIssues.length > 0,
    !!p.timeline,
    !!c.firstName,
    !!c.email,
    !!c.phone,
  ];

  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function validateStep(step: number, leadData: LeadData): boolean {
  const p = leadData.propertyDetails;
  const c = leadData.contactInfo;

  const rules: Record<number, boolean> = {
    0:  !!leadData.addressData?.fullAddress,
    1:  !!leadData.addressData?.fullAddress,
    2:  !!p.roofCategory,
    // Step 3 (Flat Details): both questions answered (any value including null="Not Sure")
    3:  p.flatMaterial !== null || p.needsRedecking !== null,
    // Step 4 (Metal Details): metalType answered
    4:  p.metalType !== null,
    5:  !!p.pitch,
    6:  !!p.stories,
    7:  p.currentIssues.length > 0,
    8:  !!p.timeline,
    10: !!(c.firstName && c.lastName && c.email && c.phone),
    11: true,
  };

  return rules[step] ?? false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOOK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useFunnelStore() {
  const [state, dispatch] = useReducer(funnelReducer, INITIAL_STATE);

  const goForward  = useCallback(() => dispatch({ type: 'GO_FORWARD' }), []);
  const goBackward = useCallback(() => dispatch({ type: 'GO_BACKWARD' }), []);
  const goToStep   = useCallback(
    (step: number) => dispatch({ type: 'GO_TO_STEP', payload: step }),
    []
  );

  const updateAddress = useCallback(
    (data: AddressData) => dispatch({ type: 'SET_ADDRESS', payload: data }),
    []
  );

  const updatePropertyDetails = useCallback(
    (updates: Partial<PropertyDetails>) =>
      dispatch({ type: 'UPDATE_PROPERTY', payload: updates }),
    []
  );

  const updateContactInfo = useCallback(
    (updates: Partial<ContactInfo>) =>
      dispatch({ type: 'UPDATE_CONTACT', payload: updates }),
    []
  );

  const setSubmitting = useCallback(
    (submitting: boolean) => dispatch({ type: 'SET_SUBMITTING', payload: submitting }),
    []
  );

  const setFirebaseDocId = useCallback(
    (id: string) => dispatch({ type: 'SET_FIREBASE_DOC_ID', payload: id }),
    []
  );

  const setTypeCastF = useCallback(
    (text: string) => dispatch({ type: 'SET_TYPE_CAST_F', payload: text }),
    []
  );

  /**
   * setManualHomeSqFt — Commits the user-entered interior square footage into
   * the store. This immediately triggers a re-render of Step10_Results, which
   * uses the value to scale the fallback pricing matrix client-side.
   *
   * @param sqFt - Interior square footage as entered by the user (positive integer)
   */
  const setManualHomeSqFt = useCallback(
    (sqFt: number) => dispatch({ type: 'SET_MANUAL_HOME_SQ_FT', payload: sqFt }),
    []
  );

  /**
   * saveManualSqFtToDb — Persists the manual square footage to the existing
   * funnel_damon Firestore document so the sales team has accurate property
   * data even when the Solar API could not provide satellite coverage.
   *
   * This is a fire-and-forget write — it does not block the UI update.
   * Failures are logged as warnings but do not surface to the user, since
   * the client-side pricing recalculation has already happened synchronously.
   *
   * @param sqFt - Interior square footage to write to Firestore
   */
  const saveManualSqFtToDb = useCallback(async (sqFt: number): Promise<void> => {
    const docId = state.firebaseDocId;
    if (!docId) {
      console.warn('[ManualSqFt] No firebaseDocId in state — skipping Firestore write');
      return;
    }
    try {
      const result = await syncLeadToDatabase({ manualHomeSqFt: sqFt }, docId);
      if (!result.success) {
        console.warn('[ManualSqFt] Firestore write returned failure:', result.error);
      } else {
        console.log(`[ManualSqFt] Saved manualHomeSqFt=${sqFt} → funnel_damon/${docId}`);
      }
    } catch (err) {
      console.warn('[ManualSqFt] Firestore write threw unexpectedly:', err);
    }
  }, [state.firebaseDocId]);

  /**
   * fetchEstimate — Calls /api/get-estimate and updates the store.
   *
   * @param address  - Geocoded address data from Step01.
   * @param docId    - Optional explicit docId to send to the server. Use this
   *                   to bypass the stale `state.firebaseDocId` closure when
   *                   the docId was just resolved from an async write.
   *                   Falls back to state.firebaseDocId when omitted.
   */
  const fetchEstimate = useCallback(async (address: AddressData, docId?: string | null) => {
    // Caller can pass the just-resolved docId directly to avoid stale closure.
    const resolvedDocId = docId !== undefined ? docId : state.firebaseDocId;
    dispatch({ type: 'SET_IS_CALCULATING', payload: true });

    try {
      const res = await fetch('/api/get-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address.fullAddress,
          lat: address.lat,
          lng: address.lng,
          firebaseDocId: resolvedDocId ?? null,
          captureAdvancedSolarData: state.captureAdvancedSolarData,
        }),
      });

      if (res.status === 429) {
        dispatch({ type: 'SET_SOLAR_STATUS', payload: 'Failed: Rate Limited' });
        return;
      }

      if (!res.ok) throw new Error(`/api/get-estimate returned ${res.status}`);

      const data: QuoteData = await res.json();

      dispatch({ type: 'SET_QUOTE_DATA', payload: data });
      dispatch({ type: 'SET_SOLAR_STATUS', payload: data.solarDataStatus });

      // Store granular Solar fields in leadData so they are included in the
      // final submission blob written by syncToFirebase on Step09.
      if (data.roofPitchDegrees != null || data.roofAreaSquares != null || data.boundingBox != null) {
        dispatch({
          type: 'SET_SOLAR_DETAILS',
          payload: {
            roofPitchDegrees: data.roofPitchDegrees ?? null,
            roofAreaSquares:  data.roofAreaSquares  ?? null,
            boundingBox:      data.boundingBox      ?? null,
          },
        });
      }

      // Persist solarDataStatus, IP, and granular Solar fields to the user's
      // Firestore doc in one write, regardless of Solar API success or failure.
      if (resolvedDocId) {
        syncLeadToDatabase(
          {
            solarDataStatus: data.solarDataStatus,
            ...(data.ipAddress          != null ? { ipAddress:         data.ipAddress          } : {}),
            ...(data.roofPitchDegrees   != null ? { roofPitchDegrees:  data.roofPitchDegrees   } : {}),
            ...(data.roofAreaSquares    != null ? { roofAreaSquares:   data.roofAreaSquares    } : {}),
            ...(data.boundingBox        != null ? { boundingBox:       data.boundingBox        } : {}),
          },
          resolvedDocId
        ).catch((err) =>
          console.warn('[fetchEstimate] Failed to persist Solar details to Firestore:', err)
        );
      }
    } catch (err) {
      const status = 'Failed: Network/Unknown Error';
      dispatch({ type: 'SET_SOLAR_STATUS', payload: status });
      console.warn('[SolarAPI] fetchEstimate network error — using baseline pricing:', err);
    } finally {
      dispatch({ type: 'SET_IS_CALCULATING', payload: false });
    }
  }, [state.firebaseDocId, state.captureAdvancedSolarData]);

  /**
   * fetchProfile — Loads companies/C_0001 once on mount.
   * Updates the module-level ghost-write flag in firebaseService AND mirrors
   * the value into state so components can read it if needed.
   *
   * Call this once from QuoteFunnel (or wherever the funnel is bootstrapped):
   *   useEffect(() => { store.fetchProfile(); }, []);
   */
  /**
   * logError — Writes a systemError field to the lead's funnel_damon document
   * so the sales team can see exactly what failed and follow up manually.
   * No-ops silently if firebaseDocId is not yet set.
   */
  const logError = useCallback(async (errorString: string): Promise<void> => {
    const docId = state.firebaseDocId;
    if (!docId) {
      console.warn('[logError] No firebaseDocId in state — cannot log error to Firestore');
      return;
    }
    await logLeadError(docId, errorString);
  }, [state.firebaseDocId]);

  const fetchProfile = useCallback(async () => {
    const result = await fetchCompanyProfile();
    if (!result.success || !result.data) return;

    const enabled = result.data.enableGhostWrites ?? true;
    setGhostWritesEnabled(enabled);
    dispatch({ type: 'SET_ENABLE_GHOST_WRITES', payload: enabled });

    const captureAdvanced = result.data.captureAdvancedSolarData ?? false;
    dispatch({ type: 'SET_CAPTURE_ADVANCED_SOLAR_DATA', payload: captureAdvanced });

    const allowedStates = result.data.allowedStates ?? ['NC'];
    dispatch({ type: 'SET_ALLOWED_STATES', payload: allowedStates });

    const showPhoneButton = result.data.showPhoneButton ?? false;
    dispatch({ type: 'SET_SHOW_PHONE_BUTTON', payload: showPhoneButton });

    dispatch({ type: 'SET_PHONE_F', payload: result.data.phoneF ?? '' });
    dispatch({ type: 'SET_CALENDLY_URL', payload: result.data.calendlyUrl ?? '' });
    dispatch({ type: 'SET_SHOW_PROMO_BANNER', payload: result.data.showPromoBanner ?? false });
    dispatch({ type: 'SET_PROMO_BANNER_TEXT', payload: result.data.promoBannerText ?? '' });
  }, []);

  const progress = calculateProgress(state.leadData);

  // Visual step position and total within the active path sequence
  const seq         = getStepSequence(state.leadData.propertyDetails.roofCategory);
  const visualStep  = Math.max(1, seq.indexOf(state.currentStep) + 1);
  const visualTotal = seq.length;

  // ── Drop-off tracker ─────────────────────────────────────────────────────
  // Fires whenever currentStep OR firebaseDocId changes. Writes
  // lastStepCompleted to the funnel_damon doc so the CRM knows exactly where
  // each session abandoned the funnel.
  //
  // lastTrackedStep guards against writing the same step twice — which can
  // happen when docId arrives after the step has already been set (e.g. the
  // user is on step 1 before the addDoc round-trip completes).
  const lastTrackedStep = useRef<number | null>(null);

  useEffect(() => {
    const docId = state.firebaseDocId;
    const step  = state.currentStep;

    if (!docId) return; // doc not created yet; write will happen once docId arrives
    if (lastTrackedStep.current === step) return; // already wrote this step

    lastTrackedStep.current = step;
    const stepName = STEP_LABELS[step] ?? `Step ${step}`;

    syncLeadToDatabase({ lastStepCompleted: stepName }, docId).catch((err) =>
      console.warn('[StepTracker] Failed to write lastStepCompleted:', err)
    );
  }, [state.currentStep, state.firebaseDocId]);

  return {
    state,
    progress,
    visualStep,
    visualTotal,
    goForward,
    goBackward,
    goToStep,
    updateAddress,
    updatePropertyDetails,
    updateContactInfo,
    setSubmitting,
    setFirebaseDocId,
    setTypeCastF,
    setManualHomeSqFt,
    saveManualSqFtToDb,
    fetchEstimate,
    fetchProfile,
    logError,
  };
}

export type FunnelStore = ReturnType<typeof useFunnelStore>;
