import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function VulnerabilitiesPage() {
  return (
    <div>
      <PageHeader title="Vulnerability Management" description="Tracked vulnerabilities linked to assets." />
      <ComingSoon feature="Vulnerability Management" />
    </div>
  );
}
