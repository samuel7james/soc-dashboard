import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function AuditLogsPage() {
  return (
    <div>
      <PageHeader title="Audit Logs" description="Immutable record of every privileged platform action." />
      <ComingSoon feature="Audit Logs" />
    </div>
  );
}
