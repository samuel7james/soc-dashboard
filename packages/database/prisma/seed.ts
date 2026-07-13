import { hashPassword } from "@soc/auth";

import { prisma } from "../src/index.js";

async function main(): Promise<void> {
  const email = process.env.SEED_OWNER_EMAIL ?? "owner@soc.local";
  const password = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe123!";

  const passwordHash = await hashPassword(password);

  const owner = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: "Platform Owner",
      role: "owner",
    },
  });

  console.log(`Seeded owner user: ${owner.email} (id: ${owner.id})`);
  if (!process.env.SEED_OWNER_PASSWORD) {
    console.log(`Default password: ${password} — change this immediately outside local dev.`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
