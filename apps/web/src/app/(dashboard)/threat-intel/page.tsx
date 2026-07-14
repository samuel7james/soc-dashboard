"use client";

import { SeverityBadge } from "@soc/ui";
import type { CreateIocInput, IocType, Severity } from "@soc/types";
import { Plus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { MitreMatrix } from "@/components/shared/mitre-matrix";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/query-states";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { iocHooks } from "@/lib/api/iocs";
import { useCurrentUser } from "@/lib/api/use-auth";

const IOC_TYPE_OPTIONS: IocType[] = ["ip", "domain", "url", "file_hash", "email"];
const SEVERITY_OPTIONS: Severity[] = ["critical", "high", "medium", "low", "info"];

function CreateIocDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<IocType>("ip");
  const [value, setValue] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const createIoc = iocHooks.useCreate();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input: CreateIocInput = { type, value, severity };
    await createIoc.mutateAsync(input);
    setOpen(false);
    setValue("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> New Indicator
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add indicator of compromise</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as IocType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IOC_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Label htmlFor="ioc-value">Value</Label>
            <Input
              id="ioc-value"
              required
              placeholder="e.g. 185.220.101.47"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createIoc.isPending}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IndicatorsTab() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError } = iocHooks.useList({ page, pageSize: 20 });
  const { data: currentUser } = useCurrentUser();

  return (
    <div>
      <div className="mb-4 flex justify-end">
        {currentUser?.user.role !== "read_only" && <CreateIocDialog />}
      </div>
      <div className="border-border rounded-lg border">
        {isError && <ErrorState message="Failed to load indicators." />}
        {isPending && !isError && <LoadingRows />}
        {data && data.items.length === 0 && <EmptyState message="No indicators tracked yet." />}

        {data && data.items.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Value</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((ioc) => (
                  <TableRow key={ioc.id}>
                    <TableCell className="max-w-xs truncate font-mono text-xs">{ioc.value}</TableCell>
                    <TableCell className="text-muted-foreground">{ioc.type.replace("_", " ")}</TableCell>
                    <TableCell>
                      <SeverityBadge severity={ioc.severity} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{ioc.source ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(ioc.lastSeenAt).toLocaleDateString()}
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
    </div>
  );
}

export default function ThreatIntelPage() {
  return (
    <div>
      <PageHeader
        title="Threat Intelligence"
        description="Indicators of compromise, threat actors, and MITRE ATT&CK technique mapping."
      />
      <Tabs defaultValue="indicators">
        <TabsList>
          <TabsTrigger value="indicators">Indicators</TabsTrigger>
          <TabsTrigger value="matrix">ATT&CK Matrix</TabsTrigger>
        </TabsList>
        <TabsContent value="indicators">
          <IndicatorsTab />
        </TabsContent>
        <TabsContent value="matrix">
          <MitreMatrix />
        </TabsContent>
      </Tabs>
    </div>
  );
}
