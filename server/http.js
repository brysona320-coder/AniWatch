import { ZodError } from "zod";
import { config } from "./config.js";

export function asyncRoute(handler) {
  return function wrappedRoute(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function originGuard(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.path === "/api/paypal/webhook") return next();

  const origin = req.get("origin");
  if (!origin) return next();

  let allowed;
  try {
    allowed = new URL(config.appUrl).origin;
  } catch {
    allowed = "";
  }

  if (origin !== allowed) {
    return res.status(403).json({ error: "Cross-site request rejected." });
  }
  next();
}

export function notFound(req, res) {
  res.status(404).json({ error: "Not found." });
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: "Invalid request.",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  if (error?.code === "P2002") {
    return res.status(409).json({ error: "That value is already in use." });
  }

  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Avatar must be 2 MB or smaller." });
  }

  const status = Number(error?.status) || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: status >= 500 ? "Internal server error." : error.message
  });
}
