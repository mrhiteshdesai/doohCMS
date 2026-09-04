import { Request, Response } from 'express';
import * as appReleaseService from '../services/appReleaseService';

const publicBaseUrl = (req: Request) => {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = req.get('host');
  return host ? `${proto}://${host}` : undefined;
};

export const listReleases = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const releases = await appReleaseService.listReleases(tenantId);
    res.json(releases);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getRelease = async (req: Request, res: Response) => {
  try {
    const release = await appReleaseService.getRelease(req.params.id, req.user!.tenantId);
    res.json(release);
  } catch (error: any) {
    res.status(404).json({ message: error.message });
  }
};

export const createReleaseUpload = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'APK file is required' });
    }
    const versionName = String(req.body.versionName || '').trim();
    const versionCode = Number(req.body.versionCode);
    const notes = req.body.notes ? String(req.body.notes) : undefined;
    const minSdk = req.body.minSdk != null ? Number(req.body.minSdk) : undefined;

    const release = await appReleaseService.createReleaseFromUpload({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      file: req.file,
      versionName,
      versionCode,
      notes,
      minSdk: Number.isFinite(minSdk as number) ? (minSdk as number) : undefined,
      publicBaseUrl: publicBaseUrl(req),
    });
    res.status(201).json(release);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const createReleaseUrl = async (req: Request, res: Response) => {
  try {
    const { apkUrl, versionName, versionCode, sha256, notes, minSdk } = req.body || {};
    const release = await appReleaseService.createReleaseFromUrl({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      apkUrl,
      versionName,
      versionCode: Number(versionCode),
      sha256,
      notes,
      minSdk: minSdk != null ? Number(minSdk) : undefined,
    });
    res.status(201).json(release);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteRelease = async (req: Request, res: Response) => {
  try {
    const result = await appReleaseService.deleteRelease(req.params.id, req.user!.tenantId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const rolloutRelease = async (req: Request, res: Response) => {
  try {
    const { screenIds, groupId, percent, force } = req.body || {};
    const result = await appReleaseService.rolloutRelease({
      tenantId: req.user!.tenantId,
      releaseId: req.params.id,
      screenIds,
      groupId,
      percent: percent != null ? Number(percent) : undefined,
      force: !!force,
      publicBaseUrl: publicBaseUrl(req),
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getRolloutStatus = async (req: Request, res: Response) => {
  try {
    const releaseId = req.query.releaseId ? String(req.query.releaseId) : undefined;
    const status = await appReleaseService.getRolloutStatus(req.user!.tenantId, releaseId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
