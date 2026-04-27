import type { Metadata } from 'next';
import Script from 'next/script';
import BackgroundMedia from '@/components/BackgroundMedia'; // <-- IMPORT ADDED HERE
import './globals.css';

export const metadata: Metadata = {
  title: 'Get Your Free Roof Estimate | Instant Quote',
  description:
    'Get an accurate roofing estimate in under 60 seconds. No contractors, no pressure — just your price.',
  openGraph: {
    title: 'Instant Roofing Quote — Free & No Obligation',
    description: 'See real pricing for your roof replacement in 60 seconds.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/*
         * Google Ads conversion tag — using plain <script> tags (not Next.js
         * Script component) so the tag physically renders in <head> in the DOM.
         * Next.js's <Script strategy="afterInteractive"> moves scripts to <body>
         * regardless of JSX placement, which prevents Google's tag scanner from
         * detecting it. Plain <script> tags inside <head> stay in <head>.
         */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=AW-18121619085"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'AW-18121619085');
            `,
          }}
        />

        {/* Meta Pixel — base code + PageView, fires on every page */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window,document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '278410202537659');
              fbq('track', 'PageView');
            `,
          }}
        />
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=278410202537659&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
      </head>
      <body>
        {/* 1. BACKGROUND MEDIA RENDERED HERE */}
        <BackgroundMedia />

        {/* 2. WRAP CHILDREN TO ENSURE THEY SIT ON TOP OF BACKGROUND */}
        <div className="relative z-10">
          {children}
        </div>


        {/*
         * Google Maps JavaScript API — loaded once at the app level so every
         * page/component can access window.google.maps without redundant requests.
         *
         * strategy="afterInteractive" defers loading until after hydration,
         * keeping the initial page load fast. Step01_Address polls for
         * window.google.maps.places before enabling autocomplete suggestions.
         *
         * Required APIs to enable in GCP Console (same project as Firebase):
         * • Maps JavaScript API
         * • Places API
         * • Geocoding API
         */}
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&v=beta`}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}