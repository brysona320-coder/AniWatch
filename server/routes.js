import express from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { z } from "zod";
import { prisma } from "./db.js";
import {
  clearSessionCookie,
  requireAuth,
  safeUserSelect,
  serializeUser,
  setSessionCookie,
  signSession
} from "./auth.js";
import { asyncRoute } from "./http.js";
import { config, publicConfig } from "./config.js";
import {
  applyWebhook,
  cancelSubscription,
  createSubscription,
  paypalConfigured,
  verifyWebhook
} from "./paypal.js";

export const api = express.Router();

const authSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(200)
});
const signupSchema = authSchema.extend({
  displayName: z.string().trim().min(1).max(60)
});
const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  defaultAudio: z.string().trim().min(1).max(30).optional(),
  defaultSubtitle: z.string().trim().min(1).max(30).optional(),
  theme: z.enum(["DARK", "LIGHT", "CUSTOM"]).optional(),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  density: z.enum(["COMPACT", "COMFORTABLE", "SPACIOUS"]).optional(),
  subtitleFont: z.string().trim().min(1).max(80).optional(),
  subtitleColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  subtitleBackground: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  subtitleOpacity: z.number().min(0).max(1).optional(),
  playbackSpeed: z.number().min(0.25).max(4).optional(),
  autoSkipIntro: z.boolean().optional(),
  autoSkipOutro: z.boolean().optional(),
  introSeconds: z.number().int().min(0).max(600).optional(),
  outroSeconds: z.number().int().min(0).max(600).optional()
}).strict();
const progressSchema = z.object({
  mediaKey: z.string().min(1).max(300),
  provider: z.string().min(1).max(50),
  animeId: z.string().min(1).max(200),
  episodeId: z.string().min(1).max(300),
  animeTitle: z.string().min(1).max(240),
  episodeTitle: z.string().max(240).optional().nullable(),
  episodeNumber: z.string().max(40).optional().nullable(),
  position: z.number().finite().min(0),
  duration: z.number().finite().min(0),
  completed: z.boolean().optional()
});
const listSchema = z.object({
  name: z.string().trim().min(1).max(80),
  visibility: z.enum(["PRIVATE", "PUBLIC"]).default("PRIVATE")
});
const itemSchema = z.object({
  mediaKey: z.string().min(1).max(300),
  provider: z.string().min(1).max(50),
  animeId: z.string().min(1).max(200),
  title: z.string().min(1).max(240),
  image: z.string().url().max(2000).optional().nullable(),
  sourceUrl: z.string().url().max(2000).optional().nullable()
});

function slug(value) {
  const clean = value.normalize("NFKD").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return clean || "list";
}
async function uniqueSlug(userId, name) {
  const base = slug(name);
  let candidate = base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const exists = await prisma.watchList.findUnique({
      where: { userId_slug: { userId, slug: candidate } },
      select: { id: true }
    });
    if (!exists) return candidate;
    candidate = base + "-" + suffix;
  }
  return base + "-" + Date.now();
}

api.get("/config", asyncRoute(async (req, res) => {
  let premium = false;
  const cookie = req.cookies?.[config.cookieName];
  if (cookie) {
    try {
      const jwt = await import("jsonwebtoken");
      const payload = jwt.default.verify(cookie, config.jwtSecret, {
        algorithms: ["HS256"], issuer: "aniwatch", audience: "aniwatch-web"
      });
      if (payload?.sub) {
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { subscriptionStatus: true }
        });
        premium = user?.subscriptionStatus === "ACTIVE";
      }
    } catch {}
  }
  const settings = publicConfig();
  settings.ads.enabled = settings.ads.enabled && !premium;
  res.json({
    ...settings,
    paypal: {
      configured: paypalConfigured(),
      price: config.paypal.price,
      currency: config.paypal.currency,
      planName: config.paypal.planName
    }
  });
}));

api.post("/auth/signup", asyncRoute(async (req, res) => {
  const input = signupSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      lists: {
        create: [
          { name: "Plan to Watch", slug: "plan-to-watch" },
          { name: "Favorites", slug: "favorites" }
        ]
      }
    },
    select: safeUserSelect()
  });
  setSessionCookie(res, signSession(user));
  res.status(201).json({ user: serializeUser(user) });
}));

api.post("/auth/login", asyncRoute(async (req, res) => {
  const input = authSchema.parse(req.body);
  const record = await prisma.user.findUnique({ where: { email: input.email } });
  if (!record || !(await bcrypt.compare(input.password, record.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  const user = await prisma.user.findUnique({
    where: { id: record.id },
    select: safeUserSelect()
  });
  setSessionCookie(res, signSession(user));
  res.json({ user: serializeUser(user) });
}));

api.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});
api.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

api.patch("/profile", requireAuth, asyncRoute(async (req, res) => {
  const input = profileSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: input,
    select: safeUserSelect()
  });
  res.json({ user: serializeUser(user) });
}));

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      const error = new Error("Use a JPEG, PNG, WebP, or GIF avatar.");
      error.status = 415;
      cb(error);
      return;
    }
    cb(null, true);
  }
});
api.put("/profile/avatar", requireAuth, avatarUpload.single("avatar"), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose an avatar." });
  await prisma.user.update({
    where: { id: req.user.id },
    data: { avatarData: req.file.buffer, avatarMime: req.file.mimetype }
  });
  res.json({ avatarUrl: "/api/profile/avatar/" + req.user.id + "?v=" + Date.now() });
}));
api.delete("/profile/avatar", requireAuth, asyncRoute(async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { avatarData: null, avatarMime: null }
  });
  res.status(204).end();
}));
api.get("/profile/avatar/:userId", asyncRoute(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: { avatarData: true, avatarMime: true }
  });
  if (!user?.avatarData || !user.avatarMime) return res.status(404).end();
  res.set({
    "Content-Type": user.avatarMime,
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff"
  });
  res.send(Buffer.from(user.avatarData));
}));

api.get("/progress", requireAuth, asyncRoute(async (req, res) => {
  const progress = await prisma.progress.findMany({
    where: { userId: req.user.id, completed: false },
    orderBy: { updatedAt: "desc" },
    take: 50
  });
  res.json({ progress });
}));
api.get("/progress/:mediaKey", requireAuth, asyncRoute(async (req, res) => {
  const progress = await prisma.progress.findUnique({
    where: { userId_mediaKey: { userId: req.user.id, mediaKey: req.params.mediaKey } }
  });
  res.json({ progress });
}));
api.put("/progress/:mediaKey", requireAuth, asyncRoute(async (req, res) => {
  const input = progressSchema.parse({ ...req.body, mediaKey: req.params.mediaKey });
  const completed = input.completed ?? (input.duration > 0 && input.position / input.duration >= 0.95);
  const progress = await prisma.progress.upsert({
    where: { userId_mediaKey: { userId: req.user.id, mediaKey: input.mediaKey } },
    update: { ...input, completed },
    create: { ...input, completed, userId: req.user.id }
  });
  res.json({ progress });
}));
api.delete("/progress/:mediaKey", requireAuth, asyncRoute(async (req, res) => {
  await prisma.progress.deleteMany({
    where: { userId: req.user.id, mediaKey: req.params.mediaKey }
  });
  res.status(204).end();
}));

api.get("/lists", requireAuth, asyncRoute(async (req, res) => {
  const lists = await prisma.watchList.findMany({
    where: { userId: req.user.id },
    include: { items: { orderBy: { addedAt: "desc" } } },
    orderBy: { updatedAt: "desc" }
  });
  res.json({ lists });
}));
api.post("/lists", requireAuth, asyncRoute(async (req, res) => {
  const input = listSchema.parse(req.body);
  const list = await prisma.watchList.create({
    data: {
      userId: req.user.id,
      name: input.name,
      visibility: input.visibility,
      slug: await uniqueSlug(req.user.id, input.name)
    }
  });
  res.status(201).json({ list });
}));
api.patch("/lists/:id", requireAuth, asyncRoute(async (req, res) => {
  const input = listSchema.partial().parse(req.body);
  const existing = await prisma.watchList.findFirst({
    where: { id: req.params.id, userId: req.user.id }
  });
  if (!existing) return res.status(404).json({ error: "List not found." });
  const data = { ...input };
  if (input.name && input.name !== existing.name) data.slug = await uniqueSlug(req.user.id, input.name);
  const list = await prisma.watchList.update({ where: { id: existing.id }, data });
  res.json({ list });
}));
api.delete("/lists/:id", requireAuth, asyncRoute(async (req, res) => {
  await prisma.watchList.deleteMany({
    where: { id: req.params.id, userId: req.user.id }
  });
  res.status(204).end();
}));
api.post("/lists/:id/items", requireAuth, asyncRoute(async (req, res) => {
  const input = itemSchema.parse(req.body);
  const list = await prisma.watchList.findFirst({
    where: { id: req.params.id, userId: req.user.id }
  });
  if (!list) return res.status(404).json({ error: "List not found." });
  const item = await prisma.listItem.upsert({
    where: { listId_mediaKey: { listId: list.id, mediaKey: input.mediaKey } },
    update: input,
    create: { ...input, listId: list.id }
  });
  res.status(201).json({ item });
}));
api.delete("/lists/:id/items/:mediaKey", requireAuth, asyncRoute(async (req, res) => {
  const list = await prisma.watchList.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true }
  });
  if (!list) return res.status(404).json({ error: "List not found." });
  await prisma.listItem.deleteMany({
    where: { listId: list.id, mediaKey: req.params.mediaKey }
  });
  res.status(204).end();
}));
api.get("/lists/public/:userId/:slug", asyncRoute(async (req, res) => {
  const list = await prisma.watchList.findFirst({
    where: {
      userId: req.params.userId,
      slug: req.params.slug,
      visibility: "PUBLIC"
    },
    include: {
      items: { orderBy: { addedAt: "desc" } },
      user: { select: { displayName: true } }
    }
  });
  if (!list) return res.status(404).json({ error: "List not found." });
  res.json({ list });
}));

api.post("/paypal/subscription", requireAuth, asyncRoute(async (req, res) => {
  const record = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (record.subscriptionStatus === "ACTIVE") {
    return res.status(409).json({ error: "Premium is already active." });
  }
  res.status(201).json(await createSubscription(record));
}));
api.delete("/paypal/subscription", requireAuth, asyncRoute(async (req, res) => {
  const record = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (record.paypalSubscriptionId) await cancelSubscription(record);
  await prisma.user.update({
    where: { id: req.user.id },
    data: { subscriptionStatus: "CANCELLED" }
  });
  res.status(204).end();
}));
api.post("/paypal/webhook", express.json({ type: "*/*", limit: "1mb" }), asyncRoute(async (req, res) => {
  const verified = await verifyWebhook(req.headers, req.body);
  if (!verified) return res.status(400).json({ error: "Invalid webhook." });
  await applyWebhook(req.body);
  res.status(204).end();
}));
