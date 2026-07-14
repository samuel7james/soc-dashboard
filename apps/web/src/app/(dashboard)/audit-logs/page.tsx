"use client";

import { ShieldAlert } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/query-states";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuditLogs } from "@/lib/api/audit-logs";
import { useCurrentUser } from "@/lib/api/use-auth";
import { useUsers } from "@/lib/api/users";

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const { data: currentUser } = useCurrentUser();
  const isPrivileged = currentUser?.user.role === "owner" || currentUser?.user.role === "admin";

  const { data, isPending, isError } = useAuditLogs({
    page,
    pageSize: 25,
    ...(action ? { action } : {}),
  });
  const { data: usersData } = useUsers();

  return (
    <div>
      <PageHeader title="Audit Logs" description="Immutable record of every privileged platform action." />

      {!isPrivileged ? (
        <div className="border-border text-muted-foreground flex flex-col items-center gap-2 rounded-lg border py-16 text-sm">
          <ShieldAlert className="size-6" aria-hidden />
          <span>Audit logs are visible to owners and admins only.</span>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <Input
              placeholder="Filter by action, e.g. auth.login"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              className="max-w-xs"
            />
          </div>

          <div className="border-border rounded-lg border">
            {isError && <ErrorState message="Failed to load audit logs." />}
            {isPending && !isError && <LoadingRows />}
            {data && data.items.length === 0 && <EmptyState message="No audit log entries match." />}

            {data && data.items.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((entry) => {
                      const actor = usersData?.items.find((u) => u.id === entry.actorId);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="font-mono text-xs">{entry.action}</TableCell>
                          <TableCell className="text-muted-foreground">{actor?.email ?? "system"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {entry.targetType ? `${entry.targetType}:${entry.targetId?.slice(0, 8)}` : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{entry.ipAddress ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleString()}
                          </TableCell>
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
        </>
      )}
    </div>
  );
}
