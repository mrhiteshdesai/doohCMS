import prisma from '../prisma';

type SystemSettingsRecord = Awaited<ReturnType<typeof prisma.systemSettings.findFirst>>;

const redactStorageSecrets = (settings: SystemSettingsRecord | {
  storage?: any;
  cdn?: any;
  traffic?: any;
}) => {
  const storage = settings?.storage && typeof settings.storage === 'object' ? settings.storage as any : {};
  return {
    ...settings,
    storage: {
      ...storage,
      accessKeyId: '',
      secretAccessKey: '',
      hasAccessKeyId: !!storage.accessKeyId,
      hasSecretAccessKey: !!storage.secretAccessKey,
    },
  };
};

const mergeStorageSecrets = (currentStorage: any, incomingStorage: any) => {
  const current = currentStorage && typeof currentStorage === 'object' ? currentStorage : {};
  const incoming = incomingStorage && typeof incomingStorage === 'object' ? incomingStorage : {};

  const next = {
    ...current,
    ...incoming,
  };

  if (typeof incoming.accessKeyId !== 'string' || !incoming.accessKeyId.trim()) {
    next.accessKeyId = current.accessKeyId;
  } else {
    next.accessKeyId = incoming.accessKeyId.trim();
  }

  if (typeof incoming.secretAccessKey !== 'string' || !incoming.secretAccessKey.trim()) {
    next.secretAccessKey = current.secretAccessKey;
  } else {
    next.secretAccessKey = incoming.secretAccessKey.trim();
  }

  delete next.hasAccessKeyId;
  delete next.hasSecretAccessKey;

  return next;
};

export const getSystemSettings = async () => {
  const settings = await prisma.systemSettings.findFirst();
  if (!settings) {
    return {
      storage: {
        provider: 'local',
        accessKeyId: '',
        secretAccessKey: '',
      },
      cdn: {
        enabled: false,
        baseUrl: ''
      },
      traffic: {
        downloadJitter: 0
      }
    };
  }
  return settings;
};

export const getSystemSettingsForAdmin = async () => {
  return redactStorageSecrets(await getSystemSettings());
};

export const updateSystemSettings = async (data: any) => {
  const current = await prisma.systemSettings.findFirst();
  const nextStorage = mergeStorageSecrets(current?.storage, data.storage);
  const nextCdn = data.cdn ?? current?.cdn ?? { enabled: false, baseUrl: '' };
  const nextTraffic = data.traffic ?? current?.traffic ?? { downloadJitter: 0 };

  if (current) {
    const updated = await prisma.systemSettings.update({
      where: { id: current.id },
      data: {
        storage: nextStorage,
        cdn: nextCdn,
        traffic: nextTraffic
      }
    });
    return redactStorageSecrets(updated);
  } else {
    const created = await prisma.systemSettings.create({
      data: {
        storage: nextStorage,
        cdn: nextCdn,
        traffic: nextTraffic
      }
    });
    return redactStorageSecrets(created);
  }
};

export const getRetentionPolicies = async () => {
  try {
    // Query TimescaleDB jobs to find retention policies
    const jobs: any[] = await prisma.$queryRaw`
      SELECT hypertable_name, config
      FROM timescaledb_information.jobs
      WHERE proc_name = 'policy_retention'
    `;

    const policies: Record<string, number> = {};

    jobs.forEach(job => {
      // config is a JSON object, e.g., {"drop_after": "30 days"}
      // We need to parse "30 days" to 30
      if (job.config && job.config.drop_after) {
        const match = job.config.drop_after.match(/(\d+)\s*days?/);
        if (match) {
          // Remove quotes from hypertable_name if present
          const tableName = job.hypertable_name.replace(/"/g, '');
          policies[tableName] = parseInt(match[1], 10);
        }
      }
    });

    return policies;
  } catch (error) {
    console.error('Error fetching retention policies:', error);
    return {};
  }
};

export const updateRetentionPolicy = async (tableName: string, days: number) => {
  const validTables = ['ScreenLog', 'ProofOfPlay', 'ScreenHeartbeat', 'AuditLog'];
  if (!validTables.includes(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }

  try {
    // 1. Remove existing policy (if any)
    await prisma.$executeRawUnsafe(`SELECT remove_retention_policy('"${tableName}"', if_exists => true);`);

    // 2. Add new policy if days > 0
    if (days > 0) {
      await prisma.$executeRawUnsafe(`SELECT add_retention_policy('"${tableName}"', INTERVAL '${days} days');`);
    }
    
    return { tableName, days, status: 'updated' };
  } catch (error: any) {
    throw new Error(`Failed to update retention policy for ${tableName}: ${error.message}`);
  }
};
