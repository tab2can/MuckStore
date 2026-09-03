use crate::models::UpdateInfo;
use crate::settings;
use semver::Version;

fn rate_limited(err: &anyhow::Error) -> bool {
    err.to_string().contains("rate-limited")
}

pub async fn check_program_updates(
    token: Option<&str>,
    proxy: Option<&str>,
) -> anyhow::Result<Vec<UpdateInfo>> {
    let registry = settings::load_registry();
    let mut out = Vec::new();
    for inst in registry.programs.values() {
        let include_pre = inst.update_channel == "pre"
            || inst
                .manifest
                .update
                .as_ref()
                .and_then(|u| u.include_prerelease)
                .unwrap_or(false);
        let name = inst.manifest.name.clone();
        let pinned = inst.pinned_version.is_some();
        if pinned {
            out.push(UpdateInfo {
                id: inst.id.clone(),
                current: inst.version.clone(),
                available: None,
                changelog: None,
                store: false,
                kind: "program".into(),
                name,
                pinned: true,
            });
            continue;
        }
        match crate::catalog::latest_release(&inst.source_github, token, proxy, include_pre).await {
            Ok(Some((tag, body, _))) => {
                let newer = is_newer(&inst.version, &tag);
                out.push(UpdateInfo {
                    id: inst.id.clone(),
                    current: inst.version.clone(),
                    available: if newer { Some(tag) } else { None },
                    changelog: body,
                    store: false,
                    kind: "program".into(),
                    name,
                    pinned: false,
                });
            }
            Ok(None) => out.push(UpdateInfo {
                id: inst.id.clone(),
                current: inst.version.clone(),
                available: None,
                changelog: None,
                store: false,
                kind: "program".into(),
                name,
                pinned: false,
            }),
            Err(e) if rate_limited(&e) => return Err(e),
            Err(_) => {}
        }
    }
    Ok(out)
}

pub async fn check_store_update(
    token: Option<&str>,
    proxy: Option<&str>,
) -> anyhow::Result<UpdateInfo> {
    let current = env!("CARGO_PKG_VERSION").to_string();
    let rel = crate::catalog::latest_release("tab2can/MuckStore", token, proxy, false).await;
    let (available, changelog) = match rel {
        Ok(Some((tag, body, _))) if is_newer(&current, &tag) => (Some(tag), body),
        Ok(_) => (None, None),
        Err(e) if rate_limited(&e) => return Err(e),
        Err(_) => (None, None),
    };
    Ok(UpdateInfo {
        id: "com.muckstore.app".into(),
        current,
        available,
        changelog,
        store: true,
        kind: "store".into(),
        name: "Muck Store".into(),
        pinned: false,
    })
}

fn is_newer(current: &str, candidate: &str) -> bool {
    let Ok(cur) = Version::parse(current.trim_start_matches('v')) else {
        return candidate != current;
    };
    let Ok(next) = Version::parse(candidate.trim_start_matches('v')) else {
        return false;
    };
    next > cur
}
