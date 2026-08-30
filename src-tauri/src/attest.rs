use crate::models::{MuckManifest, VerifyCheck};
use base64::Engine;
use serde_json::Value;

pub struct AttestationResult {
    pub checks: Vec<VerifyCheck>,
}

struct DigestOk {
    message: String,
    builder: BuilderKind,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum BuilderKind {
    GithubHosted,
    SelfHosted,
    Unknown,
}

pub async fn verify_manifest_assets(
    manifest: &MuckManifest,
    token: Option<&str>,
    proxy: Option<&str>,
) -> AttestationResult {
    let mut checks = Vec::new();
    if !manifest.requires_github_actions_attestation() {
        return AttestationResult { checks };
    }

    let workflow = manifest
        .build
        .as_ref()
        .map(|b| normalize_workflow(&b.workflow))
        .unwrap_or_default();
    if workflow.is_empty() {
        push(
            &mut checks,
            "workflow",
            "fail",
            "Release binaries must declare build.workflow (a GitHub Actions file in this repository)",
        );
        return AttestationResult { checks };
    }
    push(
        &mut checks,
        "workflow",
        "pass",
        format!("release workflow {workflow}"),
    );

    if manifest.build.as_ref().and_then(|b| b.reproducible) == Some(false) {
        push(
            &mut checks,
            "reproducible",
            "fail",
            "build.reproducible cannot be false — store binaries must come from a pinned, deterministic Actions job",
        );
    } else {
        push(
            &mut checks,
            "reproducible",
            "pass",
            "manifest requires a reproducible Actions build (pinned actions, locked deps)",
        );
    }

    let github = manifest.source.github.trim();
    let assets: Vec<_> = manifest
        .install
        .assets
        .iter()
        .filter(|a| a.platform == "windows-x64" || a.platform == "any")
        .collect();
    if assets.is_empty() {
        push(
            &mut checks,
            "attestation",
            "fail",
            "no hashed Windows assets to attest",
        );
        return AttestationResult { checks };
    }

    let mut any_self_hosted = false;
    let mut any_unknown_builder = false;
    for asset in assets {
        match verify_one(github, &asset.sha256, &asset.file, &workflow, token, proxy).await {
            Ok(ok) => {
                push(&mut checks, "attestation", "pass", ok.message);
                match ok.builder {
                    BuilderKind::SelfHosted => any_self_hosted = true,
                    BuilderKind::Unknown => any_unknown_builder = true,
                    BuilderKind::GithubHosted => {}
                }
            }
            Err(e) => push(&mut checks, "attestation", "fail", e.to_string()),
        }
    }

    if checks.iter().any(|c| c.id == "attestation" && c.status == "fail") {
        push(
            &mut checks,
            "provenance",
            "fail",
            "no valid GitHub Actions provenance for the release bytes",
        );
    } else if any_self_hosted {
        push(
            &mut checks,
            "provenance",
            "warn",
            "built on a self-hosted runner — prefer GitHub-hosted runners so the builder identity is GitHub’s",
        );
    } else if any_unknown_builder {
        push(
            &mut checks,
            "provenance",
            "warn",
            "attestation is bound to this repo but the builder id is not a known GitHub-hosted runner",
        );
    } else {
        push(
            &mut checks,
            "provenance",
            "pass",
            "SLSA provenance was produced by GitHub Actions in this repository",
        );
    }

    AttestationResult { checks }
}

pub async fn verify_digest(
    github: &str,
    sha256: &str,
    file: &str,
    workflow: &str,
    token: Option<&str>,
    proxy: Option<&str>,
) -> anyhow::Result<String> {
    Ok(verify_one(github, sha256, file, workflow, token, proxy)
        .await?
        .message)
}

async fn verify_one(
    github: &str,
    sha256: &str,
    file: &str,
    workflow: &str,
    token: Option<&str>,
    proxy: Option<&str>,
) -> anyhow::Result<DigestOk> {
    let digest = sha256.trim().to_lowercase();
    if digest.len() != 64 || !digest.chars().all(|c| c.is_ascii_hexdigit()) {
        anyhow::bail!("{file}: invalid sha256");
    }
    let url = format!("https://api.github.com/repos/{github}/attestations/sha256:{digest}");
    let (status, body) = crate::catalog::github_json(&url, token, proxy, 0).await?;
    if status == 404 {
        anyhow::bail!(
            "{file}: no GitHub Artifact Attestation for sha256:{}. Build in GitHub Actions and attest with actions/attest — a hand-uploaded Release is rejected",
            &digest[..12]
        );
    }
    if status == 403 {
        anyhow::bail!(
            "{file}: GitHub refused the attestations API ({status}). Public Artifact Attestations must be enabled on this repository"
        );
    }
    if status != 200 {
        anyhow::bail!("{file}: attestation API returned {status}");
    }
    let json: Value = serde_json::from_str(&body)?;
    let list = json
        .get("attestations")
        .and_then(|v| v.as_array())
        .ok_or_else(|| anyhow::anyhow!("{file}: attestation response missing attestations[]"))?;
    if list.is_empty() {
        anyhow::bail!("{file}: GitHub returned an empty attestation list");
    }

    let expected_repo = github.to_lowercase();
    let mut last_err = anyhow::anyhow!("{file}: no attestation bound this digest to {github}");
    for item in list {
        match inspect_bundle(item, &digest, &expected_repo, workflow, file) {
            Ok(ok) => return Ok(ok),
            Err(e) => last_err = e,
        }
    }
    Err(last_err)
}

fn inspect_bundle(
    item: &Value,
    digest: &str,
    expected_repo: &str,
    workflow: &str,
    file: &str,
) -> anyhow::Result<DigestOk> {
    let bundle = item.get("bundle").unwrap_or(item);
    let envelope = bundle
        .get("dsseEnvelope")
        .or_else(|| bundle.get("dsse_envelope"))
        .ok_or_else(|| anyhow::anyhow!("{file}: attestation bundle has no dsseEnvelope"))?;
    let payload_b64 = envelope
        .get("payload")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("{file}: missing DSSE payload"))?;
    let payload_type = envelope
        .get("payloadType")
        .or_else(|| envelope.get("payload_type"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if !payload_type.is_empty()
        && !payload_type.contains("in-toto")
        && !payload_type.contains("vnd.in-toto")
    {
        anyhow::bail!("{file}: unexpected attestation payload type {payload_type}");
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(payload_b64)
        .or_else(|_| base64::engine::general_purpose::STANDARD_NO_PAD.decode(payload_b64))
        .map_err(|_| anyhow::anyhow!("{file}: attestation payload is not base64"))?;
    let statement: Value = serde_json::from_slice(&bytes)?;
    inspect_statement(&statement, digest, expected_repo, workflow, file)
}

fn inspect_statement(
    statement: &Value,
    digest: &str,
    expected_repo: &str,
    workflow: &str,
    file: &str,
) -> anyhow::Result<DigestOk> {
    if !subject_matches(statement, digest) {
        anyhow::bail!("{file}: attestation subject digest does not match the asset SHA-256");
    }

    let repo = workflow_repository(statement);
    let expected = expected_repo.trim_start_matches("github.com/").to_lowercase();
    let repo_ok = match &repo {
        Some(found) => repo_matches(found, &expected),
        None => json_mentions_repo(statement, &expected),
    };
    if !repo_ok {
        anyhow::bail!(
            "{file}: attestation is not bound to github.com/{expected} — refusing a binary that was not built from this repository"
        );
    }

    let found_workflow = workflow_path(statement);
    if !workflow.is_empty() {
        match &found_workflow {
            Some(found) if normalize_workflow(found) != normalize_workflow(workflow) => {
                anyhow::bail!(
                    "{file}: built by {found}, but muck.json build.workflow is {workflow}"
                );
            }
            None if !json_mentions_workflow(statement, workflow) => {
                anyhow::bail!(
                    "{file}: attestation does not mention {workflow} — the binary must be produced by that Actions workflow"
                );
            }
            _ => {}
        }
    }

    let builder = builder_kind(statement);
    Ok(DigestOk {
        message: format!(
            "{file}: GitHub Actions attestation matches sha256:{} and github.com/{expected}",
            &digest[..12]
        ),
        builder,
    })
}

fn subject_matches(statement: &Value, digest: &str) -> bool {
    let Some(subjects) = statement.get("subject").and_then(|v| v.as_array()) else {
        return json_contains_digest(statement, digest);
    };
    subjects.iter().any(|s| {
        s.pointer("/digest/sha256")
            .and_then(|v| v.as_str())
            .map(|h| h.eq_ignore_ascii_case(digest))
            .unwrap_or(false)
    })
}

fn json_contains_digest(value: &Value, digest: &str) -> bool {
    match value {
        Value::String(s) => s.eq_ignore_ascii_case(digest),
        Value::Array(items) => items.iter().any(|v| json_contains_digest(v, digest)),
        Value::Object(map) => map.values().any(|v| json_contains_digest(v, digest)),
        _ => false,
    }
}

fn workflow_path(statement: &Value) -> Option<String> {
    statement
        .pointer("/predicate/buildDefinition/externalParameters/workflow/path")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            statement
                .pointer("/predicate/invocation/configSource/entryPoint")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
}

fn workflow_repository(statement: &Value) -> Option<String> {
    statement
        .pointer("/predicate/buildDefinition/externalParameters/workflow/repository")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            statement
                .pointer("/predicate/invocation/configSource/uri")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
}

fn repo_matches(found: &str, expected_owner_repo: &str) -> bool {
    let found = found.to_lowercase();
    let found = found
        .trim_start_matches("git+")
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_start_matches("ssh://git@");
    let found = found.trim_end_matches(".git");
    let found = found.split('@').next().unwrap_or(found);
    found.contains(&format!("github.com/{expected_owner_repo}"))
        || found.ends_with(expected_owner_repo)
}

fn json_mentions_repo(statement: &Value, expected_owner_repo: &str) -> bool {
    statement
        .to_string()
        .to_lowercase()
        .contains(&format!("github.com/{expected_owner_repo}"))
}

fn json_mentions_workflow(statement: &Value, workflow: &str) -> bool {
    statement
        .to_string()
        .replace('\\', "/")
        .to_lowercase()
        .contains(&normalize_workflow(workflow).to_lowercase())
}

fn builder_kind(statement: &Value) -> BuilderKind {
    let id = statement
        .pointer("/predicate/runDetails/builder/id")
        .or_else(|| statement.pointer("/predicate/builder/id"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase();
    if id.contains("self-hosted") {
        BuilderKind::SelfHosted
    } else if id.contains("github-hosted")
        || id.contains("actions.github.io")
        || id.contains("github.com/actions/runner")
    {
        BuilderKind::GithubHosted
    } else {
        BuilderKind::Unknown
    }
}

fn normalize_workflow(path: &str) -> String {
    path.trim().trim_start_matches('/').replace('\\', "/")
}

fn push(checks: &mut Vec<VerifyCheck>, id: &str, status: &str, detail: impl Into<String>) {
    checks.push(VerifyCheck {
        id: id.into(),
        status: status.into(),
        detail: detail.into(),
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample_statement(digest: &str, repo: &str, path: &str, builder: &str) -> Value {
        json!({
            "_type": "https://in-toto.io/Statement/v1",
            "subject": [{ "name": "app.zip", "digest": { "sha256": digest } }],
            "predicateType": "https://slsa.dev/provenance/v1",
            "predicate": {
                "buildDefinition": {
                    "buildType": "https://actions.github.io/buildtypes/workflow/v1",
                    "externalParameters": {
                        "workflow": {
                            "ref": "refs/tags/v1.0.0",
                            "repository": repo,
                            "path": path
                        }
                    }
                },
                "runDetails": {
                    "builder": { "id": builder }
                }
            }
        })
    }

    #[test]
    fn accepts_github_hosted_provenance() {
        let digest = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        let stmt = sample_statement(
            digest,
            "https://github.com/acme/tools",
            ".github/workflows/release.yml",
            "https://github.com/actions/runner/github-hosted",
        );
        let ok = inspect_statement(
            &stmt,
            digest,
            "acme/tools",
            ".github/workflows/release.yml",
            "app.zip",
        )
        .unwrap();
        assert_eq!(ok.builder, BuilderKind::GithubHosted);
    }

    #[test]
    fn rejects_other_repository() {
        let digest = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        let stmt = sample_statement(
            digest,
            "https://github.com/evil/tools",
            ".github/workflows/release.yml",
            "https://github.com/actions/runner/github-hosted",
        );
        assert!(inspect_statement(
            &stmt,
            digest,
            "acme/tools",
            ".github/workflows/release.yml",
            "app.zip",
        )
        .is_err());
    }

    #[test]
    fn rejects_wrong_workflow() {
        let digest = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        let stmt = sample_statement(
            digest,
            "https://github.com/acme/tools",
            ".github/workflows/nightly.yml",
            "https://github.com/actions/runner/github-hosted",
        );
        assert!(inspect_statement(
            &stmt,
            digest,
            "acme/tools",
            ".github/workflows/release.yml",
            "app.zip",
        )
        .is_err());
    }

    #[test]
    fn flags_self_hosted() {
        let digest = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        let stmt = sample_statement(
            digest,
            "https://github.com/acme/tools",
            ".github/workflows/release.yml",
            "https://github.com/actions/runner/self-hosted",
        );
        let ok = inspect_statement(
            &stmt,
            digest,
            "acme/tools",
            ".github/workflows/release.yml",
            "app.zip",
        )
        .unwrap();
        assert_eq!(ok.builder, BuilderKind::SelfHosted);
    }
}
