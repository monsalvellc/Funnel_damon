'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, CheckCircle, ArrowRight, Loader2, Star } from 'lucide-react';
import type { FunnelStore, AddressData } from '@/hooks/useFunnelStore';
import { ENABLE_GHOST_CAPTURE } from '@/hooks/useFunnelStore';
import { syncLeadToDatabase } from '@/services/firebaseService';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GOOGLE MAPS PLACES V2 TYPE SHIMS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Minimal shims for the new Places API (google.maps.places.AutocompleteSuggestion).
 * Replaces the deprecated AutocompleteService (removed for new API keys March 2025).
 * For full type safety install: npm i -D @types/google.maps
 */

/** FormattableText — the .text property holds the plain string. */
interface GmapsFormattableText {
  text: string;
}

/** Split display text: bold "main" line + muted "secondary" line. */
interface GmapsStructuredFormat {
  mainText: GmapsFormattableText;
  secondaryText: GmapsFormattableText;
}

/** New Places V2 address component — longText/shortText replace long_name/short_name. */
interface GmapsAddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

/**
 * Place object returned by PlacePrediction.toPlace() after fetchFields().
 * Only fields requested in fetchFields are populated.
 */
interface GmapsPlace {
  formattedAddress?: string;
  location?: { lat(): number; lng(): number };
  addressComponents?: GmapsAddressComponent[];
  fetchFields(opts: { fields: string[] }): Promise<{ place: GmapsPlace }>;
}

/** A single autocomplete candidate — only placePrediction entries are used (not queryPrediction). */
interface PlacePrediction {
  placeId: string;
  text: GmapsFormattableText;
  structuredFormat: GmapsStructuredFormat;
  /** Creates a Place shell that can be hydrated via fetchFields(). */
  toPlace(): GmapsPlace;
}

interface GmapsAutocompleteSuggestion {
  placePrediction: PlacePrediction | null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Returns true only when the first 8 chars of `text` contain at least one digit. */
function hasHouseNumber(text: string): boolean {
  return /\d/.test(text.slice(0, 8));
}

function getComp(
  comps: GmapsAddressComponent[],
  type: string,
  short = false
): string {
  const c = comps.find((comp) => comp.types.includes(type));
  return c ? (short ? c.shortText : c.longText) : '';
}

/**
 * Maps a PlacePrediction + hydrated Place to the internal AddressData shape.
 *
 * V2 component keys differ from the old Geocoder response:
 *   longText  ← was long_name
 *   shortText ← was short_name
 *   addressComponents ← was address_components (on the Place object)
 *   location  ← was geometry.location (LatLng with .lat()/.lng() methods)
 */
function buildAddressData(pred: PlacePrediction, place: GmapsPlace): AddressData {
  const comps = place.addressComponents ?? [];
  const street = [
    getComp(comps, 'street_number'),
    getComp(comps, 'route'),
  ].filter(Boolean).join(' ') || pred.structuredFormat.mainText.text;

  return {
    fullAddress: place.formattedAddress || pred.text.text,
    street,
    city:
      getComp(comps, 'locality') ||
      getComp(comps, 'sublocality') ||
      getComp(comps, 'sublocality_level_1'),
    state: getComp(comps, 'administrative_area_level_1', true),
    zip:   getComp(comps, 'postal_code'),
    lat:   place.location?.lat() ?? 0,
    lng:   place.location?.lng() ?? 0,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Props {
  store: FunnelStore;
}

/**
 * Step01_Address — Hero / Gatekeeper step with Google Places V2 autocomplete.
 *
 * API upgrade (March 2025):
 *   Old: new AutocompleteService() + Geocoder.geocode({ placeId })
 *   New: AutocompleteSuggestion.fetchAutocompleteSuggestions() (static, async)
 *        + placePrediction.toPlace() + place.fetchFields() for lat/lng
 *
 * Session tokens: created on first keystroke, cleared after place selection.
 * This groups autocomplete + detail requests into one billed session.
 *
 * Script loading:
 *   layout.tsx loads the Maps JS API with &v=beta&libraries=places via
 *   next/script strategy="afterInteractive". The v=beta channel is required
 *   for AutocompleteSuggestion. This component polls window.google.maps.places
 *   every 100ms until the API is ready.
 *
 * handleAdvance — shared by CTA button and Enter key — three paths:
 *   1. selected (already geocoded)    → commit directly.
 *   2. suggestions available          → fetch details for top result, then commit.
 *   3. Free-form text, no suggestions → commit with lat: 0, lng: 0 (Solar fallback).
 */
export default function Step01_Address({ store }: Props) {
  const { goForward, updateAddress, setFirebaseDocId, setTypeCastF } = store;

  const [query,        setQuery]        = useState('');
  const [suggestions,  setSuggestions]  = useState<GmapsAutocompleteSuggestion[]>([]);
  const [selected,     setSelected]     = useState<AddressData | null>(null);
  const [isFocused,    setIsFocused]    = useState(false);
  const [isGeocoding,  setIsGeocoding]  = useState(false);
  const [mapsReady,    setMapsReady]    = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [geoError,     setGeoError]     = useState<string | null>(null);

  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /**
   * AutocompleteSessionToken — groups autocomplete + detail fetches into one
   * billing session. Created on first keystroke, cleared after place selection.
   * No equivalent of the old autocompleteRef/geocoderRef needed — both
   * AutocompleteSuggestion (static method) and toPlace/fetchFields are instance-free.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionTokenRef = useRef<any>(null);

  const ghostTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronous mirror of firebaseDocId — avoids stale-closure reads across async gaps.
  // Updated immediately when any write resolves a new docId.
  const localDocIdRef = useRef<string | null>(null);

  // Holds the Promise of any in-flight ghost write so handleCommitAddress can
  // await it before firing the commit write, preventing a second addDoc call.
  const ghostWritePromise = useRef<Promise<void> | null>(null);

  // ── Detect when the Maps API (v=beta) is ready ────────────────────────────
  useEffect(() => {
    function check() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return !!(window as any).google?.maps?.places?.AutocompleteSuggestion;
    }

    if (check()) { setMapsReady(true); return; }

    const interval = setInterval(() => {
      if (check()) { clearInterval(interval); setMapsReady(true); }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // ── Auto-focus after mount animation ──────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  // ── Cleanup debounce timers on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      if (ghostTimerRef.current)  clearTimeout(ghostTimerRef.current);
      if (placesTimerRef.current) clearTimeout(placesTimerRef.current);
    };
  }, []);

  // ── Close dropdown on outside click ───────────────────────────────────────
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current    && !inputRef.current.contains(e.target as Node)
      ) {
        setSuggestions([]);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // ── handleChange ──────────────────────────────────────────────────────────
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      setSelected(null);
      setAddressError(null);
      setGeoError(null);

      // ── Places autocomplete (300ms debounce) ──
      if (placesTimerRef.current) clearTimeout(placesTimerRef.current);

      if (val.length < 3 || !mapsReady) {
        setSuggestions([]);
      } else {
        placesTimerRef.current = setTimeout(() => {
          (async () => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const g = (window as any).google;

              // Create session token on first keystroke of a new session
              if (!sessionTokenRef.current) {
                sessionTokenRef.current = new g.maps.places.AutocompleteSessionToken();
              }

              const { suggestions: raw } =
                await g.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                  input: val,
                  sessionToken: sessionTokenRef.current,
                  includedRegionCodes: ['us'],
                });

              // Keep only place predictions (filter out query predictions)
              const filtered = (raw as GmapsAutocompleteSuggestion[])
                .filter((s) => s.placePrediction != null)
                .slice(0, 5);

              setSuggestions(filtered);
            } catch {
              setSuggestions([]);
            }
          })();
        }, 300);
      }

      // ── Ghost lead write (1-second debounce) ──
      if (!ENABLE_GHOST_CAPTURE || !val.trim()) return;

      if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);

      ghostTimerRef.current = setTimeout(() => {
        const typeCastF = val.slice(0, 50);
        setTypeCastF(typeCastF);

        // Store the promise so handleCommitAddress can await it if needed.
        ghostWritePromise.current = (async () => {
          console.log(
            `[Step01_Address] Ghost write — typeCastF: "${typeCastF}", docId: ${localDocIdRef.current ?? '(new)'}`
          );

          const result = await syncLeadToDatabase({ typeCastF }, localDocIdRef.current);

          if (result.success && result.docId && !localDocIdRef.current) {
            localDocIdRef.current = result.docId;   // update ref synchronously
            setFirebaseDocId(result.docId);           // update React state
            console.log(`[Step01_Address] Session document created — ID: ${result.docId}`);
          } else if (!result.success) {
            console.warn('[Step01_Address] Ghost write failed:', result.error);
          }

          ghostWritePromise.current = null;
        })();
      }, 1000);
    },
    [mapsReady, setFirebaseDocId, setTypeCastF]
  );

  // ── handleCommitAddress ───────────────────────────────────────────────────
  const handleCommitAddress = useCallback(
    async (address: AddressData) => {
      // ── Geographic restriction check ───────────────────────────────────────
      const { allowedStates } = store.state;
      if (!allowedStates.includes('ALL') && address.state && !allowedStates.includes(address.state)) {
        setGeoError(
          `Sorry, we currently only service properties within: ${allowedStates.join(', ')}`
        );
        setSelected(null);
        return;
      }
      setGeoError(null);

      // Cancel any pending debounced ghost write (hasn't started yet).
      if (ghostTimerRef.current) {
        clearTimeout(ghostTimerRef.current);
        ghostTimerRef.current = null;
      }

      setSelected(address);
      setQuery(address.fullAddress);
      setSuggestions([]);
      setAddressError(null);
      updateAddress(address);

      if (ENABLE_GHOST_CAPTURE) {
        // If a ghost write is already in-flight, wait for it to finish so we
        // capture its docId before issuing the commit write. This prevents a
        // second addDoc call when the ghost write started but React state hasn't
        // updated yet (the duplicate-document race condition).
        if (ghostWritePromise.current) {
          await ghostWritePromise.current;
          ghostWritePromise.current = null;
        }

        console.log(
          `[Step01_Address] Address committed — writing addressF, docId: ${localDocIdRef.current ?? '(new)'}`
        );

        const result = await syncLeadToDatabase(
          { addressF: address.fullAddress },
          localDocIdRef.current          // ref is always current; state may be stale
        );

        if (result.success && result.docId && !localDocIdRef.current) {
          localDocIdRef.current = result.docId;
          setFirebaseDocId(result.docId);
          console.log(`[Step01_Address] Session document created on commit — ID: ${result.docId}`);
        }
      }

      setTimeout(() => goForward(), 350);
    },
    [store.state.allowedStates, updateAddress, setFirebaseDocId, goForward]
  );

  // ── handleSelectSuggestion ────────────────────────────────────────────────
  /**
   * Called when the user clicks a dropdown item.
   * Uses the V2 pattern: placePrediction.toPlace() + place.fetchFields()
   * instead of the old Geocoder.geocode({ placeId }) callback.
   *
   * Session token is cleared after fetchFields so the billing session closes.
   */
  const handleSelectSuggestion = useCallback(
    async (suggestion: GmapsAutocompleteSuggestion) => {
      if (!suggestion.placePrediction) return;
      const pred = suggestion.placePrediction;

      // Bouncer: reject city/zip selections that have no house number.
      const mainText = pred.structuredFormat?.mainText?.text || pred.text?.text || '';
      if (!hasHouseNumber(mainText)) {
        setQuery('');
        setSelected(null);
        setSuggestions([]);
        setAddressError('Please select a valid address.');
        return;
      }

      setQuery(pred.text.text);
      setSuggestions([]);
      setIsGeocoding(true);

      try {
        const place = pred.toPlace();
        await place.fetchFields({
          fields: ['formattedAddress', 'location', 'addressComponents'],
        });

        // Close the billing session after the detail fetch
        sessionTokenRef.current = null;

        await handleCommitAddress(buildAddressData(pred, place));
      } catch {
        // fetchFields failed — commit with text only, Solar API uses fallback area
        sessionTokenRef.current = null;
        await handleCommitAddress({
          fullAddress: pred.text?.text || pred.structuredFormat?.mainText?.text || query,
          street:      pred.structuredFormat?.mainText?.text || pred.text?.text || query,
          city: '', state: '', zip: '',
          lat: 0, lng: 0,
        });
      } finally {
        setIsGeocoding(false);
      }
    },
    [handleCommitAddress]
  );

  // ── handleAdvance ─────────────────────────────────────────────────────────
  const handleAdvance = useCallback(() => {
    if (!selected || isGeocoding) return;
    setAddressError(null);
    handleCommitAddress(selected);
  }, [selected, isGeocoding, handleCommitAddress]);

  const showDropdown = isFocused && suggestions.length > 0 && !isGeocoding;
  const canAdvance   = selected !== null && !isGeocoding;

  return (
    <div className="step-scroll flex flex-col min-h-dvh">
      <div className="flex-1 flex flex-col items-center justify-start px-5 pt-6 pb-16 text-center relative">

        {/* Trust badge */}
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8 animate-fade-in">
          <CheckCircle size={14} className="text-orange-400" />
          <span className="text-white/80 text-xs font-semibold tracking-wide uppercase">
            Free Estimate · No Obligation · 60 Seconds
          </span>
        </div>

        {/* Headline */}
        <h1
          className="text-white font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-tight mb-4 animate-fade-in"
          style={{ animationDelay: '80ms' }}
        >
          Get Your Free<br />
          <span className="text-orange-400">Roof Estimate</span><br />
          Instantly
        </h1>

        <p
          className="text-white/60 text-base sm:text-lg max-w-sm mb-10 leading-relaxed animate-fade-in"
          style={{ animationDelay: '160ms' }}
        >
          See accurate pricing for your home in under 60 seconds — no contractors, no pressure.
        </p>

        {/* Address input */}
        <div className="w-full max-w-md animate-fade-in" style={{ animationDelay: '240ms' }}>
          <div className="relative">
            <div
              className={`
                flex items-center gap-3 bg-white rounded-2xl px-4 py-4 shadow-2xl
                transition-all duration-200
                ${isFocused ? 'ring-2 ring-orange-400 shadow-card-glow' : 'ring-1 ring-slate-200'}
              `}
            >
              {/* Leading icon — spinner while geocoding, check when selected, pin otherwise */}
              {isGeocoding ? (
                <Loader2 size={22} className="text-orange-400 flex-shrink-0 animate-spin" />
              ) : selected ? (
                <CheckCircle size={22} className="text-green-500 flex-shrink-0" />
              ) : (
                <MapPin
                  size={22}
                  className={`flex-shrink-0 transition-colors ${isFocused ? 'text-orange-500' : 'text-slate-400'}`}
                />
              )}

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdvance();
                  }
                }}
                placeholder="Enter your home address..."
                className="flex-1 bg-transparent outline-none text-slate-800 font-medium text-base placeholder:text-slate-400"
                autoComplete="off"
                aria-label="Home address"
                aria-autocomplete="list"
                aria-expanded={showDropdown}
                disabled={isGeocoding}
              />

              {query.length > 0 && !isGeocoding && (
                <button
                  onClick={() => {
                    setQuery('');
                    setSelected(null);
                    setSuggestions([]);
                    sessionTokenRef.current = null;
                    inputRef.current?.focus();
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                  aria-label="Clear address"
                >
                  ×
                </button>
              )}
            </div>

            {/* Autocomplete dropdown */}
            {showDropdown && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-40"
                role="listbox"
              >
                {suggestions.map((sug, i) => (
                  <button
                    key={sug.placePrediction?.placeId ?? i}
                    role="option"
                    aria-selected={false}
                    onMouseDown={() => handleSelectSuggestion(sug)}
                    className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-orange-50 transition-colors text-left border-b border-slate-50 last:border-0 min-h-[52px]"
                  >
                    <MapPin size={16} className="text-orange-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-slate-800 font-semibold text-sm truncate">
                        {sug.placePrediction?.structuredFormat?.mainText?.text ||
                         sug.placePrediction?.text?.text ||
                         'Unknown address'}
                      </div>
                      <div className="text-slate-500 text-xs truncate">
                        {sug.placePrediction?.structuredFormat?.secondaryText?.text || ''}
                      </div>
                    </div>
                  </button>
                ))}
                {/* Required attribution per Google Maps Platform ToS */}
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5">
                  <span className="text-slate-400 text-xs">Powered by</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3_hdpi.png"
                    alt="Powered by Google"
                    className="h-3.5 w-auto"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Validation error — no valid selection */}
          {addressError && (
            <p className="text-red-400 text-sm mt-2 text-left font-medium">
              {addressError}
            </p>
          )}

          {/* Geo restriction error — out-of-service-area address */}
          {geoError && (
            <p className="text-red-400 text-sm mt-2 text-left font-medium">
              {geoError}
            </p>
          )}

          {/* CTA button */}
          <button
            onClick={handleAdvance}
            disabled={!canAdvance}
            className={`
              mt-3 w-full min-h-[56px] rounded-2xl
              flex items-center justify-center gap-3
              font-extrabold text-lg tracking-wide
              transition-all duration-200
              ${canAdvance
                ? 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white shadow-xl hover:shadow-2xl active:scale-[0.98]'
                : 'bg-white/10 text-white/30 cursor-not-allowed'}
            `}
            aria-label="Get my free estimate"
          >
            {isGeocoding ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Looking up address…
              </>
            ) : (
              <>
                Get My Free Estimate
                <ArrowRight size={20} />
              </>
            )}
          </button>

          <p className="text-white/40 text-xs mt-3 text-center">
            {canAdvance
              ? 'Press Enter or tap the button to continue'
              : 'Start typing your street address to see suggestions'}
          </p>
        </div>
        <WelcomeInfoPanel />
        <ReviewsPanel />
      </div>

      <p className="text-white/25 text-xs text-center pb-6 px-6">
        By continuing, you agree to be contacted by our certified roofing partners.
        Your information is never sold.
      </p>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INFO PANEL — Welcome & About Us
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function WelcomeInfoPanel() {
  return (
    <div 
      className="mt-12 mb-4 w-full max-w-xl mx-auto bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-xl border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_24px_rgba(0,0,0,0.25)] rounded-3xl relative overflow-hidden p-6 animate-fade-in"
      style={{ animationDelay: '350ms' }}
    >
      {/* Top-edge highlight line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-t-3xl" />

      {/* Section 1: Our Mission & The Tool */}
      <div className="mb-6">
        {/* Bumped to 17px */}
        <h3 className="text-white/40 text-[25px] font-semibold uppercase tracking-[0.15em] mb-3 ml-1">
          Why We Built This Tool
        </h3>
        <div className="bg-white/[0.05] border border-white/[0.10] rounded-2xl p-5">
          {/* Bumped to 21px */}
          <h4 className="text-white text-[21px] font-medium mb-3">
            Dear Homeowners,
          </h4>
          {/* Bumped to 19px */}
          <p className="text-white/60 text-[19px] leading-relaxed mb-4">
            We are Blue Hat Roofs, proudly based right here in Winston-Salem, North Carolina. For too long, the roofing industry has relied on confusing estimates and high-pressure sales tactics. Our goal is to completely change that by putting you back in control.
          </p>
          <p className="text-white/60 text-[19px] leading-relaxed">
            We built this tool because we believe you deserve upfront, honest pricing before a contractor ever steps foot on your driveway. By combining advanced satellite technology with our local roofing expertise, we give you the exact data you need to make the best decision for your home—with zero pressure.
          </p>
        </div>
      </div>

      {/* Section 2: Team Photos */}
      <div>
        <h3 className="text-white/40 text-sm font-semibold uppercase tracking-[0.15em] mb-3 ml-1">
          Meet The Team
        </h3>
        <div className="bg-white/[0.05] border border-white/[0.10] rounded-2xl p-5 flex justify-around items-center">
          
          {/* Team Member 1 */}
          <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-800 overflow-hidden mb-3 border-2 border-white/10">  
           <img 
                src="/team-1.jpg" 
                alt="Team member" 
                className="w-full h-full object-cover" 
                onError={(e) => { e.currentTarget.src = 'https://ui-avatars.com/api/?name=Blue+Hat&background=1e293b&color=fff' }}
              />
            </div>
            {/* Bumped names to text-base, titles to text-sm */}
            <div className="text-white/90 text-base font-medium">Juan Monsalve</div>
            <div className="text-white/40 text-sm">Lead Production</div>
          </div>

          {/* Team Member 2 */}
          <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-800 overflow-hidden mb-3 border-2 border-white/10">  
          <img 
                src="/team-2.jpg" 
                alt="Team member" 
                className="w-full h-full object-cover" 
                onError={(e) => { e.currentTarget.src = 'https://ui-avatars.com/api/?name=Blue+Hat&background=1e293b&color=fff' }}
              />
            </div>
            <div className="text-white/90 text-base font-medium">Ana  Acosta</div>
            <div className="text-white/40 text-sm">Office Director</div>
          </div>

          {/* Team Member 3 */}
          <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-800 overflow-hidden mb-3 border-2 border-white/10">  
          <img 
                src="/team-3.jpg" 
                alt="Team member" 
                className="w-full h-full object-cover" 
                onError={(e) => { e.currentTarget.src = 'https://ui-avatars.com/api/?name=Blue+Hat&background=1e293b&color=fff' }}
              />
            </div>
            <div className="text-white/90 text-base font-medium">Rudy Jimenez</div>
            <div className="text-white/40 text-sm">Marketing & Sales</div>
          </div>

        </div>
      </div>

    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INFO PANEL — Social Proof / Reviews
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ReviewsPanel() {
  const reviews = [
    {
      name: "Elizabeth Alexander.",
      text: "The work crew was very professional and did an excellent job replacing our roof. They showed up on time and went straight to work. Everyone had a role and they worked quietly and quickly. The crew didn't stop until everything was finished. It was a beautiful thing to watch! They were courteous and polite. They cleaned up quickly and left nothing behind - except for a beautiful new roof and an extended warranty. I highly recommend Blue Hat Roofs! Blue Hat Roofs was incredibly transparent. The estimate I got online was exactly what we discussed in person. No high-pressure sales, just honest work.",
      date: "2 months ago"
    },
    {
      name: "Ahmad Khater",
      text: "10/10 would recommend had to replace roof an my house, insurance required a write up and he provided it all no questions asked. Great pick of colors and very quick work and transparent prices. Went above and beyond with everything!",
      date: "4 months ago"
    },
    {
      name: "Kathy Green",
      text: "It was an absolute pleasure to work with Juan and his crew. I needed a total roof replacement. They did an amazing job in only a couple of days. Juan kept us informed as the job progressed. The yard was left immaculate after completing the job. I would use them again and refer anyone looking for roof work to them.",
      date: "5 months ago"
    }
  ];

  return (
    <div 
      className="mb-16 w-full max-w-xl mx-auto bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-xl border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_24px_rgba(0,0,0,0.25)] rounded-3xl relative overflow-hidden p-6 animate-fade-in"
      style={{ animationDelay: '450ms' }}
    >
      {/* Top-edge highlight line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-t-3xl" />

     {/* Header with Google Logo and Star Rating */}
     <div className="flex items-center justify-between mb-6">
        
        {/* Google Reviews Logo - Bumped from h-10 to h-14 */}
        <div className="ml-1">
          <img 
            src="/google-reviews.png" 
            alt="Google Reviews" 
            className="h-14 w-auto object-contain drop-shadow-md opacity-95" 
          />
        </div>

        {/* Overall Rating Pill */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 shadow-sm">
          <span className="text-white/90 text-sm font-bold tracking-wider">5.0</span>
          <div className="flex text-yellow-400 gap-0.5">
            {[1, 2, 3, 4, 5].map(i => <Star key={i} size={14} fill="currentColor" strokeWidth={1} />)}
          </div>
        </div>
        
      </div>

      {/* Review Cards */}
      <div className="flex flex-col gap-4">
        {reviews.map((review, idx) => (
          <div key={idx} className="bg-white/[0.05] border border-white/[0.10] rounded-2xl p-5">
            <div className="flex items-center gap-4 mb-3">
              {/* User Avatar Circle - Bumped to w-12 h-12 */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/30 to-orange-600/10 text-orange-400 flex items-center justify-center font-bold text-base border border-orange-500/20 flex-shrink-0">
                {review.name.charAt(0)}
              </div>
              <div>
                {/* Bumped name to text-base */}
                <div className="text-white/90 text-base font-medium">{review.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex text-yellow-400">
                     {[1, 2, 3, 4, 5].map(i => <Star key={i} size={12} fill="currentColor" strokeWidth={0} />)}
                  </div>
                  {/* Bumped date to text-xs */}
                  <span className="text-white/40 text-xs">{review.date}</span>
                </div>
              </div>
            </div>
            {/* Bumped review body to text-base */}
            <p className="text-white/70 text-base leading-relaxed italic">"{review.text}"</p>
          </div>
        ))}
      </div>
      
    </div>
  );
}