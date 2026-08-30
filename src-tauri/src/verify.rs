use crate::models::{
    CatalogProgram, InstallRequest, MuckManifest, TrustRecord, VerifyCheck, VerifyReport,
};
use crate::paths;
use chrono::Utc;
use tauri::AppHandle;

const DANGEROUS: &[&str] = &[
    "admin",
    "input-hook",
    "shell-integration",
    "other-process",
    "windows-settings",
];

pub async fn verify(
    app: &AppHandle,
    request: &InstallRequest,
    token: Option<&str>,
    proxy: Option<&str>,
) -> anyhow::Result<VerifyReport> {
    let program = resolve(app, request, token, proxy).await?;
    let manifest = program
        .manifest
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("program is missing a valid muck.json"))?;
    let mut checks = Vec::new();

    push(
        &mut checks,
        "manifest",
        "pass",
        format!("muck.json {}@{}", manifest.id, manifest.version),
    );

    match manifest.validate() {
        Ok(()) => push(&mut checks, "identity", "pass", "id, semver and entry are valid"),
        Err(e) => push(&mut checks, "identity", "fail", e.to_string()),
    }

    if manifest.source.github.split('/').count() == 2 {
        push(
            &mut checks,
            "source",
            "pass",
            format!("public GitHub source {}", manifest.source.github),
        );
    } else {
        push(&mut checks, "source", "fail", "source.github must be owner/repo");
    }

    if program.official {
        if crate::catalog::official_catalog(app)
            .iter()
            .any(|p| p.id == program.id)
        {
            push(
                &mut checks,
                "official",
                "pass",
                "listed in the Muck Store official catalog",
            );
        } else {
            push(
                &mut checks,
                "official",
                "fail",
                "claimed official but not in catalog/official.json",
            );
        }
    } else {
        push(
            &mut checks,
            "official",
            "warn",
            "community program — Muck verifies provenance, not author intent",
        );
    }

    license_check(app, &program, manifest, &mut checks);
    asset_check(manifest, program.local_resource.is_some(), &mut checks);
    permission_check(manifest, &mut checks);

    let mut commit_sha = program.commit_sha.clone();
    if program.local_resource.is_none() {
        match crate::catalog::github_facts(&manifest.source.github, token, proxy).await {
            Ok(facts) => {
            if facts.private {
                push(&mut checks, "public", "fail", "repository is private");
            } else {
                push(&mut checks, "public", "pass", "repository is public");
            }
            if facts.archived {
                push(&mut checks, "active", "warn", "repository is archived");
            } else {
                push(&mut checks, "active", "pass", "repository is not archived");
            }
            if facts.fork {
                push(&mut checks, "fork", "warn", "repository is a fork — confirm the upstream");
            }
            if facts.full_name.to_lowercase() != manifest.source.github.to_lowercase() {
                push(
                    &mut checks,
                    "sourceMatch",
                    "fail",
                    format!("manifest source {} != {}", manifest.source.github, facts.full_name),
                );
            } else {
                push(&mut checks, "sourceMatch", "pass", "manifest source matches the GitHub repo");
            }
            if let Some(sha) = facts.commit_sha {
                commit_sha = Some(sha.clone());
                push(&mut checks, "commit", "pass", format!("pinned HEAD {sha}"));
            }
            if !matches!(manifest.install.kind.as_str(), "portable" | "script") {
                match crate::catalog::latest_release(&manifest.source.github, token, proxy, false).await {
                    Ok(Some((tag, _, assets))) => {
                        let named = manifest.install.assets.iter().any(|a| {
                            assets.iter().any(|(n, _)| n == &a.file)
                        });
                        if named || manifest.install.assets.is_empty() {
                            push(&mut checks, "release", "pass", format!("GitHub release {tag}"));
                        } else {
                            push(
                                &mut checks,
                                "release",
                                "fail",
                                "release exists but none of the declared assets are attached",
                            );
                        }
                    }
                    Ok(None) => push(&mut checks, "release", "fail", "no GitHub release found"),
                    Err(e) => push(&mut checks, "release", "warn", e.to_string()),
                }
            }
            }
            Err(e) => push(
                &mut checks,
                "public",
                "fail",
                format!("could not reach GitHub: {e}"),
            ),
        }
    } else if program.official {
        push(&mut checks, "public", "pass", "official payload is bundled with Muck Store");
        push(&mut checks, "commit", "pass", "version pinned by the official catalog");
    } else {
        push(
            &mut checks,
            "public",
            "warn",
            "local community sample — treat as third-party even though it did not come from the network",
        );
    }

    if program.local_resource.is_none() {
        let att = crate::attest::verify_manifest_assets(manifest, token, proxy).await;
        checks.extend(att.checks);
    } else if program.official {
        push(
            &mut checks,
            "attestation",
            "pass",
            "official tree is copied from this Muck Store checkout, not a detached Release upload",
        );
    }

    let failed = checks.iter().any(|c| c.status == "fail");
    let warned = checks.iter().any(|c| c.status == "warn");
    let already = crate::trust::is_approved(&program.id, &program.version, commit_sha.as_deref());
    if already {
        push(&mut checks, "ledger", "pass", "already in your Muck approval ledger for this version");
    }

    let verdict = if failed {
        "blocked"
    } else if already && !warned {
        "verified"
    } else if program.official && !warned {
        "verified"
    } else {
        "needsApproval"
    };

    Ok(VerifyReport {
        program_id: program.id,
        name: program.name,
        official: program.official,
        verdict: verdict.into(),
        github: program.source_github,
        version: program.version,
        commit_sha,
        checks,
    })
}

async fn resolve(
    app: &AppHandle,
    request: &InstallRequest,
    token: Option<&str>,
    proxy: Option<&str>,
) -> anyhow::Result<CatalogProgram> {
    if let Some(id) = &request.id {
        if let Some(local) = crate::catalog::find_local(app, id) {
            return Ok(local);
        }
    }
    if let Some(rel) = &request.local_resource {
        let dir = paths::resolve_resource(app, rel);
        let manifest = load_manifest_dir(&dir)?;
        return Ok(CatalogProgram::from_manifest(
            manifest,
            request.official,
            Some(rel.clone()),
        ));
    }
    if let Some(github) = &request.github {
        return crate::catalog::fetch_github_program(github, token, proxy).await;
    }
    anyhow::bail!("nothing to verify")
}

fn load_manifest_dir(dir: &std::path::Path) -> anyhow::Result<MuckManifest> {
    let a = dir.join("muck.json");
    let b = dir.join(".muck").join("muck.json");
    if a.exists() {
        MuckManifest::load(&a)
    } else {
        MuckManifest::load(&b)
    }
}

fn license_check(app: &AppHandle, program: &CatalogProgram, manifest: &MuckManifest, checks: &mut Vec<VerifyCheck>) {
    if let Some(rel) = &program.local_resource {
        let dir = crate::paths::resolve_resource(app, rel);
        let found = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"]
            .iter()
            .any(|n| dir.join(n).exists());
        if found || !manifest.license.is_empty() {
            push(checks, "license", "pass", format!("license {}", manifest.license));
        } else {
            push(checks, "license", "fail", "no LICENSE file and no SPDX id");
        }
        return;
    }
    if manifest.license.is_empty() || manifest.license.eq_ignore_ascii_case("NOASSERTION") {
        push(checks, "license", "fail", "missing SPDX license");
    } else {
        push(checks, "license", "pass", format!("SPDX {}", manifest.license));
    }
}

fn asset_check(manifest: &MuckManifest, local: bool, checks: &mut Vec<VerifyCheck>) {
    let kind = manifest.install.kind.as_str();
    let remote = matches!(kind, "archive" | "msi" | "nsis" | "inno");
    if local || matches!(kind, "portable" | "script" | "runtime") {
        if remote && manifest.install.assets.is_empty() {
            push(checks, "hash", "fail", "remote installer kind requires sha256 assets");
        } else if manifest.install.assets.iter().any(|a| a.sha256.len() != 64) && !manifest.install.assets.is_empty() {
            push(checks, "hash", "fail", "an asset sha256 is not 64 hex chars");
        } else if local {
            push(checks, "hash", "pass", "bundled payload — integrity is the official catalog copy");
        } else if manifest.install.assets.is_empty() {
            push(checks, "hash", "warn", "no release asset hashes yet — GitHub tree will be copied only if kind is portable");
        } else {
            push(checks, "hash", "pass", "every declared asset has SHA-256");
        }
        return;
    }
    if manifest.install.assets.is_empty() {
        push(checks, "hash", "fail", "remote install requires hashed GitHub Release assets");
    } else if manifest.install.assets.iter().any(|a| a.sha256.len() != 64) {
        push(checks, "hash", "fail", "an asset sha256 is invalid");
    } else {
        push(checks, "hash", "pass", "SHA-256 pins present — payload will be rejected on mismatch");
    }
}

fn permission_check(manifest: &MuckManifest, checks: &mut Vec<VerifyCheck>) {
    if manifest.permissions.is_empty() {
        push(checks, "permissions", "pass", "no extra capabilities declared");
        return;
    }
    let danger: Vec<&String> = manifest
        .permissions
        .iter()
        .filter(|p| DANGEROUS.contains(&p.as_str()))
        .collect();
    if danger.is_empty() {
        push(
            checks,
            "permissions",
            "pass",
            format!("declared: {}", manifest.permissions.join(", ")),
        );
    } else {
        push(
            checks,
            "permissions",
            "warn",
            format!("elevated capabilities: {}", danger.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(", ")),
        );
    }
}

fn push(checks: &mut Vec<VerifyCheck>, id: &str, status: &str, detail: impl Into<String>) {
    checks.push(VerifyCheck {
        id: id.into(),
        status: status.into(),
        detail: detail.into(),
    });
}

pub fn record_approval(report: &VerifyReport) -> anyhow::Result<()> {
    crate::trust::record(TrustRecord {
        id: report.program_id.clone(),
        github: report.github.clone(),
        version: report.version.clone(),
        commit_sha: report.commit_sha.clone(),
        official: report.official,
        approved_at: Utc::now().to_rfc3339(),
        verdict: report.verdict.clone(),
    })
}

impl VerifyReport {
    pub fn blocked(&self) -> bool {
        self.verdict == "blocked"
    }
}
