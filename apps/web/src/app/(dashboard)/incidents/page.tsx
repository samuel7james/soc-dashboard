import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function IncidentsPage() {
  return (
    <div>
      <PageHeader
        title="Incidents"
        description="Case management: timeline, assignment, and status workflow."
      />
      <ComingSoon feature="Incidents" />
    </div>
  );
}
