import { Download, FileSpreadsheet } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const RESOURCES = [
  { key: "alerts", label: "Alerts", description: "Every alert, all statuses and severities." },
  { key: "incidents", label: "Incidents", description: "All incidents with current status and severity." },
  {
    key: "vulnerabilities",
    label: "Vulnerabilities",
    description: "Tracked vulnerabilities across all assets.",
  },
  { key: "assets", label: "Assets", description: "Full asset inventory with criticality." },
] as const;

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" description="On-demand CSV/JSON export of platform data." />

      <div className="grid gap-4 sm:grid-cols-2">
        {RESOURCES.map((resource) => (
          <Card key={resource.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="size-4" aria-hidden />
                {resource.label}
              </CardTitle>
              <CardDescription>{resource.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`${API_BASE_URL}/api/v1/reports/export?resource=${resource.key}&format=csv`}>
                  <Download className="size-4" /> CSV
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`${API_BASE_URL}/api/v1/reports/export?resource=${resource.key}&format=json`}>
                  <Download className="size-4" /> JSON
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-muted-foreground mt-6 text-sm">
        Scheduled report generation and delivery (email/webhook) runs through the background worker and lands
        alongside notification delivery — see <code>TASKS.md</code>.
      </p>
    </div>
  );
}
