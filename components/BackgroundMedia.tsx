'use client';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION — swap this one line to change the background
//   Video:  '/bg-main.mp4'  or  '/bg-main.webm'
//   Image:  '/bg-main.jpg'  or  '/bg-main.png'
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BACKGROUND_MEDIA_URL = '/bg-main.jpg';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * BackgroundMedia — Fixed full-screen background that accepts either a video
 * (mp4 / webm) or a static image (jpg / png / webp).
 *
 * Layer order (back → front) within the -z-10 stacking context:
 *   1. Media (video or img)  — fills the viewport, object-cover
 *   2. Dark overlay           — improves readability of white funnel text
 *   3. Dot-grid texture       — subtle depth
 *
 * Switch media type by changing BACKGROUND_MEDIA_URL above.
 * Place your file in the /public directory at the root of the project.
 */
export default function BackgroundMedia() {
  const isVideo = /\.(mp4|webm)$/i.test(BACKGROUND_MEDIA_URL);

  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none"
      aria-hidden="true"
    >
      {/* ── Media layer ── */}
      {isVideo ? (
        /*
         * autoPlay  — starts immediately without user interaction.
         * muted     — required by browsers to allow autoPlay.
         * loop      — seamless infinite loop.
         * playsInline — prevents iOS Safari from going full-screen on play.
         */
        <video
          src={BACKGROUND_MEDIA_URL}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={BACKGROUND_MEDIA_URL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* ── Dark overlay — keeps white text readable over any media ── */}
      <div className="absolute inset-0 bg-black/50" />

      {/* ── Dot-grid texture — subtle depth ── */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
    </div>
  );
}
