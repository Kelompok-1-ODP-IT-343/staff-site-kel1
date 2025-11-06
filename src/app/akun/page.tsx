import { Suspense } from "react";
import AkunPageClient from "./AkunPageClient";

export default function AkunPage() {
  // Wrap the client component that uses useSearchParams with Suspense per Next.js guidance
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <AkunPageClient />
    </Suspense>
  );
}
