import { Suspense } from "react";
import { TradeForm } from "@/components/log/TradeForm";

export default function LogPage() {
  return (
    <Suspense>
      <TradeForm />
    </Suspense>
  );
}
