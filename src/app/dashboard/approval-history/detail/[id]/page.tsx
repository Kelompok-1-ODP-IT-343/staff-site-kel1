"use client";

import React from "react";
import DetailPage from "@/app/dashboard/detail/[id]/page";

// The original detail page does not currently declare props; Next.js will
// simply invoke it with no arguments. We keep a thin wrapper to reuse its logic.
export default function ApprovalHistoryDetailWrapper() {
  return <DetailPage />;
}