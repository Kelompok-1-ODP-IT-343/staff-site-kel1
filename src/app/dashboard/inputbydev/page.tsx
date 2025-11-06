import { Suspense } from "react";
import InputByDevPageClient from "./InputByDevPageClient";

export default function InputByDevPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <InputByDevPageClient />
    </Suspense>
  );
}
