import "dotenv/config";
import { config } from "../shared/config.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const app = await buildApp();
  await app.listen({ port: config.server.port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
