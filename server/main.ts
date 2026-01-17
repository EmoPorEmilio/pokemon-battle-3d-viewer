import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { logger } from "@hono/hono/logger";
import { BattleManager } from "./battle_manager.ts";
import { createBattleRoutes } from "./routes/battles.ts";

const app = new Hono();
const battleManager = new BattleManager();

// Middleware
app.use("*", logger());
app.use("*", cors());

// API routes
app.route("/api/battles", createBattleRoutes(battleManager));

// Serve static files
app.get("/*", async (c) => {
  const path = c.req.path === "/" ? "/index.html" : c.req.path;
  try {
    const file = await Deno.readFile(`./public${path}`);
    const ext = path.split(".").pop() || "";
    const contentType: Record<string, string> = {
      html: "text/html",
      css: "text/css",
      js: "application/javascript",
      json: "application/json",
      png: "image/png",
      jpg: "image/jpeg",
      svg: "image/svg+xml",
    };
    return new Response(file, {
      headers: { "Content-Type": contentType[ext] || "application/octet-stream" },
    });
  } catch {
    return c.notFound();
  }
});

// Graceful shutdown
const shutdown = async () => {
  console.log("\nShutting down...");
  await battleManager.shutdown();
  Deno.exit(0);
};

Deno.addSignalListener("SIGINT", shutdown);
// SIGTERM is not supported on Windows
if (Deno.build.os !== "windows") {
  Deno.addSignalListener("SIGTERM", shutdown);
}

// Start server
const port = parseInt(Deno.env.get("PORT") ?? "8000");
console.log(`Pokemon Battle API starting on http://localhost:${port}`);

Deno.serve({ port }, app.fetch);
