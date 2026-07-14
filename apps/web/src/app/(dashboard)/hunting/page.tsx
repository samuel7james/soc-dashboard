"use client";

import { Sparkles, Upload } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/query-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useIngestionSources,
  useRawEvents,
  useToggleIngestionSource,
  useUploadTelemetryFile,
} from "@/lib/api/hunting";
import { useCurrentUser } from "@/lib/api/use-auth";

function IngestionSourcesPanel() {
  const { data: sources } = useIngestionSources();
  const toggleSource = useToggleIngestionSource();
  const { data: currentUser } = useCurrentUser();
  const canManage = currentUser?.user.role === "owner" || currentUser?.user.role === "admin";
  const demoSource = sources?.items.find((s) => s.type === "demo_generator");

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-sm">
        <Sparkles className="size-4 text-muted-foreground" aria-hidden />
        <span className="font-medium">Demo Mode</span>
        <Badge variant={demoSource?.isActive ? "default" : "outline"}>
          {demoSource?.isActive ? "Active — synthetic telemetry" : "Off"}
        </Badge>
      </div>
      {canManage && demoSource && (
        <Button
          size="sm"
          variant={demoSource.isActive ? "outline" : "default"}
          disabled={toggleSource.isPending}
          onClick={() => toggleSource.mutate({ id: demoSource.id, isActive: !demoSource.isActive })}
        >
          {demoSource.isActive ? "Disable" : "Enable"}
        </Button>
      )}
      <span className="text-xs text-muted-foreground">
        When enabled, a background worker generates clearly-labeled synthetic events — never presented as real telemetry.
      </span>
    </div>
  );
}

function UploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadTelemetryFile();
  const [message, setMessage] = useState<string | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await upload.mutateAsync(file);
      setMessage(`Queued ${result.queued} rows for ingestion.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.json"
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
      />
      <Button size="sm" variant="outline" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
        <Upload className="size-4" /> Upload CSV/JSON
      </Button>
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}

export default function HuntingPage() {
  const [page, setPage] = useState(1);
  const [sourceIp, setSourceIp] = useState("");
  const [ingestionSourceId, setIngestionSourceId] = useState("");

  const { data: sources } = useIngestionSources();
  const { data, isPending, isError } = useRawEvents({
    page,
    pageSize: 25,
    ...(sourceIp ? { sourceIp } : {}),
    ...(ingestionSourceId ? { ingestionSourceId } : {}),
  });

  return (
    <div>
      <div className="mb-2 flex items-start justify-between">
        <PageHeader
          title="Threat Hunting"
          description="Structured queries over normalized raw event telemetry."
        />
        <UploadButton />
      </div>

      <IngestionSourcesPanel />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Filter by source IP…"
          value={sourceIp}
          onChange={(e) => {
            setSourceIp(e.target.value);
            setPage(1);
          }}
          className="max-w-56"
        />
        <Select
          value={ingestionSourceId || "all"}
          onValueChange={(v) => {
            setIngestionSourceId(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All ingestion sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ingestion sources</SelectItem>
            {sources?.items.map((source) => (
              <SelectItem key={source.id} value={source.id}>
                {source.name} ({source.type.replace("_", " ")})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border">
        {isError && <ErrorState message="Failed to query raw events." />}
        {isPending && !isError && <LoadingRows />}
        {data && data.items.length === 0 && (
          <EmptyState message="No raw telemetry yet — upload a file, connect syslog, or enable Demo Mode above." />
        )}

        {data && data.items.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source IP</TableHead>
                  <TableHead>Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(event.receivedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{event.normalizedType ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{event.sourceIp ?? "—"}</TableCell>
                    <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground">
                      {JSON.stringify(event.payload)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
