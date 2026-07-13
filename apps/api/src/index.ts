import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = buildApp();

async function start(): Promise<void> {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

process.on("SIGTERM", async () => {
  await app.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await app.close();
  process.exit(0);
});

void start();
