CREATE TYPE "SubscriptionStatus" AS ENUM ('FREE', 'APPROVAL_PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "ListVisibility" AS ENUM ('PRIVATE', 'PUBLIC');
CREATE TYPE "ThemeMode" AS ENUM ('DARK', 'LIGHT', 'CUSTOM');
CREATE TYPE "Density" AS ENUM ('COMPACT', 'COMFORTABLE', 'SPACIOUS');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "avatarData" BYTEA,
  "avatarMime" TEXT,
  "defaultAudio" TEXT NOT NULL DEFAULT 'japanese',
  "defaultSubtitle" TEXT NOT NULL DEFAULT 'english',
  "theme" "ThemeMode" NOT NULL DEFAULT 'DARK',
  "accentColor" TEXT NOT NULL DEFAULT '#8b5cf6',
  "density" "Density" NOT NULL DEFAULT 'COMFORTABLE',
  "subtitleFont" TEXT NOT NULL DEFAULT 'DM Sans',
  "subtitleColor" TEXT NOT NULL DEFAULT '#ffffff',
  "subtitleBackground" TEXT NOT NULL DEFAULT '#000000',
  "subtitleOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
  "playbackSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "autoSkipIntro" BOOLEAN NOT NULL DEFAULT false,
  "autoSkipOutro" BOOLEAN NOT NULL DEFAULT false,
  "introSeconds" INTEGER NOT NULL DEFAULT 90,
  "outroSeconds" INTEGER NOT NULL DEFAULT 90,
  "paypalSubscriptionId" TEXT,
  "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
  "subscriptionCurrentPeriodEnd" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Progress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mediaKey" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "animeId" TEXT NOT NULL,
  "episodeId" TEXT NOT NULL,
  "animeTitle" TEXT NOT NULL,
  "episodeTitle" TEXT,
  "episodeNumber" TEXT,
  "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "duration" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WatchList" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "visibility" "ListVisibility" NOT NULL DEFAULT 'PRIVATE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WatchList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListItem" (
  "id" TEXT NOT NULL,
  "listId" TEXT NOT NULL,
  "mediaKey" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "animeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "image" TEXT,
  "sourceUrl" TEXT,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppConfig" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_paypalSubscriptionId_key" ON "User"("paypalSubscriptionId");
CREATE UNIQUE INDEX "Progress_userId_mediaKey_key" ON "Progress"("userId", "mediaKey");
CREATE INDEX "Progress_userId_updatedAt_idx" ON "Progress"("userId", "updatedAt");
CREATE UNIQUE INDEX "WatchList_userId_slug_key" ON "WatchList"("userId", "slug");
CREATE INDEX "WatchList_userId_updatedAt_idx" ON "WatchList"("userId", "updatedAt");
CREATE UNIQUE INDEX "ListItem_listId_mediaKey_key" ON "ListItem"("listId", "mediaKey");
CREATE INDEX "ListItem_listId_addedAt_idx" ON "ListItem"("listId", "addedAt");

ALTER TABLE "Progress" ADD CONSTRAINT "Progress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchList" ADD CONSTRAINT "WatchList_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_listId_fkey"
  FOREIGN KEY ("listId") REFERENCES "WatchList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
