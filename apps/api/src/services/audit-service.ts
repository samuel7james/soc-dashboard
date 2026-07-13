import { prisma, type Prisma } from "@soc/database";

interface AuditEntry {
  actorId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditLog(entry: AuditEntry): Promise<void> {
  const data: Prisma.AuditLogUncheckedCreateInput = { action: entry.action };

  if (entry.actorId !== undefined) data.actorId = entry.actorId;
  if (entry.targetType !== undefined) data.targetType = entry.targetType;
  if (entry.targetId !== undefined) data.targetId = entry.targetId;
  if (entry.ipAddress !== undefined) data.ipAddress = entry.ipAddress;
  if (entry.metadata !== undefined) data.metadata = entry.metadata as Prisma.InputJsonValue;

  await prisma.auditLog.create({ data });
}
