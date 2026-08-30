#!/usr/bin/env node
/**
 * muck validate — checks muck.json / theme.json against the published schemas
 * and the extra publishing rules (public GitHub source, license file, hashes).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const muckSchema = JSON.parse(
  fs.readFileSync(path.join(root, "schema", "muck.schema.json"), "utf8"),
);
const themeSchema = JSON.parse(
  fs.readFileSync(path.join(root, "schema", "theme.schema.json"), "utf8"),
);
const validateMuck = ajv.compile(muckSchema);
const validateTheme = ajv.compile(themeSchema);

const LICENSE_NAMES = [
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
  "COPYING",
  "COPYING.md",
];

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exitCode = 1;
}

function findManifest(dir) {
  const a = path.join(dir, "muck.json");
  const b = path.join(dir, ".muck", "muck.json");
  if (fs.existsSync(a)) return a;
  if (fs.existsSync(b)) return b;
  return null;
}

function hasLicense(dir) {
  return LICENSE_NAMES.some((n) => fs.existsSync(path.join(dir, n)));
}

function extraMuckRules(manifest, dir) {
  if (!manifest.source?.github) {
    fail(`${dir}: source.github is required (public GitHub only)`);
  }
  if (!hasLicense(dir)) {
    fail(`${dir}: missing LICENSE / COPYING file`);
  }
  const kind = manifest.install?.kind;
  const assets = manifest.install?.assets ?? [];
  const remoteKinds = ["archive", "msi", "nsis", "inno"];
  if (remoteKinds.includes(kind) && assets.length === 0) {
    fail(`${dir}: install.kind=${kind} requires install.assets with sha256`);
  }
  for (const asset of assets) {
    if (!/^[a-fA-F0-9]{64}$/.test(asset.sha256)) {
      fail(`${dir}: invalid sha256 on asset ${asset.file}`);
    }
  }
  if (manifest.install?.postinstall && !manifest.install?.postinstallSha256) {
    fail(`${dir}: postinstall requires postinstallSha256`);
  }
  const needsAttestation =
    (remoteKinds.includes(kind) && assets.length > 0) ||
    (kind === "runtime" && assets.length > 0) ||
    (kind === "portable" && assets.length > 0);
  if (needsAttestation) {
    const workflow = manifest.build?.workflow;
    if (!workflow || !String(workflow).includes(".github/workflows/")) {
      fail(
        `${dir}: Release assets require build.workflow pointing at .github/workflows/ (GitHub Actions in this repo)`,
      );
    }
    if (manifest.build?.reproducible === false) {
      fail(`${dir}: build.reproducible cannot be false for store distribution`);
    }
    if (manifest.build?.attestations && manifest.build.attestations !== "required") {
      fail(`${dir}: build.attestations must be "required" — hand-uploaded Releases are rejected`);
    }
  }
}

function validateMuckFile(file) {
  const raw = fs.readFileSync(file, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    fail(`${file}: invalid JSON (${e.message})`);
    return;
  }
  if (!validateMuck(data)) {
    for (const err of validateMuck.errors ?? []) {
      fail(`${file}: ${err.instancePath || "/"} ${err.message}`);
    }
  }
  extraMuckRules(data, path.dirname(file));
  if (process.exitCode !== 1) {
    console.log(`ok  ${path.relative(root, file)}  ${data.id}@${data.version}`);
  }
}

function validateThemeFile(file) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!validateTheme(data)) {
    for (const err of validateTheme.errors ?? []) {
      fail(`${file}: ${err.instancePath || "/"} ${err.message}`);
    }
    return;
  }
  console.log(`ok  ${path.relative(root, file)}  theme:${data.id}`);
}

function walkPrograms() {
  const bases = [
    path.join(root, "programs", "official"),
    path.join(root, "programs", "examples"),
  ];
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      const dir = path.join(base, name);
      if (!fs.statSync(dir).isDirectory()) continue;
      const manifest = findManifest(dir);
      if (!manifest) {
        fail(`${dir}: no muck.json`);
        continue;
      }
      validateMuckFile(manifest);
    }
  }
}

const arg = process.argv[2];
if (!arg) {
  walkPrograms();
  const themesDir = path.join(root, "themes");
  if (fs.existsSync(themesDir)) {
    for (const f of fs.readdirSync(themesDir).filter((x) => x.endsWith(".json"))) {
      validateThemeFile(path.join(themesDir, f));
    }
  }
} else {
  const target = path.resolve(arg);
  const st = fs.statSync(target);
  if (st.isDirectory()) {
    const manifest = findManifest(target);
    if (!manifest) {
      fail(`${target}: no muck.json`);
    } else {
      validateMuckFile(manifest);
    }
  } else if (target.endsWith("theme.json") || path.basename(target).includes("theme")) {
    validateThemeFile(target);
  } else {
    validateMuckFile(target);
  }
}

if (process.exitCode === 1) {
  process.exit(1);
}
