"use client";

import { SeverityBadge } from "@soc/ui";
import type { CreateVulnerabilityInput, Severity, VulnerabilityStatus } from "@soc/types";
import { Plus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/query-states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assetHooks } from "@/lib/api/assets";
import { useCurrentUser } from "@/lib/api/use-auth";
import { vulnerabilityHooks } from "@/lib/api/vulnerabilities";

const STATUS_OPTIONS: VulnerabilityStatus[] = ["open", "remediated", "accepted_risk", "false_positive"];
const SEVERITY_OPTIONS: Severity[] = ["critical", "high", "medium", "low", "info"];

function CreateVulnerabilityDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [cveId, setCveId] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [assetId, setAssetId] = useState<string>("");
  const createVulnerability = vulnerabilityHooks.useCreate();
  const { data: assetsData } = assetHooks.useList({ pageSize: 100 });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input: CreateVulnerabilityInput = {
      title,
      severity,
      ...(cveId ? { cveId } : {}),
      ...(assetId ? { assetId } : {}),
    };
    await createVulnerability.mutateAsync(input);
    setOpen(false);
    setTitle("");
    setCveId("");
    setAssetId("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> New Vulnerability
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Track vulnerability</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vuln-title">Title</Label>
            <Input id="vuln-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vuln-cve">CVE ID</Label>
              <Input
                id="vuln-cve"
                placeholder="CVE-2024-…"
                value={cveId}
                onChange={(e) => setCveId(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Affected asset</Label>
            <Select value={assetId || "none"} onValueChange={(v) => setAssetId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {assetsData?.items.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createVulnerability.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function VulnerabilitiesPage() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError } = vulnerabilityHooks.useList({ page, pageSize: 20 });
  const updateVulnerability = vulnerabilityHooks.useUpdate();
  const { data: assetsData } = assetHooks.useList({ pageSize: 100 });
  const { data: currentUser } = useCurrentUser();
  const canWrite = currentUser?.user.role !== "read_only";

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <PageHeader
          title="Vulnerability Management"
          description="Tracked vulnerabilities linked to assets."
        />
        {canWrite && <CreateVulnerabilityDialog />}
      </div>

      <div className="border-border rounded-lg border">
        {isError && <ErrorState message="Failed to load vulnerabilities." />}
        {isPending && !isError && <LoadingRows />}
        {data && data.items.length === 0 && <EmptyState message="No vulnerabilities tracked yet." />}

        {data && data.items.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>CVE</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Asset</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((vuln) => {
                  const asset = assetsData?.items.find((a) => a.id === vuln.assetId);
                  return (
                    <TableRow key={vuln.id}>
                      <TableCell className="max-w-xs truncate font-medium">{vuln.title}</TableCell>
                      <TableCell className="text-muted-foreground">{vuln.cveId ?? "—"}</TableCell>
                      <TableCell>
                        <SeverityBadge severity={vuln.severity} />
                      </TableCell>
                      <TableCell>
                        {canWrite ? (
                          <Select
                            value={vuln.status}
                            onValueChange={(v) =>
                              updateVulnerability.mutate({
                                id: vuln.id,
                                data: { status: v as VulnerabilityStatus },
                              })
                            }
                          >
                            <SelectTrigger className="h-7 w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s.replace("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <StatusBadge status={vuln.status} />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{asset?.name ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <PaginationBar
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
