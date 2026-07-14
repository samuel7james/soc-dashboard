"use client";

import { SeverityBadge } from "@soc/ui";
import type { Alert, AlertStatus } from "@soc/types";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/query-states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { alertHooks } from "@/lib/api/alerts";
import { useCurrentUser } from "@/lib/api/use-auth";
import { useUsers } from "@/lib/api/users";

const STATUS_OPTIONS: AlertStatus[] = ["open", "acknowledged", "resolved", "false_positive"];

export default function AlertsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [severity, setSeverity] = useState<string>("");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const { data: currentUser } = useCurrentUser();
  const canTriage = currentUser?.user.role !== "read_only";

  const { data, isPending, isError } = alertHooks.useList({
    page,
    pageSize: 20,
    ...(status ? { status } : {}),
    ...(severity ? { severity } : {}),
  });
  const updateAlert = alertHooks.useUpdate();
  const { data: usersData } = useUsers();

  function handleStatusChange(alert: Alert, newStatus: AlertStatus) {
    updateAlert.mutate({ id: alert.id, data: { status: newStatus } });
  }

  function handleAssign(alert: Alert, userId: string) {
    updateAlert.mutate({ id: alert.id, data: { assignedToId: userId } });
  }

  return (
    <div>
      <PageHeader
        title="Alerts"
        description="Triage queue for security alerts across all ingestion sources."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select
          value={status || "all"}
          onValueChange={(v) => {
            setStatus(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={severity || "all"}
          onValueChange={(v) => {
            setSeverity(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {(["critical", "high", "medium", "low", "info"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-border rounded-lg border">
        {isError && <ErrorState message="Failed to load alerts." />}
        {isPending && !isError && <LoadingRows />}
        {data && data.items.length === 0 && <EmptyState message="No alerts match these filters." />}

        {data && data.items.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Created</TableHead>
                  {canTriage && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((alert) => {
                  const assignee = usersData?.items.find((u) => u.id === alert.assignedToId);
                  return (
                    <TableRow
                      key={alert.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedAlert(alert)}
                    >
                      <TableCell className="max-w-xs truncate font-medium">{alert.title}</TableCell>
                      <TableCell>
                        <SeverityBadge severity={alert.severity} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={alert.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {assignee?.name ?? "Unassigned"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(alert.createdAt).toLocaleString()}
                      </TableCell>
                      {canTriage && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                aria-label="Alert actions"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Set status</DropdownMenuLabel>
                              {STATUS_OPTIONS.map((s) => (
                                <DropdownMenuItem key={s} onClick={() => handleStatusChange(alert, s)}>
                                  {s.replace("_", " ")}
                                </DropdownMenuItem>
                              ))}
                              {currentUser && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleAssign(alert, currentUser.user.id)}>
                                    Assign to me
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
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

      <Dialog open={Boolean(selectedAlert)} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent>
          {selectedAlert && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAlert.title}</DialogTitle>
                <DialogDescription>
                  {selectedAlert.description ?? "No description provided."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={selectedAlert.severity} />
                <StatusBadge status={selectedAlert.status} />
                {selectedAlert.sourceIp && (
                  <span className="text-muted-foreground text-sm">Source: {selectedAlert.sourceIp}</span>
                )}
              </div>
              {selectedAlert.mitreTechniqueIds.length > 0 && (
                <div className="mt-3">
                  <p className="text-muted-foreground mb-1 text-xs font-medium">MITRE ATT&CK techniques</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAlert.mitreTechniqueIds.map((id) => (
                      <span
                        key={id}
                        className="border-border bg-muted rounded-full border px-2 py-0.5 text-xs"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedAlert(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
