import QuoteFunnel from '@/components/QuoteFunnel';

/**
 * Root page — renders the full-screen roofing quote funnel.
 * The funnel is a single-page experience; routing is handled internally via
 * currentStep state inside QuoteFunnel.
 */
export default function Home() {
  return <QuoteFunnel />;
}
