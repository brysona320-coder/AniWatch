import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { api } from "./routes.js";
import { config } from "./config.js";
import { errorHandler, originGuard } from "./http.js";
import { prisma } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, contentSecurityPolicy: false }));
app.use(cookieParser());
app.use(originGuard);
app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 80,
  standardHeaders: "draft-8",
  legacyHeaders: false
}));
app.use((req, res, next) => {
  if (req.path === "/api/paypal/webhook") return next();
  express.json({ limit: "1mb" })(req, res, next);
});
app.use("/api", api);

app.get("/healthz", async (_req, res) => {
  await prisma.$queryRawUnsafe("SELECT 1");
  res.json({ ok: true });
});

app.use(express.static(root, {
  dotfiles: "ignore",
  etag: true,
  maxAge: config.production ? "1h" : 0,
  setHeaders(res, file) {
    if (file.endsWith("sw.js")) {
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Service-Worker-Allowed", "/");
    }
  }
}));

app.get("*", (_req, res) => res.sendFile(path.join(root, "index.html")));
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log("AniWatch listening on port " + config.port);
});

async function shutdown(signal) {
  console.log(signal + " received, shutting down.");
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
