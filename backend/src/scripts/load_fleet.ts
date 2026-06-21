import axios from 'axios';
import { performance } from 'perf_hooks';

type LoadResult = {
  label: string;
  concurrency: number;
  requests: number;
  successes: number;
  failures: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  durationMs: number;
  throughputRps: number;
};

const config = {
  baseUrl: (process.env.SMARTAGS_BASE_URL || 'http://localhost:3000/api').replace(/\/+$/, ''),
  adminEmail: process.env.SMARTAGS_ADMIN_EMAIL || 'admin@smartags.com',
  adminPassword: process.env.SMARTAGS_ADMIN_PASSWORD || 'admin123',
  concurrencyStages: (process.env.SMARTAGS_LOAD_STAGES || '25,50,100,200')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0),
  requestsPerStage: Number(process.env.SMARTAGS_REQUESTS_PER_STAGE || 200),
  warnP95Ms: Number(process.env.SMARTAGS_WARN_P95_MS || 1000),
  failErrorRatePct: Number(process.env.SMARTAGS_FAIL_ERROR_RATE_PCT || 2),
};

const http = axios.create({
  timeout: 15000,
  maxBodyLength: 10 * 1024 * 1024,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const percentile = (values: number[], ratio: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
};

async function login() {
  const response = await http.post(`${config.baseUrl}/auth/login`, {
    email: config.adminEmail,
    password: config.adminPassword,
  });
  return response.data.token as string;
}

async function registerPlayer() {
  const response = await http.post(`${config.baseUrl}/player/register`);
  return response.data as { code: string; screenId: string };
}

async function pairScreen(adminToken: string, code: string, name: string) {
  await http.post(
    `${config.baseUrl}/screens`,
    {
      code,
      name,
      location: 'Load Test Lab',
      orientation: 'LANDSCAPE',
      playerType: 'BROWSER',
    },
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );
}

async function fetchScreenToken(code: string) {
  const response = await http.get(`${config.baseUrl}/player/status/${code}`);
  if (response.data.status !== 'PAIRED' || !response.data.token) {
    throw new Error(`Player ${code} was not paired successfully`);
  }
  return response.data.token as string;
}

async function createLoadPlayers(adminToken: string, count: number) {
  const players: Array<{ screenId: string; token: string }> = [];
  for (let index = 0; index < count; index += 1) {
    const registration = await registerPlayer();
    await pairScreen(adminToken, registration.code, `Load Test Screen ${index + 1}`);
    const token = await fetchScreenToken(registration.code);
    players.push({ screenId: registration.screenId, token });
    await sleep(20);
  }
  return players;
}

async function runHeartbeatStage(label: string, playerTokens: string[], concurrency: number, requests: number): Promise<LoadResult> {
  const latencies: number[] = [];
  let successes = 0;
  let failures = 0;
  let cursor = 0;
  const start = performance.now();

  const worker = async () => {
    while (true) {
      const requestIndex = cursor;
      cursor += 1;
      if (requestIndex >= requests) {
        return;
      }

      const token = playerTokens[requestIndex % playerTokens.length];
      const payload = {
        cpuTemp: 44 + (requestIndex % 5),
        freeStorageBytes: 4_500_000_000,
        totalStorageBytes: 8_000_000_000,
        memoryUsedBytes: 512_000_000,
        memoryTotalBytes: 2_048_000_000,
        appVersion: 'load-test',
        currentPlaylistId: 'synthetic',
        playbackState: 'PLAYING',
      };

      const heartbeatStart = performance.now();
      try {
        await http.post(`${config.baseUrl}/player/heartbeat`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        successes += 1;
        latencies.push(performance.now() - heartbeatStart);
      } catch (error) {
        failures += 1;
      }
    }
  };

  await Promise.all(
    Array.from({ length: concurrency }, () => worker())
  );

  const durationMs = performance.now() - start;
  return {
    label,
    concurrency,
    requests,
    successes,
    failures,
    avgLatencyMs: latencies.length ? Number((latencies.reduce((sum, value) => sum + value, 0) / latencies.length).toFixed(2)) : 0,
    p95LatencyMs: Number(percentile(latencies, 0.95).toFixed(2)),
    durationMs: Number(durationMs.toFixed(2)),
    throughputRps: Number((requests / (durationMs / 1000)).toFixed(2)),
  };
}

function printResult(result: LoadResult) {
  const errorRate = result.requests === 0 ? 0 : (result.failures / result.requests) * 100;
  const status =
    errorRate > config.failErrorRatePct || result.p95LatencyMs > config.warnP95Ms ? 'WARN' : 'PASS';
  console.log(
    JSON.stringify(
      {
        status,
        ...result,
        errorRatePct: Number(errorRate.toFixed(2)),
      },
      null,
      2
    )
  );
}

async function main() {
  console.log(`Using base URL: ${config.baseUrl}`);
  console.log(`Load stages: ${config.concurrencyStages.join(', ')}`);
  console.log(`Requests per stage: ${config.requestsPerStage}`);

  const adminToken = await login();
  const maxPlayers = Math.max(...config.concurrencyStages);
  const players = await createLoadPlayers(adminToken, maxPlayers);
  const playerTokens = players.map((player) => player.token);

  const results: LoadResult[] = [];
  for (const concurrency of config.concurrencyStages) {
    const result = await runHeartbeatStage(
      `heartbeat-${concurrency}`,
      playerTokens.slice(0, concurrency),
      concurrency,
      config.requestsPerStage
    );
    results.push(result);
    printResult(result);
    await sleep(500);
  }

  const maxFailureRate = Math.max(...results.map((result) => (result.failures / result.requests) * 100));
  const maxP95 = Math.max(...results.map((result) => result.p95LatencyMs));
  if (maxFailureRate > config.failErrorRatePct) {
    throw new Error(`Load test failed: error rate ${maxFailureRate.toFixed(2)}% exceeded ${config.failErrorRatePct}%`);
  }
  if (maxP95 > config.warnP95Ms) {
    throw new Error(`Load test failed: p95 ${maxP95.toFixed(2)}ms exceeded ${config.warnP95Ms}ms`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
