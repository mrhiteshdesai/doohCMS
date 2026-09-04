import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma';
import { sendCommand } from './screenService';

const uploadRoot = path.join(__dirname, '../../uploads');

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const sha256File = (filePath: string) => {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
};

const absoluteApkUrl = (reqHostBase: string | undefined, relativeOrAbsolute: string) => {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute;
  const base = (reqHostBase || '').replace(/\/$/, '');
  return `${base}${relativeOrAbsolute.startsWith('/') ? '' : '/'}${relativeOrAbsolute}`;
};

export const listReleases = async (tenantId: string) => {
  return prisma.appRelease.findMany({
    where: {
      OR: [{ tenantId }, { tenantId: null }],
    },
    orderBy: [{ versionCode: 'desc' }, { createdAt: 'desc' }],
  });
};

export const getRelease = async (id: string, tenantId: string) => {
  const release = await prisma.appRelease.findFirst({
    where: {
      id,
      OR: [{ tenantId }, { tenantId: null }],
    },
  });
  if (!release) throw new Error('Release not found');
  return release;
};

export const createReleaseFromUpload = async (params: {
  tenantId: string;
  userId?: string;
  file: Express.Multer.File;
  versionName: string;
  versionCode: number;
  notes?: string;
  minSdk?: number;
  publicBaseUrl?: string;
}) => {
  const { tenantId, userId, file, versionName, versionCode, notes, minSdk, publicBaseUrl } = params;
  if (!versionName?.trim()) throw new Error('versionName is required');
  if (!Number.isFinite(versionCode) || versionCode < 1) throw new Error('versionCode must be a positive integer');

  const releasesDir = path.join(uploadRoot, tenantId, 'releases');
  ensureDir(releasesDir);

  const destName = `v${versionCode}-${Date.now()}.apk`;
  const destPath = path.join(releasesDir, destName);
  fs.renameSync(file.path, destPath);

  const sha256 = sha256File(destPath);
  const relativeUrl = `/uploads/${tenantId}/releases/${destName}`;
  const apkUrl = absoluteApkUrl(publicBaseUrl, relativeUrl);

  return prisma.appRelease.create({
    data: {
      tenantId,
      versionName: versionName.trim(),
      versionCode: Math.trunc(versionCode),
      apkUrl,
      sha256,
      fileSize: BigInt(fs.statSync(destPath).size),
      minSdk: minSdk ?? null,
      notes: notes || null,
      createdBy: userId || null,
    },
  });
};

export const createReleaseFromUrl = async (params: {
  tenantId: string;
  userId?: string;
  apkUrl: string;
  versionName: string;
  versionCode: number;
  sha256?: string;
  notes?: string;
  minSdk?: number;
}) => {
  const { tenantId, userId, apkUrl, versionName, versionCode, notes, minSdk } = params;
  if (!apkUrl?.trim()) throw new Error('apkUrl is required');
  if (!versionName?.trim()) throw new Error('versionName is required');
  if (!Number.isFinite(versionCode) || versionCode < 1) throw new Error('versionCode must be a positive integer');

  let sha256 = (params.sha256 || '').trim().toLowerCase();
  let fileSize: bigint | null = null;

  if (!sha256) {
    const res = await fetch(apkUrl.trim());
    if (!res.ok) throw new Error(`Failed to download APK from URL (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    fileSize = BigInt(buf.length);

    const releasesDir = path.join(uploadRoot, tenantId, 'releases');
    ensureDir(releasesDir);
    const destName = `v${versionCode}-${Date.now()}-cdn.apk`;
    const destPath = path.join(releasesDir, destName);
    fs.writeFileSync(destPath, buf);
  }

  return prisma.appRelease.create({
    data: {
      tenantId,
      versionName: versionName.trim(),
      versionCode: Math.trunc(versionCode),
      apkUrl: apkUrl.trim(),
      sha256,
      fileSize,
      minSdk: minSdk ?? null,
      notes: notes || null,
      createdBy: userId || null,
    },
  });
};

export const deleteRelease = async (id: string, tenantId: string) => {
  const release = await getRelease(id, tenantId);
  await prisma.appUpdateEvent.deleteMany({ where: { releaseId: id } });
  await prisma.appRelease.delete({ where: { id: release.id } });
  return { ok: true };
};

const resolveTargetScreens = async (params: {
  tenantId: string;
  screenIds?: string[];
  groupId?: string;
  percent?: number;
}) => {
  const { tenantId, screenIds, groupId, percent } = params;
  let screens: { id: string; appVersion: string | null }[] = [];

  if (screenIds && screenIds.length > 0) {
    screens = await prisma.screen.findMany({
      where: { tenantId, id: { in: screenIds }, isDeleted: false },
      select: { id: true, appVersion: true },
    });
  } else if (groupId) {
    const members = await prisma.screenGroupMember.findMany({
      where: { groupId, group: { tenantId } },
      include: { screen: { select: { id: true, appVersion: true, isDeleted: true } } },
    });
    screens = members
      .filter((m) => m.screen && !m.screen.isDeleted)
      .map((m) => ({ id: m.screen.id, appVersion: m.screen.appVersion }));
  } else {
    screens = await prisma.screen.findMany({
      where: { tenantId, isDeleted: false, playerType: { contains: 'Android', mode: 'insensitive' } },
      select: { id: true, appVersion: true },
    });
    if (screens.length === 0) {
      screens = await prisma.screen.findMany({
        where: { tenantId, isDeleted: false },
        select: { id: true, appVersion: true },
      });
    }
  }

  if (percent != null && Number.isFinite(percent) && percent > 0 && percent < 100) {
    const count = Math.max(1, Math.ceil((screens.length * percent) / 100));
    screens = [...screens].sort((a, b) => a.id.localeCompare(b.id)).slice(0, count);
  }

  return screens;
};

export const rolloutRelease = async (params: {
  tenantId: string;
  releaseId: string;
  screenIds?: string[];
  groupId?: string;
  percent?: number;
  force?: boolean;
  publicBaseUrl?: string;
}) => {
  const release = await getRelease(params.releaseId, params.tenantId);
  const screens = await resolveTargetScreens({
    tenantId: params.tenantId,
    screenIds: params.screenIds,
    groupId: params.groupId,
    percent: params.percent,
  });

  if (screens.length === 0) {
    throw new Error('No target screens found for rollout');
  }

  const apkUrl = absoluteApkUrl(params.publicBaseUrl, release.apkUrl);
  const results: { screenId: string; commandId: string; eventId: string }[] = [];

  for (const screen of screens) {
    const updated = await sendCommand(screen.id, params.tenantId, 'UPDATE_APP', {
      versionName: release.versionName,
      versionCode: release.versionCode,
      apkUrl,
      sha256: release.sha256,
      force: !!params.force,
      releaseId: release.id,
    });

    const config = (updated.config as any) || {};
    const pending = config.pendingCommands || [];
    const cmd = pending[pending.length - 1] || (config.commandHistory || [])[0];
    const commandId = cmd?.id ? String(cmd.id) : `${Date.now()}`;

    const event = await prisma.appUpdateEvent.create({
      data: {
        tenantId: params.tenantId,
        screenId: screen.id,
        releaseId: release.id,
        commandId,
        targetVersion: release.versionName,
        targetCode: release.versionCode,
        fromVersion: screen.appVersion,
        status: 'QUEUED',
        message: 'UPDATE_APP queued',
      },
    });

    results.push({ screenId: screen.id, commandId, eventId: event.id });
  }

  return {
    release,
    targeted: results.length,
    results,
  };
};

export const recordUpdateEventFromHeartbeat = async (
  screenId: string,
  tenantId: string,
  update: { id?: string; status?: string; message?: string }
) => {
  if (!update?.id || !update.status) return;

  const existing = await prisma.appUpdateEvent.findFirst({
    where: { screenId, tenantId, commandId: String(update.id) },
    orderBy: { createdAt: 'desc' },
  });

  if (!existing) return;

  await prisma.appUpdateEvent.update({
    where: { id: existing.id },
    data: {
      status: String(update.status).toUpperCase(),
      message: update.message || existing.message,
    },
  });
};

export const getRolloutStatus = async (tenantId: string, releaseId?: string) => {
  const where: any = { tenantId };
  if (releaseId) where.releaseId = releaseId;

  const events = await prisma.appUpdateEvent.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 500,
    include: {
      release: {
        select: { id: true, versionName: true, versionCode: true },
      },
    },
  });

  const screens = await prisma.screen.findMany({
    where: { tenantId, isDeleted: false, id: { in: [...new Set(events.map((e) => e.screenId))] } },
    select: { id: true, name: true, appVersion: true, status: true, lastSeenAt: true },
  });
  const screenMap = new Map(screens.map((s) => [s.id, s]));

  const counts = {
    total: events.length,
    queued: 0,
    sent: 0,
    downloading: 0,
    installing: 0,
    completed: 0,
    failed: 0,
    other: 0,
  };

  const rows = events.map((e) => {
    const status = (e.status || '').toUpperCase();
    if (status === 'QUEUED' || status === 'PENDING') counts.queued += 1;
    else if (status === 'SENT') counts.sent += 1;
    else if (status === 'DOWNLOADING') counts.downloading += 1;
    else if (status === 'INSTALLING' || status === 'PROCESSING') counts.installing += 1;
    else if (status === 'COMPLETED') counts.completed += 1;
    else if (status === 'FAILED') counts.failed += 1;
    else counts.other += 1;

    const screen = screenMap.get(e.screenId);
    return {
      ...e,
      screenName: screen?.name || e.screenId,
      reportedAppVersion: screen?.appVersion || null,
      screenStatus: screen?.status || null,
      lastSeenAt: screen?.lastSeenAt || null,
      versionMatch:
        e.targetVersion && screen?.appVersion
          ? screen.appVersion.includes(e.targetVersion) || screen.appVersion === e.targetVersion
          : null,
    };
  });

  return { counts, events: rows };
};
