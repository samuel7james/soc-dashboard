-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('critical', 'high', 'medium', 'low', 'info');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('open', 'acknowledged', 'resolved', 'false_positive');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('open', 'investigating', 'contained', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "IngestionSourceType" AS ENUM ('demo_generator', 'syslog', 'file_upload', 'webhook');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('server', 'workstation', 'network_device', 'cloud_resource', 'other');

-- CreateEnum
CREATE TYPE "VulnerabilityStatus" AS ENUM ('open', 'remediated', 'accepted_risk', 'false_positive');

-- CreateEnum
CREATE TYPE "IocType" AS ENUM ('ip', 'domain', 'url', 'file_hash', 'email');

-- CreateEnum
CREATE TYPE "IncidentEventType" AS ENUM ('note', 'status_change', 'assignment', 'alert_linked');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('alert', 'incident', 'system');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "ipAddress" TEXT,
    "hostname" TEXT,
    "criticality" "Severity" NOT NULL DEFAULT 'medium',
    "owner" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vulnerabilities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cveId" TEXT,
    "severity" "Severity" NOT NULL,
    "status" "VulnerabilityStatus" NOT NULL DEFAULT 'open',
    "assetId" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remediatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vulnerabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threat_actors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "sophistication" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "threat_actors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iocs" (
    "id" TEXT NOT NULL,
    "type" "IocType" NOT NULL,
    "value" TEXT NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'medium',
    "description" TEXT,
    "source" TEXT,
    "threatActorId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iocs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mitre_techniques" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tactic" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mitre_techniques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "Severity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'open',
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_timeline_events" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorId" TEXT,
    "eventType" "IncidentEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IngestionSourceType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "lastIngestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_events" (
    "id" TEXT NOT NULL,
    "ingestionSourceId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceIp" TEXT,
    "normalizedType" TEXT,
    "payload" JSONB NOT NULL,

    CONSTRAINT "raw_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "Severity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'open',
    "sourceIp" TEXT,
    "assetId" TEXT,
    "ingestionSourceId" TEXT,
    "assignedToId" TEXT,
    "incidentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_mitre_mappings" (
    "alertId" TEXT NOT NULL,
    "mitreTechniqueId" TEXT NOT NULL,

    CONSTRAINT "alert_mitre_mappings_pkey" PRIMARY KEY ("alertId","mitreTechniqueId")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assets_type_idx" ON "assets"("type");

-- CreateIndex
CREATE INDEX "assets_criticality_idx" ON "assets"("criticality");

-- CreateIndex
CREATE INDEX "vulnerabilities_assetId_idx" ON "vulnerabilities"("assetId");

-- CreateIndex
CREATE INDEX "vulnerabilities_severity_idx" ON "vulnerabilities"("severity");

-- CreateIndex
CREATE INDEX "vulnerabilities_status_idx" ON "vulnerabilities"("status");

-- CreateIndex
CREATE UNIQUE INDEX "threat_actors_name_key" ON "threat_actors"("name");

-- CreateIndex
CREATE INDEX "iocs_threatActorId_idx" ON "iocs"("threatActorId");

-- CreateIndex
CREATE INDEX "iocs_severity_idx" ON "iocs"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "iocs_type_value_key" ON "iocs"("type", "value");

-- CreateIndex
CREATE INDEX "mitre_techniques_tactic_idx" ON "mitre_techniques"("tactic");

-- CreateIndex
CREATE INDEX "incidents_status_idx" ON "incidents"("status");

-- CreateIndex
CREATE INDEX "incidents_assignedToId_idx" ON "incidents"("assignedToId");

-- CreateIndex
CREATE INDEX "incident_timeline_events_incidentId_idx" ON "incident_timeline_events"("incidentId");

-- CreateIndex
CREATE INDEX "raw_events_ingestionSourceId_idx" ON "raw_events"("ingestionSourceId");

-- CreateIndex
CREATE INDEX "raw_events_receivedAt_idx" ON "raw_events"("receivedAt");

-- CreateIndex
CREATE INDEX "alerts_status_idx" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "alerts_severity_idx" ON "alerts"("severity");

-- CreateIndex
CREATE INDEX "alerts_assetId_idx" ON "alerts"("assetId");

-- CreateIndex
CREATE INDEX "alerts_incidentId_idx" ON "alerts"("incidentId");

-- CreateIndex
CREATE INDEX "alerts_createdAt_idx" ON "alerts"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_readAt_idx" ON "notifications"("readAt");

-- AddForeignKey
ALTER TABLE "vulnerabilities" ADD CONSTRAINT "vulnerabilities_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iocs" ADD CONSTRAINT "iocs_threatActorId_fkey" FOREIGN KEY ("threatActorId") REFERENCES "threat_actors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_timeline_events" ADD CONSTRAINT "incident_timeline_events_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_timeline_events" ADD CONSTRAINT "incident_timeline_events_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_ingestionSourceId_fkey" FOREIGN KEY ("ingestionSourceId") REFERENCES "ingestion_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_ingestionSourceId_fkey" FOREIGN KEY ("ingestionSourceId") REFERENCES "ingestion_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_mitre_mappings" ADD CONSTRAINT "alert_mitre_mappings_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_mitre_mappings" ADD CONSTRAINT "alert_mitre_mappings_mitreTechniqueId_fkey" FOREIGN KEY ("mitreTechniqueId") REFERENCES "mitre_techniques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
