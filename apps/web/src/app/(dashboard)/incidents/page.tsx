"use client";

import { SeverityBadge } from "@soc/ui";
import type { CreateIncidentInput, IncidentStatus, Severity } from "@soc/types";
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
import { Textarea } from "@/components/ui/textarea";
import { incidentHooks, useAddIncidentTimelineEvent, useIncidentDetail } from "@/lib/api/incidents";
import { useCurrentUser } from "@/lib/api/use-auth";
import { useUsers } from "@/lib/api/users";

const STATUS_OPTIONS: IncidentStatus[] = ["open", "investigating", "contained", "resolved", "closed"];
const SEVERITY_OPTIONS: Severity[] = ["critical", "high", "medium", "low", "info"];

function CreateIncidentDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const createIncident = incidentHooks.useCreate();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input: CreateIncidentInput = { title, severity, ...(description ? { description } : {}) };
    await createIncident.mutateAsync(input);
    setOpen(false);
    setTitle("");
    setDescription("");
    setSeverity("medium");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> New Incident
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create incident</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="incident-title">Title</Label>
            <Input id="incident-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="incident-description">Description</Label>
            <Textarea
              id="incident-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="incident-severity">Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
              <SelectTrigger id="incident-severity">
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
          <DialogFooter>
            <Button type="submit" disabled={createIncident.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IncidentDetailDialog({ incidentId, onClose }: { incidentId: string | null; onClose: () => void }) {
  const { data: incident } = useIncidentDetail(incidentId ?? undefined);
  const updateIncident = incidentHooks.useUpdate();
  const addTimelineEvent = useAddIncidentTimelineEvent();
  const { data: usersData } = useUsers();
  const [note, setNote] = useState("");

  async function handleAddNote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!incidentId || !note.trim()) return;
    await addTimelineEvent.mutateAsync({ id: incidentId, data: { message: note.trim() } });
    setNote("");
  }

  return (
    <Dialog open={Boolean(incidentId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {incident && (
          <>
            <DialogHeader>
              <DialogTitle>{incident.title}</DialogTitle>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={incident.severity} />
              <Select
                value={incident.status}
                onValueChange={(v) =>
                  incidentId &&
                  updateIncident.mutate({ id: incidentId, data: { status: v as IncidentStatus } })
                }
              >
                <SelectTrigger className="h-7 w-40" aria-label="Incident status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={incident.assignedToId ?? "unassigned"}
                onValueChange={(v) =>
                  incidentId &&
                  updateIncident.mutate({
                    id: incidentId,
                    data: { assignedToId: v === "unassigned" ? null : v },
                  })
                }
              >
                <SelectTrigger className="h-7 w-44" aria-label="Assigned to">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {usersData?.items.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {incident.description && <p className="text-muted-foreground text-sm">{incident.description}</p>}

            {incident.alerts.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1.5 text-xs font-medium">Linked alerts</p>
                <div className="flex flex-col gap-1.5">
                  {incident.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="border-border/60 flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm"
                    >
                      <span className="truncate">{alert.title}</span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <SeverityBadge severity={alert.severity} />
                        <StatusBadge status={alert.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-muted-foreground mb-1.5 text-xs font-medium">Timeline</p>
              <div className="flex flex-col gap-2">
                {incident.timelineEvents.map((event) => (
                  <div key={event.id} className="bg-muted/50 rounded-md px-2.5 py-1.5 text-sm">
                    <p>{event.message}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddNote} className="mt-2 flex gap-2">
                <Input
                  placeholder="Add a note…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={!note.trim() || addTimelineEvent.isPending}>
                  Add
                </Button>
              </form>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function IncidentsPage() {
  const [page, setPage] = useState(1);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const { data, isPending, isError } = incidentHooks.useList({ page, pageSize: 20 });
  const { data: currentUser } = useCurrentUser();

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <PageHeader
          title="Incidents"
          description="Case management: timeline, assignment, and status workflow."
        />
        {currentUser?.user.role !== "read_only" && <CreateIncidentDialog />}
      </div>

      <div className="border-border rounded-lg border">
        {isError && <ErrorState message="Failed to load incidents." />}
        {isPending && !isError && <LoadingRows />}
        {data && data.items.length === 0 && <EmptyState message="No incidents yet." />}

        {data && data.items.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((incident) => (
                  <TableRow
                    key={incident.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedIncidentId(incident.id)}
                  >
                    <TableCell className="max-w-sm truncate font-medium">{incident.title}</TableCell>
                    <TableCell>
                      <SeverityBadge severity={incident.severity} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={incident.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(incident.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
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

      <IncidentDetailDialog incidentId={selectedIncidentId} onClose={() => setSelectedIncidentId(null)} />
    </div>
  );
}
