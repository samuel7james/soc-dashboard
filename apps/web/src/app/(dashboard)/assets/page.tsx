import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function AssetsPage() {
  return (
    <div>
      <PageHeader title="Asset Inventory" description="Hosts, services, and their criticality tagging." />
      <ComingSoon feature="Asset Inventory" />
    </div>
  );
}
