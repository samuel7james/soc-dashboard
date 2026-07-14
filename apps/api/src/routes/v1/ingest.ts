import { parseCsv, type IngestionJobData } from "@soc/connectors";
import { prisma } from "@soc/database";

import { ingestionQueue } from "../../lib/ingestion-queue.js";
import { requireRole } from "../../plugins/rbac.js";
import type { TypedApp } from "../../app.js";

const MAX_ROWS_PER_UPLOAD = 1000;
const SOURCE_NAME = "File Upload";

async function getOrCreateFileUploadSource(): Promise<string> {
  const existing = await prisma.ingestionSource.findFirst({ where: { type: "file_upload" } });
  if (existing) return existing.id;

  const created = await prisma.ingestionSource.create({
    data: { name: SOURCE_NAME, type: "file_upload", isActive: true },
  });
  return created.id;
}

function extractSourceIp(row: Record<string, unknown>): string | undefined {
  const candidate = row.ip ?? row.sourceIp ?? row.source_ip ?? row.src_ip;
  return typeof candidate === "string" ? candidate : undefined;
}

export async function registerIngestRoutes(app: TypedApp): Promise<void> {
  app.post("/upload", { preHandler: requireRole("owner", "admin", "analyst") }, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ status: "error", message: "No file provided" });
    }

    const buffer = await file.toBuffer();
    const text = buffer.toString("utf8");
    const isJson = file.filename.toLowerCase().endsWith(".json");

    let rows: Record<string, unknown>[];
    try {
      rows = isJson ? (JSON.parse(text) as Record<string, unknown>[]) : parseCsv(text);
    } catch {
      return reply
        .status(400)
        .send({ status: "error", message: `Failed to parse ${isJson ? "JSON" : "CSV"} file` });
    }

    if (!Array.isArray(rows)) {
      return reply
        .status(400)
        .send({ status: "error", message: "JSON file must contain an array of records" });
    }

    if (rows.length > MAX_ROWS_PER_UPLOAD) {
      return reply.status(400).send({
        status: "error",
        message: `File contains ${rows.length} rows; max is ${MAX_ROWS_PER_UPLOAD}`,
      });
    }

    const ingestionSourceId = await getOrCreateFileUploadSource();

    await Promise.all(
      rows.map((row) => {
        const sourceIp = extractSourceIp(row);
        const jobData: IngestionJobData = {
          ingestionSourceId,
          normalizedType: "file_upload",
          payload: row,
          ...(sourceIp !== undefined ? { sourceIp } : {}),
        };
        return ingestionQueue.add("file-upload-row", jobData);
      }),
    );

    return { status: "success", queued: rows.length, ingestionSourceId };
  });
}
