import { config } from "dotenv";
import { resolve } from "path";
import { serve } from "@hono/node-server";
import app from "./index";

// Load .env.local for local development
config({ path: resolve(import.meta.dirname, "../../../.env.local") });

const port = Number(process.env.PORT) || 3000;

console.log(`🚀 Server is running on http://localhost:${port}`);
console.log("📝 Auto-create data directory enabled");

serve({
  fetch: app.fetch,
  port,
});
