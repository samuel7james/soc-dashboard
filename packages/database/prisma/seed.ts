import { hashPassword } from "@soc/auth";

import { prisma } from "../src/index.js";
import { mitreTechniques } from "./seed-data/mitre-techniques.js";

async function seedOwner(): Promise<string> {
  const email = process.env.SEED_OWNER_EMAIL ?? "owner@soc.local";
  const password = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await hashPassword(password);

  const owner = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name: "Platform Owner", role: "owner" },
  });

  console.log(`Seeded owner user: ${owner.email} (id: ${owner.id})`);
  if (!process.env.SEED_OWNER_PASSWORD) {
    console.log(`Default password: ${password} — change this immediately outside local dev.`);
  }

  return owner.id;
}

async function seedMitreTechniques(): Promise<void> {
  for (const technique of mitreTechniques) {
    await prisma.mitreTechnique.upsert({
      where: { id: technique.id },
      update: { name: technique.name, tactic: technique.tactic },
      create: {
        id: technique.id,
        name: technique.name,
        tactic: technique.tactic,
        url: `https://attack.mitre.org/techniques/${technique.id}/`,
      },
    });
  }
  console.log(`Seeded ${mitreTechniques.length} MITRE ATT&CK techniques.`);
}

async function seedIngestionSources(): Promise<void> {
  const sources: { name: string; type: "syslog" | "file_upload" | "demo_generator" }[] = [
    { name: "Syslog UDP Listener", type: "syslog" },
    { name: "File Upload", type: "file_upload" },
    { name: "Demo Mode Generator", type: "demo_generator" },
  ];

  for (const source of sources) {
    const existing = await prisma.ingestionSource.findFirst({ where: { type: source.type } });
    if (!existing) {
      await prisma.ingestionSource.create({
        data: { name: source.name, type: source.type, isActive: false },
      });
    }
  }
  console.log("Seeded canonical ingestion sources (syslog, file_upload, demo_generator).");
}

async function seedDemoDomainData(ownerId: string): Promise<void> {
  const existingAssetCount = await prisma.asset.count();
  if (existingAssetCount > 0) {
    console.log("Demo domain data already present — skipping.");
    return;
  }

  const [webServer, dbServer, workstation, vpnGateway, , execLaptop] = await Promise.all([
    prisma.asset.create({
      data: {
        name: "web-prod-01",
        type: "server",
        ipAddress: "10.20.1.11",
        criticality: "high",
        tags: ["prod", "public-facing"],
      },
    }),
    prisma.asset.create({
      data: {
        name: "db-prod-01",
        type: "server",
        ipAddress: "10.20.1.20",
        criticality: "critical",
        tags: ["prod", "database"],
      },
    }),
    prisma.asset.create({
      data: {
        name: "DESKTOP-JDOE",
        type: "workstation",
        ipAddress: "10.30.4.52",
        criticality: "low",
        owner: "J. Doe",
      },
    }),
    prisma.asset.create({
      data: { name: "vpn-gateway", type: "network_device", ipAddress: "10.20.0.1", criticality: "high" },
    }),
    prisma.asset.create({
      data: {
        name: "s3-backup-bucket",
        type: "cloud_resource",
        criticality: "medium",
        tags: ["backup", "aws"],
      },
    }),
    prisma.asset.create({
      data: {
        name: "CEO-Laptop",
        type: "workstation",
        ipAddress: "10.30.1.5",
        criticality: "high",
        owner: "CEO",
      },
    }),
  ]);

  await prisma.vulnerability.createMany({
    data: [
      {
        title: "Log4Shell RCE",
        cveId: "CVE-2021-44228",
        severity: "critical",
        status: "open",
        assetId: webServer.id,
        description: "Remote code execution via JNDI lookup in bundled logging library.",
      },
      {
        title: "Outlook elevation of privilege",
        cveId: "CVE-2023-23397",
        severity: "high",
        status: "open",
        assetId: execLaptop.id,
      },
      {
        title: "SMBv1 remote code execution (EternalBlue)",
        cveId: "CVE-2017-0144",
        severity: "critical",
        status: "remediated",
        assetId: dbServer.id,
        remediatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Windows MSHTML remote code execution (Follina)",
        cveId: "CVE-2022-30190",
        severity: "high",
        status: "accepted_risk",
        assetId: workstation.id,
      },
      {
        title: "Netlogon elevation of privilege (Zerologon)",
        cveId: "CVE-2020-1472",
        severity: "critical",
        status: "open",
        assetId: vpnGateway.id,
      },
    ],
  });

  const threatActor = await prisma.threatActor.create({
    data: {
      name: "FIN-Shadow",
      aliases: ["ShadowSyndicate"],
      description:
        "Financially motivated group observed using commodity ransomware and credential harvesting.",
      sophistication: "intermediate",
    },
  });

  const [maliciousIp, c2Domain, maliciousHash] = await Promise.all([
    prisma.iOC.create({
      data: {
        type: "ip",
        value: "185.220.101.47",
        severity: "high",
        source: "internal_detection",
        threatActorId: threatActor.id,
      },
    }),
    prisma.iOC.create({
      data: {
        type: "domain",
        value: "update-service-cdn.net",
        severity: "critical",
        source: "threat_intel_feed",
        threatActorId: threatActor.id,
      },
    }),
    prisma.iOC.create({
      data: {
        type: "file_hash",
        value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85",
        severity: "medium",
        source: "edr",
      },
    }),
  ]);
  void maliciousIp;
  void maliciousHash;

  const techniqueId = (id: string) => mitreTechniques.find((t) => t.id === id)!.id;

  const bruteForceAlert = await prisma.alert.create({
    data: {
      title: "Brute force login attempts detected",
      description: `Multiple failed authentication attempts against ${vpnGateway.name} from a single source IP.`,
      severity: "high",
      status: "open",
      sourceIp: "185.220.101.47",
      assetId: vpnGateway.id,
      mitreMappings: { create: [{ mitreTechniqueId: techniqueId("T1110") }] },
    },
  });

  const mfaFatigueAlert = await prisma.alert.create({
    data: {
      title: "Repeated MFA push notifications outside business hours",
      description:
        "User received 14 MFA push prompts between 02:00–02:20 local time without initiating login.",
      severity: "medium",
      status: "open",
      assetId: execLaptop.id,
      mitreMappings: { create: [{ mitreTechniqueId: techniqueId("T1621") }] },
    },
  });

  const powershellAlert = await prisma.alert.create({
    data: {
      title: "Suspicious obfuscated PowerShell execution",
      description: "Base64-encoded PowerShell command spawned from an Office document macro.",
      severity: "critical",
      status: "open",
      assetId: workstation.id,
      mitreMappings: {
        create: [{ mitreTechniqueId: techniqueId("T1059") }, { mitreTechniqueId: techniqueId("T1027") }],
      },
    },
  });

  const encryptionAlert = await prisma.alert.create({
    data: {
      title: "Mass file encryption activity detected",
      description: "Unusual volume of file rename/write operations consistent with ransomware behavior.",
      severity: "critical",
      status: "open",
      assetId: dbServer.id,
      mitreMappings: { create: [{ mitreTechniqueId: techniqueId("T1486") }] },
    },
  });

  await prisma.alert.create({
    data: {
      title: "Outbound connection to known C2 domain",
      description: `Beaconing traffic observed to ${c2Domain.value}.`,
      severity: "critical",
      status: "acknowledged",
      assetId: webServer.id,
      assignedToId: ownerId,
      mitreMappings: {
        create: [{ mitreTechniqueId: techniqueId("T1071") }, { mitreTechniqueId: techniqueId("T1105") }],
      },
    },
  });

  const phishingAlert = await prisma.alert.create({
    data: {
      title: "Phishing email reported by user",
      description: "End user reported a suspicious invoice email containing a credential-harvesting link.",
      severity: "medium",
      status: "resolved",
      assetId: execLaptop.id,
      mitreMappings: { create: [{ mitreTechniqueId: techniqueId("T1566") }] },
    },
  });

  await prisma.alert.create({
    data: {
      title: "Process injection detected in browser process",
      description: "EDR flagged a code injection technique targeting a running browser process.",
      severity: "high",
      status: "open",
      assetId: workstation.id,
      mitreMappings: { create: [{ mitreTechniqueId: techniqueId("T1055") }] },
    },
  });

  await prisma.alert.create({
    data: {
      title: "Internal port scan detected",
      description: "Sequential connection attempts across a wide port range from an internal host.",
      severity: "low",
      status: "false_positive",
      assetId: dbServer.id,
      mitreMappings: { create: [{ mitreTechniqueId: techniqueId("T1046") }] },
    },
  });

  const credentialIncident = await prisma.incident.create({
    data: {
      title: "Suspected credential stuffing campaign",
      description: "Correlated brute-force and MFA-fatigue activity targeting the same executive account.",
      severity: "high",
      status: "investigating",
      assignedToId: ownerId,
      timelineEvents: {
        create: [
          { authorId: ownerId, eventType: "note", message: "Incident opened from correlated alerts." },
          {
            authorId: ownerId,
            eventType: "note",
            message: "Confirmed source IP is associated with known threat actor FIN-Shadow.",
          },
        ],
      },
    },
  });
  await prisma.alert.updateMany({
    where: { id: { in: [bruteForceAlert.id, mfaFatigueAlert.id] } },
    data: { incidentId: credentialIncident.id },
  });

  const ransomwareIncident = await prisma.incident.create({
    data: {
      title: "Active ransomware outbreak — db-prod-01",
      description:
        "Obfuscated PowerShell execution followed by mass file encryption on a production database host.",
      severity: "critical",
      status: "open",
      assignedToId: ownerId,
      timelineEvents: {
        create: [
          {
            authorId: ownerId,
            eventType: "note",
            message: "Host isolated from network pending investigation.",
          },
        ],
      },
    },
  });
  await prisma.alert.updateMany({
    where: { id: { in: [powershellAlert.id, encryptionAlert.id] } },
    data: { incidentId: ransomwareIncident.id },
  });

  const phishingIncident = await prisma.incident.create({
    data: {
      title: "Phishing incident — contained",
      description:
        "User-reported phishing email; no credentials were entered. Link blocked at the email gateway.",
      severity: "medium",
      status: "closed",
      assignedToId: ownerId,
      closedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      timelineEvents: {
        create: [
          { authorId: ownerId, eventType: "note", message: "Confirmed user did not submit credentials." },
          {
            authorId: ownerId,
            eventType: "status_change",
            message: "Status changed from investigating to closed",
          },
        ],
      },
    },
  });
  await prisma.alert.update({ where: { id: phishingAlert.id }, data: { incidentId: phishingIncident.id } });

  console.log(
    "Seeded demo domain data: 6 assets, 5 vulnerabilities, 1 threat actor, 3 IOCs, 8 alerts, 3 incidents.",
  );
}

async function main(): Promise<void> {
  const ownerId = await seedOwner();
  await seedMitreTechniques();
  await seedIngestionSources();
  await seedDemoDomainData(ownerId);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
