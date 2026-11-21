import { loadEnv } from "./config/env";
import { connectToDatabase } from "./db/connect";
import { CLIENT_DIST_DIR } from "./paths";
import { PRODUCTION_LIMITS } from "./security";
import { createGameServer } from "./server";

async function main(): Promise<void> {
  const env = loadEnv();
  await connectToDatabase(env.MONGO_URI);

  const production = env.NODE_ENV === "production";
  const server = createGameServer({
    clientUrl: env.CLIENT_URL,
    adminPassword: env.ADMIN_PASSWORD,
    // In production the same server also serves the built React app.
    // In development Vite serves it on its own port instead.
    clientDistDir: production ? CLIENT_DIST_DIR : undefined,
    // Only on the live site: a dev machine runs many tabs and test scripts from one IP.
    limits: production ? PRODUCTION_LIMITS : undefined,
    // Render puts a proxy in front of the app.
    behindProxy: production,
  });
  server.httpServer.listen(env.PORT, () => {
    if (production) {
      console.log(`Budget Draft (production) listening on port ${env.PORT}`);
    } else {
      console.log(`Budget Draft server on http://localhost:${env.PORT}`);
    }
  });

  // Ctrl+C / container stop: close sockets cleanly.
  const shutdown = () => {
    console.log("Shutting down…");
    server.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
