// docs/testing/route-intent.test.cjs
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WF = path.join(__dirname, '..', '..', 'n8n', 'workflows', 'Travel Search.json');

function loadWorkflow() {
  return JSON.parse(fs.readFileSync(WF, 'utf8'));
}
function nodeByName(name) {
  const n = loadWorkflow().nodes.find((x) => x.name === name);
  if (!n) throw new Error('node not found: ' + name);
  return n;
}

// Run the ACTUAL "Build GeoApify params & flags" node body with a mocked $input.
// The node receives an already-accent-stripped, lowercased message (the upstream
// "Strip Polish accents & lowercase" node does that), so pass ASCII text here.
function runBuildParams(message) {
  const code = nodeByName('Build GeoApify params & flags').parameters.jsCode;
  const fn = new Function('$input', code);
  const out = fn({ all: () => [{ json: { message } }] });
  return Array.isArray(out) ? out[0].json : out.json;
}

const LIST_QUERIES = [
  'znajdz mi plaze i hotel w ustce',
  'plaze i hotel w sopocie',
  'restauracje w poznaniu',
  'plaze w gdansku',
];
const ROUTE_QUERIES = [
  'hotel najblizej plazy w ustce',
  'jak dojsc z hotelu na plaze w gdansku',
  'ile km z hotelu na plaze',
];

for (const q of LIST_QUERIES) {
  test(`LIST: "${q}" -> routeIntent === false`, () => {
    assert.strictEqual(runBuildParams(q).routeIntent, false);
  });
}
for (const q of ROUTE_QUERIES) {
  test(`ROUTE: "${q}" -> routeIntent === true`, () => {
    assert.strictEqual(runBuildParams(q).routeIntent, true);
  });
}

test('guard: single-category query with a cue word stays routeIntent === false', () => {
  const j = runBuildParams('hotel najblizej w ustce');
  assert.strictEqual(j.geoapifyParams.categories.length, 1);
  assert.strictEqual(j.routeIntent, false);
});

test('IF node "Route intent? (cue + multi-cat)" gates on routeIntent', () => {
  const node = nodeByName('Route intent? (cue + multi-cat)');
  const cond = node.parameters.conditions.conditions[0];
  assert.match(cond.leftValue, /routeIntent/);
  assert.strictEqual(cond.operator.type, 'boolean');
});
