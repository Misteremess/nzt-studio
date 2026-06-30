// app/(private)/email-generator/page.tsx
// Email Generator — drafts personalized commercial/follow-up emails with AI.

import { listEmailDrafts, listEmailGeneratorBusinesses } from "@/features/email-generator/lib/store";
import { EmailGeneratorView } from "@/features/email-generator/components/email-generator-view";

export default async function EmailGeneratorPage() {
  const [drafts, businesses] = await Promise.all([
    listEmailDrafts(),
    listEmailGeneratorBusinesses(),
  ]);

  return (
    <div className="mx-auto h-full w-full max-w-5xl">
      <EmailGeneratorView initialDrafts={drafts} businesses={businesses} />
    </div>
  );
}
