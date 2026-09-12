/**
 * e2e/server.mjs — boots the real Personal World FastAPI app under
 * uvicorn for the Playwright suite (T14, §8 browser job shape).
 *
 * Setup parity with the Python tests (tests/test_sections.py::_make):
 * PW_IDENTITY_MODE=single, PW_API_TOKEN pre-set, setup-complete marker
 * written, fresh world via init_world — so /api/setup/status is
 * complete and `ci-token` is a valid bearer before the first test.
 *
 * The world is seeded with one hidden section (interests) directly in
 * world.json so the nav-omission gate has a stable fixture.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..", "..");
const PORT = 8731;
const TOKEN = "ci-token";

const dataDir = mkdtempSync(join(tmpdir(), "pw-e2e-"));
const configDir = join(dataDir, "config");
mkdirSync(configDir, { recursive: true });

const dist = resolve(REPO, "frontend", "dist");
if (!existsSync(join(dist, "index.html"))) {
  console.error(
    "[e2e] frontend/dist missing — run `npm run build` in frontend/ first."
  );
  process.exit(1);
}

// Seed a minimal world.json with interests hidden (nav-omission gate
// fixture; schema mirrors personal_world init_world: facts map,
// accessibility defaults; layout carries the hidden-section fixture).
writeFileSync(
  join(dataDir, "world.json"),
  JSON.stringify({
    schema_version: "1",
    facts: {},
    intents: {},
    policies: {},
    lore: {},
    capabilities: {},
    providers: {},
    packs: {},
    accessibility: {
      motion: "reduced",
      contrast: "normal",
      text_scale: 1.0,
      density: "normal",
      targets: "normal",
    },
    layout: { sections: { order: [], hidden: ["interests"] } },
  })
);
writeFileSync(join(dataDir, "setup-complete"), "ok");

const env = {
  ...process.env,
  PW_API_TOKEN: TOKEN,
  PW_IDENTITY_MODE: "single",
  PW_DATA_DIR: dataDir,
  PW_CONFIG_DIR: configDir,
  PW_FRONTEND: "react",
  PW_FRONTEND_DIST: dist,
  PW_LAB_CLI: "/nonexistent/lab-cli", // Lab stays honestly UNAVAILABLE
  // (a configured-but-unreachable CLI: the backend reports
  //  ok:false status:"unavailable" with its own warning — the
  //  not_configured branch is the capability-registry state, which a
  //  running app with the lab route always has).
};

const child = spawn(
  process.env.PW_PYTHON || "uv",
  [
    ...(process.env.PW_PYTHON ? [] : ["run"]),
    "uvicorn",
    "personal_world.api:create_app",
    "--factory",
    "--host",
    "127.0.0.1",
    "--port",
    String(PORT),
  ],
  {
    cwd: REPO,
    env,
    stdio: ["ignore", "inherit", "inherit"],
  }
);

function shutdown() {
  child.kill("SIGTERM");
  setTimeout(() => child.kill("SIGKILL"), 3000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
child.on("exit", (code) => process.exit(code ?? 0));

// Health poll: /healthz answers once the app is live.
const deadline = Date.now() + 45_000;
async function ready() {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/healthz`);
      if (res.ok) {
        const body = await res.json();
        if (body.auth_configured && !body.setup_needed) return;
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.error("[e2e] server failed to become healthy in time");
  shutdown();
  process.exit(1);
}
await ready();
console.log(`[e2e] ready on http://127.0.0.1:${PORT} (data: ${dataDir})`);
// Keep the process alive while uvicorn serves; uvicorn's exit ends us.
setInterval(() => {}, 1 << 30);