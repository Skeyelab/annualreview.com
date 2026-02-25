import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { runPipeline } from "./lib/run-pipeline.js";

function apiGeneratePlugin() {
  return {
    name: "api-generate",
    configureServer(server) {
      server.middlewares.use("/api/generate", (req, res, next) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          try {
            const evidence = JSON.parse(body);
            const result = await runPipeline(evidence);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: e.message || "Pipeline failed" }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiGeneratePlugin()],
});
