type RouteMetric = {
  count: number;
  errors: number;
  totalDurationMs: number;
  maxDurationMs: number;
};

class InMemoryMetrics {
  private readonly startedAt = Date.now();
  private readonly routeMetrics = new Map<string, RouteMetric>();
  private readonly counters = {
    heartbeats: 0,
    commandsQueued: 0,
    authFailures: 0,
    rateLimitHits: 0,
  };

  recordRequest(method: string, route: string, statusCode: number, durationMs: number) {
    const key = `${method.toUpperCase()} ${route}`;
    const current = this.routeMetrics.get(key) ?? {
      count: 0,
      errors: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
    };
    current.count += 1;
    current.totalDurationMs += durationMs;
    current.maxDurationMs = Math.max(current.maxDurationMs, durationMs);
    if (statusCode >= 500) {
      current.errors += 1;
    }
    this.routeMetrics.set(key, current);
  }

  recordHeartbeat() {
    this.counters.heartbeats += 1;
  }

  recordCommandQueued() {
    this.counters.commandsQueued += 1;
  }

  recordAuthFailure() {
    this.counters.authFailures += 1;
  }

  recordRateLimitHit() {
    this.counters.rateLimitHits += 1;
  }

  snapshot() {
    const routes = [...this.routeMetrics.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([route, metric]) => ({
        route,
        count: metric.count,
        errors: metric.errors,
        avgDurationMs: Number((metric.totalDurationMs / metric.count).toFixed(2)),
        maxDurationMs: Number(metric.maxDurationMs.toFixed(2)),
      }));

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      counters: { ...this.counters },
      process: {
        rssBytes: process.memoryUsage().rss,
        heapUsedBytes: process.memoryUsage().heapUsed,
        heapTotalBytes: process.memoryUsage().heapTotal,
      },
      routes,
    };
  }
}

export const appMetrics = new InMemoryMetrics();
