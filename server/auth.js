import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { prisma } from "./db.js";

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  avatarMime: true,
  defaultAudio: true,
  defaultSubtitle: true,
  theme: true,
  accentColor: true,
  density: true,
  subtitleFont: true,
  subtitleColor: true,
  subtitleBackground: true,
  subtitleOpacity: true,
  playbackSpeed: true,
  autoSkipIntro: true,
  autoSkipOutro: true,
  introSeconds: true,
  outroSeconds: true,
  subscriptionStatus: true,
  subscriptionCurrentPeriodEnd: true,
  createdAt: true,
  updatedAt: true
};

export function safeUserSelect() {
  return SAFE_USER_SELECT;
}

export function signSession(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    config.jwtSecret,
    {
      algorithm: "HS256",
      expiresIn: String(config.sessionDays) + "d",
      issuer: "aniwatch",
      audience: "aniwatch-web"
    }
  );
}

export function setSessionCookie(res, token) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax",
    path: "/",
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax",
    path: "/"
  });
}

export async function readSession(req) {
  const token = req.cookies?.[config.cookieName];
  if (!token) return null;

  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
      issuer: "aniwatch",
      audience: "aniwatch-web"
    });
    if (!payload || typeof payload.sub !== "string") return null;
    return await prisma.user.findUnique({
      where: { id: payload.sub },
      select: SAFE_USER_SELECT
    });
  } catch {
    return null;
  }
}

export async function optionalAuth(req, _res, next) {
  req.user = await readSession(req);
  next();
}

export async function requireAuth(req, res, next) {
  req.user = await readSession(req);
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required." });
  }
  next();
}

export function isPremium(user) {
  return user?.subscriptionStatus === "ACTIVE";
}

export function serializeUser(user) {
  if (!user) return null;
  return {
    ...user,
    avatarUrl: user.avatarMime ? "/api/profile/avatar/" + user.id : null,
    isPremium: isPremium(user)
  };
}
