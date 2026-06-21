
import axios from 'axios';
import { performance } from 'perf_hooks';

const BASE_URL = (process.env.SMARTAGS_BASE_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.SMARTAGS_ADMIN_EMAIL || 'admin@smartags.com';
const ADMIN_PASSWORD = process.env.SMARTAGS_ADMIN_PASSWORD || 'admin123';
const CONCURRENT_REQUESTS = Number(process.env.SMARTAGS_QA_CONCURRENCY || 50);

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};

const log = (agent: string, msg: string, type: 'INFO' | 'PASS' | 'FAIL' | 'WARN' = 'INFO') => {
    let color = colors.reset;
    switch (type) {
        case 'PASS': color = colors.green; break;
        case 'FAIL': color = colors.red; break;
        case 'WARN': color = colors.yellow; break;
        case 'INFO': color = colors.cyan; break;
    }
    console.log(`${colors.magenta}[${agent}]${colors.reset} ${color}[${type}] ${msg}${colors.reset}`);
};

interface TestContext {
    token: string;
    tenantId: string;
    screenId?: string;
    pairingCode?: string;
    screenToken?: string;
}

const ctx: TestContext = {
    token: '',
    tenantId: '',
};

async function login() {
    try {
        const res = await axios.post(`${BASE_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        ctx.token = res.data.token;
        ctx.tenantId = res.data.user.tenantId;
        log('Agent-0', `Logged in as Admin. TenantID: ${ctx.tenantId}`, 'PASS');
    } catch (e: any) {
        const errMsg = e.response?.data?.message || e.message;
        log('Agent-0', `Login Failed: ${errMsg}`, 'FAIL');
        process.exit(1);
    }
}

// AGENT-1: FUNCTIONAL TESTING
async function runFunctionalTests() {
    log('Agent-1', 'Starting Functional & Workflow Tests...');
    
    // 1. Generate Pairing Code
    try {
        const res = await axios.post(`${BASE_URL}/player/register`);
        ctx.pairingCode = res.data.code;
        ctx.screenId = res.data.screenId;
        log('Agent-1', `Generated Pairing Code: ${ctx.pairingCode} for Screen: ${ctx.screenId}`, 'PASS');
    } catch (e: any) {
        const msg = e.response?.data?.message || e.message;
        log('Agent-1', `Failed to register player: ${msg}`, 'FAIL');
    }

    // 2. Pair Screen (Admin Action)
    try {
        // Use the dedicated pair endpoint (POST /api/screens)
        await axios.post(`${BASE_URL}/screens`, {
            code: ctx.pairingCode,
            name: "QA Test Screen",
            location: "QA Lab",
            orientation: "LANDSCAPE",
            playerType: "BROWSER"
        }, {
            headers: { Authorization: `Bearer ${ctx.token}` }
        });
        log('Agent-1', `Paired Screen via /screens`, 'PASS');
    } catch (e: any) {
        const msg = e.response?.data?.message || e.message;
        log('Agent-1', `Failed to pair screen: ${msg}`, 'FAIL');
    }

    // 3. Player Check Status
    try {
        // Player Checks Status
        const pairRes = await axios.get(`${BASE_URL}/player/status/${ctx.pairingCode}`);
        if (pairRes.data.status === 'PAIRED') {
            ctx.screenToken = pairRes.data.token;
            log('Agent-1', `Player successfully paired and received token`, 'PASS');
        } else {
             log('Agent-1', `Player status is ${pairRes.data.status} (Expected PAIRED)`, 'WARN');
        }

    } catch (e: any) {
        log('Agent-1', `Pairing check failed: ${e.message}`, 'FAIL');
    }
}

// AGENT-2: LOAD TESTING
async function runLoadTests() {
    log('Agent-2', 'Starting Load & Concurrency Tests...');
    if (!ctx.screenToken) {
        log('Agent-2', 'Skipping load test (no valid screen token)', 'WARN');
        return;
    }

    log('Agent-2', `Simulating ${CONCURRENT_REQUESTS} concurrent heartbeats...`, 'INFO');

    const start = performance.now();
    const promises = [];
    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
        promises.push(
            axios.post(`${BASE_URL}/player/heartbeat`, { // No screenId in URL or Body, inferred from Token
                cpuTemp: 45 + (i % 5),
                freeDiskSpace: 1024000000,
                uptime: 100 + i
            }, {
                headers: { Authorization: `Bearer ${ctx.screenToken}` }
            }).catch(e => e) // Catch individual errors
        );
    }

    const results = await Promise.all(promises);
    const end = performance.now();
    const duration = end - start;
    
    const successes = results.filter(r => r.status === 200).length;
    const failures = results.length - successes;

    log('Agent-2', `Completed ${CONCURRENT_REQUESTS} requests in ${duration.toFixed(2)}ms`, 'INFO');
    log('Agent-2', `TPS (Transactions Per Second): ${(CONCURRENT_REQUESTS / (duration / 1000)).toFixed(2)}`, 'INFO');
    log('Agent-2', `Success: ${successes}, Failed: ${failures}`, failures > 0 ? 'WARN' : 'PASS');
}

// AGENT-3: STRESS TESTING
async function runStressTests() {
    log('Agent-3', 'Starting Stress & Failure Tests...');
    if (!ctx.screenToken) {
         log('Agent-3', 'Skipping stress test (no valid screen token)', 'WARN');
         return;
    }

    // 1. Malformed Payload
    try {
        await axios.post(`${BASE_URL}/player/heartbeat`, {
            cpuTemp: "HOT", // Invalid type
        }, {
             headers: { Authorization: `Bearer ${ctx.screenToken}` }
        });
        log('Agent-3', 'Server accepted invalid payload type (Expected 400/500)', 'WARN');
    } catch (e: any) {
        if (e.response && e.response.status >= 400) {
            log('Agent-3', `Server rejected invalid payload with ${e.response.status}`, 'PASS');
        } else {
            log('Agent-3', `Request failed with unexpected error: ${e.message}`, 'WARN');
        }
    }

    // 2. Huge Payload (Buffer Overflow / DoS attempt)
    try {
        const hugeString = "A".repeat(1024 * 1024 * 5); // 5MB string
        await axios.post(`${BASE_URL}/player/heartbeat`, {
            logs: hugeString
        }, {
             headers: { Authorization: `Bearer ${ctx.screenToken}` }
        });
        log('Agent-3', 'Server accepted 5MB payload', 'WARN');
    } catch (e: any) {
         if (e.response && (e.response.status === 413 || e.response.status === 500)) {
            log('Agent-3', `Server handled large payload: ${e.response.status}`, 'PASS');
         } else {
             log('Agent-3', `Large payload result: ${e.message}`, 'INFO');
         }
    }
}

// AGENT-4: SECURITY TESTING
async function runSecurityTests() {
    log('Agent-4', 'Starting Security & Access Control Tests...');

    // 1. No Token Access
    try {
        await axios.get(`${BASE_URL}/screens`);
        log('Agent-4', 'Public access to /screens allowed!', 'FAIL');
    } catch (e: any) {
        if (e.response && e.response.status === 401) {
            log('Agent-4', 'Unauthenticated access blocked (401)', 'PASS');
        }
    }

    // 2. IDOR Attempt (Accessing screen without being owner - tricky to simulate without 2nd tenant)
    // We will verify headers.
    try {
        const res = await axios.get(`${BASE_URL}/health`);
        const headers = res.headers;
        if (headers['x-powered-by']) {
            log('Agent-4', 'X-Powered-By header is present (Information Leakage)', 'WARN');
        } else {
            log('Agent-4', 'X-Powered-By header hidden', 'PASS');
        }
    } catch (e) {}
}

async function main() {
    log('Agent-0', 'Initializing Enterprise QA Suite...', 'INFO');
    await login();
    await runFunctionalTests();
    await runLoadTests();
    await runStressTests();
    await runSecurityTests();
    log('Agent-0', 'QA Suite Execution Complete.', 'INFO');
}

main();
