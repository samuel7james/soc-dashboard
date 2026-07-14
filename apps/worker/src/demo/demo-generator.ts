import type { IngestionJobData } from "@soc/connectors";
import { prisma } from "@soc/database";
import type { Queue } from "bullmq";
import type { Logger } from "pino";

import { env } from "../config/env.js";

const SOURCE_NAME = "Demo Mode Generator";
const GENERATE_INTERVAL_MS = 4000;

const SAMPLE_MESSAGES = [
  "sshd[2201]: Failed password for admin from {ip} port 51422 ssh2",
  "sshd[2201]: Failed password for root from {ip} port 51500 ssh2",
  "sudo: deploy : TTY=pts/1 ; PWD=/home/deploy ; COMMAND=/usr/bin/systemctl restart nginx",
  "kernel: possible ransomware behavior: mass file rename detected on /data",
  "sshd[2201]: Accepted password for deploy from {ip} port 51600 ssh2",
  "cron[441]: (root) CMD (/usr/local/bin/backup.sh)",
];

function randomIp(): string {
  return `198.51.100.${Math.floor(Math.random() * 254) + 1}`;
}

function buildDemoPayload(): { sourceIp: string; message: string } {
  const template = SAMPLE_MESSAGES[Math.floor(Math.random() * SAMPLE_MESSAGES.length)]!;
  const sourceIp = randomIp();
  return { sourceIp, message: template.replace("{ip}", sourceIp) };
}

async function getOrCreateDemoSource(): Promise<{ id: string; isActive: boolean }> {
  const existing = await prisma.ingestionSource.findFirst({ where: { type: "demo_generator" } });
  if (existing) return existing;

  return prisma.ingestionSource.create({
    data: { name: SOURCE_NAME, type: "demo_generator", isActive: false },
  });
}

// Demo Mode is off by default and only ever labeled as such in the UI — it
// exists so the platform is explorable without real telemetry connected, not
// to masquerade as live data (the original app's Math.random()-backed "live"
// data was exactly this anti-pattern, which this deliberately does not repeat).
export function startDemoModeSupervisor(queue: Queue<IngestionJobData>, logger: Logger): NodeJS.Timeout {
  let generatorInterval: NodeJS.Timeout | null = null;
  let sourceId: string | null = null;

  async function tick(): Promise<void> {
    const source = await getOrCreateDemoSource();
    sourceId = source.id;

    if (source.isActive && !generatorInterval) {
      logger.info("Demo Mode enabled — starting synthetic event generation");
      generatorInterval = setInterval(() => {
        if (!sourceId) return;
        const { sourceIp, message } = buildDemoPayload();
        void queue.add("demo-event", {
          ingestionSourceId: sourceId,
          normalizedType: "syslog",
          sourceIp,
          payload: { message, source: "demo" },
        } satisfies IngestionJobData);
      }, GENERATE_INTERVAL_MS);
    } else if (!source.isActive && generatorInterval) {
      logger.info("Demo Mode disabled — stopping synthetic event generation");
      clearInterval(generatorInterval);
      generatorInterval = null;
    }
  }

  void tick();
  return setInterval(() => void tick(), env.DEMO_MODE_POLL_INTERVAL_MS);
}
