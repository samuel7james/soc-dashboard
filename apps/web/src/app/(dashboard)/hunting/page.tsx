"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Sparkles, Upload } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/query-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RawEvent } from "@soc/types";
import {
  useIngestionSources,
  useRawEvents,
  useToggleIngestionSource,
  useUploadTelemetryFile,
} from "@/lib/api/hunting";
import { useCurrentUser } from "@/lib/api/use-auth";

const ROW_HEIGHT_PX = 40;
const VIEWPORT_HEIGHT_PX = 480;
const PAGE_SIZE_OPTIONS = [25, 100, 500] as const;
const GRID_COLUMNS = "180px 120px 160px minmax(0, 1fr)";

// Hunting queries scan through raw telemetry rather than triage a small
// queue — a page can hold up to 500 rows (see rawEventListQuerySchema), so
// the body is virtualized (only the visible slice is ever mounted). Built as
// a CSS grid rather than a real <table>: absolutely-positioned virtualized
// rows can't share column widths through the browser's table layout
// algorithm (each row would size its own columns independently and rows
// would visually overlap), but a shared grid-template-columns keeps every
// row's columns aligned with the header regardless of position.
function RawEventsTable({ items }: { items: RawEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 10,
  });

  return (
    <div ref={scrollRef} role="table" style={{ height: VIEWPORT_HEIGHT_PX, overflow: "auto" }}>
      <div
        role="row"
        className="border-border bg-card text-muted-foreground sticky top-0 z-10 grid border-b text-xs font-medium"
        style={{ gridTemplateColumns: GRID_COLUMNS }}
      >
        <div role="columnheader" className="px-4 py-2">
          Received
        </div>
        <div role="columnheader" className="px-4 py-2">
          Type
        </div>
        <div role="columnheader" className="px-4 py-2">
          Source IP
        </div>
        <div role="columnheader" className="px-4 py-2">
          Payload
        </div>
      </div>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const event = items[virtualRow.index]!;
          return (
            <div
              key={event.id}
              role="row"
              data-index={virtualRow.index}
              className="border-border/60 hover:bg-accent/50 grid items-center border-b text-sm"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: GRID_COLUMNS,
              }}
            >
              <div role="cell" className="text-muted-foreground truncate px-4">
                {new Date(event.receivedAt).toLocaleString()}
              </div>
              <div role="cell" className="text-muted-foreground truncate px-4">
                {event.normalizedType ?? "—"}
              </div>
              <div role="cell" className="truncate px-4 font-mono text-xs">
                {event.sourceIp ?? "—"}
              </div>
              <div role="cell" className="text-muted-foreground truncate px-4 font-mono text-xs">
                {JSON.stringify(event.payload)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IngestionSourcesPanel() {
  const { data: sources } = useIngestionSources();
  const toggleSource = useToggleIngestionSource();
  const { data: currentUser } = useCurrentUser();
  const canManage = currentUser?.user.role === "owner" || currentUser?.user.role === "admin";
  const demoSource = sources?.items.find((s) => s.type === "demo_generator");

  return (
    <div className="border-border bg-card mb-4 flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-sm">
        <Sparkles className="text-muted-foreground size-4" aria-hidden />
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
      <span className="text-muted-foreground text-xs">
        When enabled, a background worker generates clearly-labeled synthetic events — never presented as real
        telemetry.
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
      <Button
        size="sm"
        variant="outline"
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" /> Upload CSV/JSON
      </Button>
      {message && <span className="text-muted-foreground text-xs">{message}</span>}
    </div>
  );
}

export default function HuntingPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(100);
  const [sourceIp, setSourceIp] = useState("");
  const [ingestionSourceId, setIngestionSourceId] = useState("");

  const { data: sources } = useIngestionSources();
  const { data, isPending, isError } = useRawEvents({
    page,
    pageSize,
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
          <SelectTrigger className="w-56" aria-label="Filter by ingestion source">
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
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            setPageSize(Number(v) as (typeof PAGE_SIZE_OPTIONS)[number]);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} rows / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-border rounded-lg border">
        {isError && <ErrorState message="Failed to query raw events." />}
        {isPending && !isError && <LoadingRows />}
        {data && data.items.length === 0 && (
          <EmptyState message="No raw telemetry yet — upload a file, connect syslog, or enable Demo Mode above." />
        )}

        {data && data.items.length > 0 && (
          <>
            <RawEventsTable items={data.items} />
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
