"use client";

import { SeverityBadge } from "@soc/ui";
import type { Asset, AssetType, CreateAssetInput, Severity } from "@soc/types";
import { MoreHorizontal, Plus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assetHooks } from "@/lib/api/assets";
import { useCurrentUser } from "@/lib/api/use-auth";

const TYPE_OPTIONS: AssetType[] = ["server", "workstation", "network_device", "cloud_resource", "other"];
const CRITICALITY_OPTIONS: Severity[] = ["critical", "high", "medium", "low", "info"];

function CreateAssetDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType>("server");
  const [criticality, setCriticality] = useState<Severity>("medium");
  const [ipAddress, setIpAddress] = useState("");
  const createAsset = assetHooks.useCreate();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input: CreateAssetInput = { name, type, criticality, ...(ipAddress ? { ipAddress } : {}) };
    await createAsset.mutateAsync(input);
    setOpen(false);
    setName("");
    setIpAddress("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> New Asset
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add asset</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset-name">Name</Label>
            <Input id="asset-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as AssetType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Criticality</Label>
              <Select value={criticality} onValueChange={(v) => setCriticality(v as Severity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRITICALITY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset-ip">IP address</Label>
            <Input id="asset-ip" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createAsset.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AssetsPage() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError } = assetHooks.useList({ page, pageSize: 20 });
  const deleteAsset = assetHooks.useDelete();
  const { data: currentUser } = useCurrentUser();
  const canWrite = currentUser?.user.role !== "read_only";
  const canDelete = currentUser?.user.role === "owner" || currentUser?.user.role === "admin";

  function handleDelete(asset: Asset) {
    if (confirm(`Delete asset "${asset.name}"? This cannot be undone.`)) {
      deleteAsset.mutate(asset.id);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <PageHeader title="Asset Inventory" description="Hosts, services, and their criticality tagging." />
        {canWrite && <CreateAssetDialog />}
      </div>

      <div className="border-border rounded-lg border">
        {isError && <ErrorState message="Failed to load assets." />}
        {isPending && !isError && <LoadingRows />}
        {data && data.items.length === 0 && <EmptyState message="No assets tracked yet." />}

        {data && data.items.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Criticality</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Owner</TableHead>
                  {canDelete && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.type.replace("_", " ")}</TableCell>
                    <TableCell>
                      <SeverityBadge severity={asset.criticality} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{asset.ipAddress ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.owner ?? "—"}</TableCell>
                    {canDelete && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7" aria-label="Asset actions">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(asset)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
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
