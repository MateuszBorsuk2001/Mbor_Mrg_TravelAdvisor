import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Compose default placeholder — not registered inside n8n until you paste a UI-created key here. */
const COMPOSE_FALLBACK_API_KEY = 'dev-travel-advisor-n8n-api';

function stripWrappingQuotes(s) {
  return s.replace(/^['"]+|['"]+$/g, '');
}

/** Safe key load: trim whitespace, strip wrapping quotes; optional path for secrets. */
function loadN8nApiKeyBinding() {
  const filePath = (process.env.N8N_API_KEY_FILE || '').trim();
  if (filePath) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const key = stripWrappingQuotes(raw.trim());
      return {
        key,
        source: 'file',
        envHadBoundaryWhitespaceOnly: false,
      };
    } catch {
      console.warn('[n8n-flow-monitor] N8N_API_KEY_FILE could not be read:', filePath);
    }
  }
  const rawEnv = process.env.N8N_API_KEY ?? '';
  const key = stripWrappingQuotes(rawEnv.trim());
  return {
    key,
    source: rawEnv.trim() === '' ? 'none' : 'env',
    envHadBoundaryWhitespaceOnly: rawEnv !== '' && rawEnv !== rawEnv.trim(),
  };
}

const _apiBind = loadN8nApiKeyBinding();
const N8N_API_KEY = _apiBind.key;
const API_KEY_BOUNDARY_TRIM = _apiBind.envHadBoundaryWhitespaceOnly;
const API_KEY_SOURCE = _apiBind.source;

const N8N_BASE_URL = (process.env.N8N_INTERNAL_URL || process.env.N8N_BASE_URL || 'http://localhost:5678').replace(/\/$/, '');
/** Match `n8n` service Basic Auth header when `N8N_BASIC_AUTH_*` guards the deployment. */
const N8N_BASIC_USER = (process.env.N8N_BASIC_AUTH_USER || '').trim();
const N8N_BASIC_PASSWORD = process.env.N8N_BASIC_AUTH_PASSWORD ?? '';

const WORKFLOW_NAME = process.env.N8N_FLOW_MONITOR_WORKFLOW_NAME || 'Travel Search';
const POLL_MS = Math.max(250, Number(process.env.N8N_FLOW_MONITOR_POLL_MS) || 400);
const EXECUTION_LIST_LIMIT = Math.min(20, Math.max(1, Number(process.env.N8N_FLOW_MONITOR_LIST_LIMIT) || 8));
const EXECUTION_DETAIL_LIMIT = Math.min(10, Math.max(1, Number(process.env.N8N_FLOW_MONITOR_DETAIL_LIMIT) || 3));

function n8nHeaders() {
  const h = { Accept: 'application/json' };
  if (N8N_API_KEY) h['X-N8N-API-KEY'] = N8N_API_KEY;
  if (N8N_BASIC_USER.length) {
    const b64 = Buffer.from(`${N8N_BASIC_USER}:${N8N_BASIC_PASSWORD}`, 'utf8').toString('base64');
    h.Authorization = `Basic ${b64}`;
  }
  return h;
}

async function n8nFetch(pathAndQuery) {
  const url = `${N8N_BASE_URL}${pathAndQuery.startsWith('/') ? '' : '/'}${pathAndQuery}`;
  const res = await fetch(url, { headers: n8nHeaders() });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _parseError: true, raw: text };
  }
  if (!res.ok) {
    const err = new Error(body?.message || `n8n HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/** Resolved workflow UUID (from env verification or REST list/detail). Cached after first success. */
let resolvedWorkflowId = null;

function n8nForbiddenHint(e, suffix = '') {
  const tail =
    'The API key is accepted but cannot read this resource (n8n 2.x scopes or workflow/project access). Grant the key workflow + execution read permissions, ensure the key owner can open the workflow, or set N8N_FLOW_MONITOR_WORKFLOW_ID to the UUID from the workflow editor URL.';
  const mid = suffix ? ` ${suffix} ` : ' ';
  const err = new Error(`${(e.message || 'Forbidden').trim()}${mid}${tail}`);
  err.code = 'N8N_FORBIDDEN';
  err.detail = e.body ?? null;
  err.statusFromN8n = e.status;
  return err;
}

/** n8n returns 401 when X-N8N-API-KEY is missing, wrong, or not registered — not the same as 403 RBAC. */
function n8nUnauthorizedError(e) {
  const base = (e.message || 'Unauthorized').trim();
  const tail =
    'This n8n instance rejected X-N8N-API-KEY. In n8n 2.x create a key in Settings → n8n API → Create API key, put that exact secret in Docker env `N8N_API_KEY` for `n8n-flow-monitor`, then recreate the container (`docker compose up -d --force-recreate n8n-flow-monitor`). The fallback string `dev-travel-advisor-n8n-api` in compose is not registered in n8n until you recreate the key manually in UI and overwrite it (project-root `.env` is safest). Surrounding spaces/quotes in `.env` are trimmed here; optionally use env `N8N_API_KEY_FILE` pointing at a mounted file.';
  const err = new Error(`${base}. ${tail}`);
  err.code = 'N8N_UNAUTHORIZED';
  err.detail = e.body ?? null;
  err.statusFromN8n = 401;
  return err;
}

function monitorErrorHttpStatus(e) {
  if (e.code === 'WORKFLOW_NOT_FOUND') return 404;
  if (e.code === 'N8N_UNAUTHORIZED') return 401;
  if (e.code === 'N8N_FORBIDDEN') return 403;
  if (e.status === 401) return 401;
  if (e.status === 403) return 403;
  return 500;
}

function monitorClientHint(httpStatus) {
  if (httpStatus === 401) {
    return '401 means n8n does not recognise this secret: create Settings → n8n API → copy key → set `N8N_API_KEY` in project `.env`, then `docker compose up -d --force-recreate n8n-flow-monitor`. Check `/api/health` for apiKey.byteLength (>0) and that you are not still on compose placeholder.';
  }
  if (httpStatus === 403) {
    return 'The key works but lacks access: widen API scopes / workflow permissions, or set N8N_FLOW_MONITOR_WORKFLOW_ID to the workflow UUID from the browser URL.';
  }
  return undefined;
}

function normalizeWorkflowNameMatch(nameA, expected) {
  const a = (nameA || '').trim().toLowerCase();
  const b = (expected || '').trim().toLowerCase();
  return a === b;
}

async function resolveWorkflowId() {
  if (resolvedWorkflowId) return resolvedWorkflowId;

  const envId = (process.env.N8N_FLOW_MONITOR_WORKFLOW_ID || '').trim();
  if (envId) {
    try {
      await n8nFetch(`/api/v1/workflows/${encodeURIComponent(envId)}`);
      resolvedWorkflowId = envId;
      return resolvedWorkflowId;
    } catch (e) {
      if (e.status === 401) throw n8nUnauthorizedError(e);
      if (e.status === 403) throw n8nForbiddenHint(e, '(configured N8N_FLOW_MONITOR_WORKFLOW_ID).');
      throw e;
    }
  }

  /** Many n8n builds support filtering by workflow name (reduces paging). */
  try {
    const filtered = await n8nFetch(
      `/api/v1/workflows?limit=100&name=${encodeURIComponent(WORKFLOW_NAME)}`
    );
    const list = Array.isArray(filtered?.data) ? filtered.data : [];
    const hit = list.find((w) => normalizeWorkflowNameMatch(w?.name, WORKFLOW_NAME));
    if (hit?.id) {
      resolvedWorkflowId = hit.id;
      return resolvedWorkflowId;
    }
  } catch (e) {
    if (e.status === 401) throw n8nUnauthorizedError(e);
    if (e.status === 403) throw n8nForbiddenHint(e);
    /* ignore other filter failures; paginate instead */
  }

  /** Workflow list responses are paginated — first page may omit "Travel Search". */
  let cursor = '';
  while (true) {
    const path =
      cursor === ''
        ? `/api/v1/workflows?limit=250`
        : `/api/v1/workflows?limit=250&cursor=${encodeURIComponent(cursor)}`;
    let data;
    try {
      data = await n8nFetch(path);
    } catch (e) {
      if (e.status === 401) throw n8nUnauthorizedError(e);
      if (e.status === 403) throw n8nForbiddenHint(e);
      throw e;
    }
    const page = Array.isArray(data?.data) ? data.data : [];
    const found = page.find((w) => normalizeWorkflowNameMatch(w?.name, WORKFLOW_NAME));
    if (found?.id) {
      resolvedWorkflowId = found.id;
      return resolvedWorkflowId;
    }
    const next = data?.nextCursor;
    if (!next || !page.length) break;
    cursor = next;
  }

  const err = new Error(
    `Workflow "${WORKFLOW_NAME}" not found via API (paginated). Import and activate it in n8n, or set env N8N_FLOW_MONITOR_WORKFLOW_ID to its UUID from the editor URL / startup logs.`
  );
  err.code = 'WORKFLOW_NOT_FOUND';
  throw err;
}

/** Pull ISourceData-like refs from serialized `task.source` (nested arrays / main buckets). */
function collectSourceRefs(source, out = []) {
  if (source === null || source === undefined) return out;
  if (Array.isArray(source)) {
    for (const s of source) collectSourceRefs(s, out);
    return out;
  }
  if (typeof source === 'object') {
    if (typeof source.previousNode === 'string' && source.previousNode) {
      out.push(source);
      return out;
    }
    for (const v of Object.values(source)) collectSourceRefs(v, out);
  }
  return out;
}

/** Per node, ordered list of `{ runOrdinal, executionIndex, startTime, output }`. */
function buildRunsByNode(timelineRows, maps) {
  const byNode = new Map();
  for (const row of timelineRows) {
    const name = row.nodeName;
    if (!byNode.has(name)) byNode.set(name, []);
    const list = byNode.get(name);
    const runOrdinal = list.length;
    list.push({
      runOrdinal,
      executionIndex: row.executionIndex ?? 0,
      startTime: row.startTime ?? 0,
      output: row.output ?? row.data ?? null,
    });
  }

  /** Map UUID ⇄ canvas name when runData keys differ from lineage `previousNode` strings */
  if (maps?.byId && maps.byName && byNode.size) {
    for (const [key, list] of [...byNode.entries()]) {
      if (!key || key === 'undefined') continue;
      const fromId = maps.byId.get(key);
      if (fromId?.name && typeof fromId.name === 'string' && !byNode.has(fromId.name)) {
        byNode.set(fromId.name, list);
      }
      const fromName = maps.byName.get(key);
      if (fromName?.id && typeof fromName.id === 'string' && !byNode.has(fromName.id)) {
        byNode.set(fromName.id, list);
      }
    }
  }

  return byNode;
}

function pickBranchFromOutput(outputConnections, branchIndex) {
  if (!outputConnections || typeof outputConnections !== 'object') return outputConnections ?? null;
  const m = outputConnections.main;
  if (!Array.isArray(m)) return outputConnections;
  const bi =
    typeof branchIndex === 'number' && branchIndex >= 0 && branchIndex < m.length
      ? branchIndex
      : 0;
  return { __pickedFromParentBranch: bi, main: [m[bi]] };
}

/** Try to grab parent output bundles referenced by task.source → best-effort "what entered this node". */
function resolvedInputsFromSource(source, runsByNode) {
  const refs = collectSourceRefs(source);
  if (!refs.length) return null;
  const parts = [];
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    const parentRuns = runsByNode.get(ref.previousNode);
    if (!parentRuns?.length) {
      parts.push({
        slot: i,
        ref,
        matched: false,
        reason: `No runs found for upstream node "${ref.previousNode}".`,
      });
      continue;
    }
    let ord =
      typeof ref.previousNodeRun === 'number' && ref.previousNodeRun >= 0
        ? ref.previousNodeRun
        : parentRuns.length - 1;
    ord = Math.min(ord, parentRuns.length - 1);
    const entry = parentRuns[ord];
    if (!entry) {
      parts.push({ slot: i, ref, matched: false, reason: `parent run ${ord} missing` });
      continue;
    }
    const outIdx = typeof ref.previousNodeOutput === 'number' ? ref.previousNodeOutput : 0;
    parts.push({
      slot: i,
      ref,
      matched: true,
      parentRunOrdinalUsed: ord,
      parentExecutionIndex: entry.executionIndex,
      inferredInputSnippet: pickBranchFromOutput(entry.output, outIdx),
    });
  }
  return { refs, resolutions: parts };
}

/** Workflow nodes indexed for resolving runData keys (often UUID in n8n 2.x). */
function buildWorkflowNodeMaps(workflowData) {
  const byId = new Map();
  const byName = new Map();
  const nodes = Array.isArray(workflowData?.nodes) ? workflowData.nodes : [];
  for (const n of nodes) {
    if (n?.id) byId.set(n.id, n);
    if (n?.name) byName.set(n.name, n);
  }
  return { byId, byName };
}

function pickNodeNameFromRunTask(run) {
  if (!run || typeof run !== 'object') return '';
  const metaObj =
    typeof run.metadata === 'object' && run.metadata !== null
      ? run.metadata
      : typeof run.meta === 'object' && run.meta !== null
        ? run.meta
        : null;
  const cands = [
    run.name,
    run.node?.name,
    metaObj?.nodeName,
    metaObj?.name,
    metaObj?.displayName,
  ];
  for (const c of cands) {
    if (typeof c === 'string' && c.trim() !== '' && c !== 'undefined') return c.trim();
  }
  return '';
}

/** runData maps are keyed by node name OR node id depending on version; align with workflow for readable cards. */
function timelineNodeCardLabel(runDataKey, run, maps) {
  const key = typeof runDataKey === 'string' ? runDataKey : String(runDataKey ?? '').trim();

  const fromTask = pickNodeNameFromRunTask(run);
  if (fromTask) return fromTask;

  if (key && key !== 'undefined') {
    if (maps.byName.has(key)) return key;
    const byIdHit = maps.byId.get(key);
    if (byIdHit?.name && typeof byIdHit.name === 'string') return byIdHit.name;
    if (/^[0-9a-f-]{36}$/i.test(key)) return `Workflow node (${key.slice(0, 8)}…)`;
    return key;
  }

  return '(unnamed node)';
}

/** Flatten n8n runData into a stable timeline for the UI */
function flattenRunData(runData, workflowData) {
  const maps = buildWorkflowNodeMaps(workflowData);
  if (!runData || typeof runData !== 'object') return [];
  const rows = [];
  for (const [nodeName, runs] of Object.entries(runData)) {
    if (!Array.isArray(runs)) continue;
    runs.forEach((run, runIndex) => {
      const output = run?.data ?? null;
      const cardTitle = timelineNodeCardLabel(nodeName, run, maps);
      rows.push({
        /** Key as stored under resultData.runData — must align with lineage references */
        nodeName,
        nodeDisplayName: cardTitle,
        runIndex,
        startTime: run?.startTime ?? 0,
        executionIndex: run?.executionIndex ?? 0,
        executionStatus: run?.executionStatus,
        executionTimeMs: typeof run?.executionTime === 'number' ? run.executionTime : null,
        error: run?.error,
        /** OUT: wires from this node (n8n ITaskData.data) */
        output,
        /** Back-compat alias */
        data: output,
        /** IN lineage (n8n ITaskStartedData.source) — may not include full payloads */
        source: run?.source ?? null,
        /** IN override fragment when node overrides input item(s) */
        inputOverride: run?.inputOverride ?? null,
        hints: run?.hints ?? null,
        metadata: run?.metadata ?? null,
      });
    });
  }
  rows.sort(
    (a, b) =>
      (a.startTime - b.startTime) ||
      (a.executionIndex - b.executionIndex) ||
      String(a.nodeDisplayName || a.nodeName).localeCompare(String(b.nodeDisplayName || b.nodeName))
  );
  const runsByNode = buildRunsByNode(rows, maps);
  for (const row of rows) {
    row.resolvedUpstream = resolvedInputsFromSource(row.source, runsByNode);
  }
  return rows;
}

function unwrapExecution(payload) {
  const layer = payload?.data ?? payload;
  /** Some responses wrap the entity twice */
  if (layer?.data && typeof layer.data === 'object' && (layer.data.id != null || layer.data.resultData)) {
    return layer.data;
  }
  return layer;
}

/** n8n 2.x / API variants nest resultData differently */
function getExecutionResultData(exec) {
  if (!exec || typeof exec !== 'object') return null;
  const d = exec.data;
  if (d?.resultData) return d.resultData;
  if (d?.data?.resultData) return d.data.resultData;
  if (exec.resultData && typeof exec.resultData === 'object') return exec.resultData;
  return null;
}

function getRunDataFromExecution(exec) {
  return getExecutionResultData(exec)?.runData ?? null;
}

function getWorkflowDataBundle(exec) {
  return (
    exec.workflowData ||
    (exec.data && exec.data.workflowData) ||
    getExecutionResultData(exec)?.workflowData ||
    null
  );
}

function coerceExecutionId(exec, fallbackFromRoute) {
  if (!exec || typeof exec !== 'object') return fallbackFromRoute ?? undefined;
  const v =
    exec.id ??
    exec.executionId ??
    exec.data?.id ??
    exec.data?.executionId;
  if (v != null) return String(v);
  return fallbackFromRoute != null ? String(fallbackFromRoute) : undefined;
}

function summarizeExecution(exec, idFallback) {
  if (!exec || typeof exec !== 'object') return null;
  const rd = getRunDataFromExecution(exec);
  const wf = getWorkflowDataBundle(exec);
  const resultData = getExecutionResultData(exec);
  const timeline = flattenRunData(rd, wf);
  const id = coerceExecutionId(exec, idFallback);
  return {
    id,
    finished: exec.finished,
    mode: exec.mode,
    retryOf: exec.retryOf,
    retrySuccessId: exec.retrySuccessId,
    status: exec.status ?? exec.data?.status,
    startedAt: exec.startedAt,
    stoppedAt: exec.stoppedAt,
    workflowId: exec.workflowId,
    workflowData: wf,
    meta: resultData?.metadata,
    lastNodeExecuted: resultData?.lastNodeExecuted,
    error: resultData?.error,
    nodeCount: timeline.length,
    activatedNodeNames: rd && typeof rd === 'object' ? Object.keys(rd).sort() : [],
    timeline,
  };
}

const app = express();
app.disable('x-powered-by');

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    n8nBaseUrl: N8N_BASE_URL,
    apiKey: {
      present: Boolean(N8N_API_KEY),
      byteLength: N8N_API_KEY.length,
      source: API_KEY_SOURCE,
      envHadBoundaryWhitespace: API_KEY_BOUNDARY_TRIM,
      matchesComposeFallbackPlaceholder: N8N_API_KEY === COMPOSE_FALLBACK_API_KEY,
    },
    forwardsEditorBasicAuth: Boolean(N8N_BASIC_USER.length),
    workflowName: WORKFLOW_NAME,
    pollMs: POLL_MS,
  });
});

app.get('/api/workflow', async (req, res) => {
  try {
    if (!N8N_API_KEY) {
      return res.status(503).json({
        error:
          'Set N8N_API_KEY on n8n-flow-monitor to a key created in n8n: Settings → n8n API → Create API key (n8n 2.x does not register keys from the n8n container env alone).',
      });
    }
    const id = await resolveWorkflowId();
    const wfRaw = await n8nFetch(`/api/v1/workflows/${id}`);
    const wf = unwrapExecution(wfRaw);
    res.json({
      id: wf?.id || id,
      name: wf?.name || WORKFLOW_NAME,
      active: wf?.active,
      nodes: (wf?.nodes || []).map((n) => ({ name: n.name, type: n.type })),
    });
  } catch (e) {
    const st = monitorErrorHttpStatus(e);
    res.status(st).json({
      error: e.message,
      hint: monitorClientHint(st),
      detail: e.detail ?? e.body ?? null,
    });
  }
});

app.get('/api/executions/latest', async (req, res) => {
  try {
    if (!N8N_API_KEY) {
      return res.status(503).json({
        error:
          'N8N_API_KEY missing on n8n-flow-monitor. Create a key in n8n (Settings → n8n API) and set the same string in compose / env.',
      });
    }
    const workflowId = await resolveWorkflowId();
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
    const list = await n8nFetch(`/api/v1/executions?workflowId=${workflowId}&limit=${limit}`);
    const rows = list?.data ?? list;
    const arr = Array.isArray(rows) ? rows : [];
    const detailed = await Promise.all(
      arr.map((e) => n8nFetch(`/api/v1/executions/${e.id}?includeData=true`))
    );
    const full = detailed
      .map((raw, i) => summarizeExecution(unwrapExecution(raw), arr[i]?.id))
      .filter(Boolean);
    res.json({ workflowId, workflowName: WORKFLOW_NAME, executions: full });
  } catch (e) {
    const st = monitorErrorHttpStatus(e);
    res.status(st).json({
      error: e.message,
      hint: monitorClientHint(st),
      detail: e.detail ?? e.body ?? null,
    });
  }
});

app.get('/api/executions/:id', async (req, res) => {
  try {
    if (!N8N_API_KEY) {
      return res.status(503).json({
        error:
          'N8N_API_KEY missing on n8n-flow-monitor. Create a key in n8n (Settings → n8n API) and set the same string in compose / env.',
      });
    }
    const exec = await n8nFetch(`/api/v1/executions/${req.params.id}?includeData=true`);
    res.json(summarizeExecution(unwrapExecution(exec), req.params.id));
  } catch (e) {
    if (e.status === 404) {
      res.status(404).json({ error: e.message, detail: e.body ?? null });
      return;
    }
    const st = monitorErrorHttpStatus(e);
    res.status(st).json({
      error: e.message,
      hint: monitorClientHint(st),
      detail: e.detail ?? e.body ?? null,
    });
  }
});

/** SSE: pushes when execution list or running execution details change */
app.get('/api/stream', async (req, res) => {
  if (!N8N_API_KEY) {
    res.status(503).json({
      error:
        'N8N_API_KEY missing on n8n-flow-monitor. Create a key in n8n (Settings → n8n API) and set the same string in compose / env.',
    });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (res.flushHeaders) res.flushHeaders();

  const send = (event, payload) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send('hello', { workflowName: WORKFLOW_NAME, pollMs: POLL_MS });

  let lastFingerprint = '';
  let workflowId;

  /** Comment frames keep proxies from closing idle SSE connections. */
  const keepAliveMs = Math.min(45000, Math.max(12000, POLL_MS * 4));
  const keepAliveTimer = setInterval(() => {
    try {
      res.write(': sse-keep-alive\n\n');
    } catch {
      clearInterval(keepAliveTimer);
    }
  }, keepAliveMs);

  const tick = async () => {
    try {
      workflowId = workflowId || (await resolveWorkflowId());
      const list = await n8nFetch(
        `/api/v1/executions?workflowId=${workflowId}&limit=${EXECUTION_LIST_LIMIT}`
      );
      const rows = list?.data ?? list;
      const arr = Array.isArray(rows) ? rows : [];

      const toDetail = arr.slice(0, EXECUTION_DETAIL_LIMIT);
      const detailedRaw = await Promise.all(
        toDetail.map((e) => n8nFetch(`/api/v1/executions/${e.id}?includeData=true`))
      );
      const detailed = detailedRaw
        .map((p, i) => summarizeExecution(unwrapExecution(p), toDetail[i]?.id))
        .filter(Boolean);

      const summarized = [
        ...detailed,
        ...arr.slice(EXECUTION_DETAIL_LIMIT).map((e) => ({
          id: e.id,
          finished: e.finished,
          status: e.status,
          startedAt: e.startedAt,
          stoppedAt: e.stoppedAt,
          workflowId: e.workflowId,
          nodeCount: 0,
          timeline: [],
          meta: null,
          lastNodeExecuted: null,
          error: e.status === 'error' ? { message: 'Open in n8n or expand after increasing detail limit' } : null,
        })),
      ];

      const fp = JSON.stringify(
        summarized.map((s) => ({
          id: s.id,
          status: s.status,
          stoppedAt: s.stoppedAt,
          nodeCount: s.nodeCount,
          lastNode: s.timeline?.[s.timeline.length - 1]?.nodeName,
          activated: s.activatedNodeNames ?? [],
        }))
      );
      if (fp !== lastFingerprint) {
        lastFingerprint = fp;
        send('executions', { workflowId, workflowName: WORKFLOW_NAME, executions: summarized });
      }
    } catch (e) {
      send('apiproblem', { message: e.message, detail: e.body ?? null });
    }
  };

  await tick();
  const interval = setInterval(tick, POLL_MS);

  req.on('close', () => {
    clearInterval(interval);
    clearInterval(keepAliveTimer);
  });
});

app.use(express.static(path.join(__dirname, 'public')));

const PORT = Number(process.env.PORT) || 3456;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`n8n-flow-monitor http://0.0.0.0:${PORT} → n8n ${N8N_BASE_URL} (workflow "${WORKFLOW_NAME}")`);
});
