import { OnboardingDetailClient } from './OnboardingDetailClient';

export default function OnboardingDetailPage({ params }: { params: { slug: string } }) {
  return <OnboardingDetailClient slug={params.slug} />;
}
