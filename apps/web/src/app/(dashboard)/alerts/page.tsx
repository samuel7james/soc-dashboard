import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function AlertsPage() {
  return (
    <div>
      <PageHeader
        title="Alerts"
        description="Triage queue for security alerts across all ingestion sources."
      />
      <ComingSoon feature="Alerts" />
    </div>
  );
}
