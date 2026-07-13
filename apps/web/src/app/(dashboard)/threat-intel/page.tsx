import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function ThreatIntelPage() {
  return (
    <div>
      <PageHeader
        title="Threat Intelligence"
        description="Indicators of compromise, threat actors, and intel feeds."
      />
      <ComingSoon feature="Threat Intelligence" />
    </div>
  );
}
