import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" description="On-demand and scheduled security reporting." />
      <ComingSoon feature="Reports" />
    </div>
  );
}
