import type { Metadata } from 'next';
import { LandingPage } from "./landing-page";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${SITE_NAME} - Zero Trust Server Operations`,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: absoluteUrl('/'),
  },
};

export default async function Home() {
  return <LandingPage />;
}
