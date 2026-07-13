import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function HuntingPage() {
  return (
    <div>
      <PageHeader
        title="Threat Hunting"
        description="Structured queries over normalized raw event telemetry."
      />
      <ComingSoon feature="Threat Hunting" />
    </div>
  );
}
