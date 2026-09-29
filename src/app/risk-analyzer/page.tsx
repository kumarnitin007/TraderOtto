import { Suspense } from "react";
import { RiskAnalyzerScreen } from "@/components/risk/RiskAnalyzerScreen";

export default function RiskAnalyzerPage() {
  return (
    <Suspense>
      <RiskAnalyzerScreen />
    </Suspense>
  );
}
