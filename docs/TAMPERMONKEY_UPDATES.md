# Tampermonkey Native Updates

This document defines the update contract for PokePixel Hunt Analyzer releases.

The goal is deliberately narrow: version discovery, update notification and installation are delegated to Tampermonkey. The Analyzer does not poll GitHub, does not show its own update banner and does not add runtime network permissions for update checks.

## 1. Update architecture

Production releases publish two stable assets:

```text
pokepixel-hunt-analyzer.meta.js
pokepixel-hunt-analyzer.user.js
```

The production userscript contains:

```text
@version      X.Y.Z
@updateURL    https://github.com/leojlsv/pokepixel-hunt-analyzer/releases/latest/download/pokepixel-hunt-analyzer.meta.js
@downloadURL  https://github.com/leojlsv/pokepixel-hunt-analyzer/releases/latest/download/pokepixel-hunt-analyzer.user.js
```

Tampermonkey uses `@updateURL` to retrieve the lightweight metadata file and compare its `@version` with the installed script. When an update is accepted, `@downloadURL` points to the full userscript.

No application runtime code participates in this process.

## 2. Source of truth

`package.json` is the authoritative application version.

The build derives all release version surfaces from it:

```text
package.json
    ↓
createUserscriptMetadata()
    ├─ dist/pokepixel-hunt-analyzer.meta.js
    ├─ header of dist/pokepixel-hunt-analyzer.user.js
    └─ __APP_VERSION__ inside the bundled Analyzer
```

`package-lock.json` must carry the same root package version before merge.

Do not introduce a second manually maintained version constant.

## 3. Production invariants

Every production release MUST satisfy all of the following:

1. `package.json` and the root package entry in `package-lock.json` have exactly the same version.
2. `pokepixel-hunt-analyzer.meta.js` and `pokepixel-hunt-analyzer.user.js` declare exactly the same `@version`.
3. The production userscript contains the canonical `@updateURL` and `@downloadURL` values.
4. The metadata asset contains the same production metadata block used by the userscript header.
5. The release tag is `v<package version>`.
6. The GitHub Release targets the merged `main` commit for that version.
7. Both assets are uploaded with their exact stable filenames.
8. The release is published, not Draft and not Prerelease unless explicitly intended.
9. No DEV build is ever uploaded as a production release asset.
10. `@name` and `@namespace` are not changed casually because they participate in userscript identity/continuity.

The stable filenames are part of the update API. Renaming either asset breaks the `releases/latest/download/...` URLs already installed in users' Tampermonkey metadata.

## 4. DEV isolation

DEV builds are intentionally excluded from the production update channel.

`npm run build:userscript:dev` must produce a userscript that:

- uses the DEV name/namespace/match target;
- uses `<package version>-dev`;
- contains no `@updateURL`;
- contains no `@downloadURL`;
- leaves no publishable `pokepixel-hunt-analyzer.meta.js` in `dist/`.

This prevents a DEV smoke build from joining or contaminating the production update channel.

## 5. Bootstrap release: v1.11.0

v1.11.0 is the bootstrap release for native Tampermonkey updates.

Versions up to and including v1.10.0 were distributed without `@updateURL` / `@downloadURL`. Therefore an installation already on v1.10.0 cannot discover v1.11.0 through this mechanism.

Expected migration:

```text
v1.10.0 or older
    ↓ one final manual update
v1.11.0
    ↓ native Tampermonkey update channel is now installed
v1.12.0+
    ↓ Tampermonkey can detect newer published versions
```

This is expected behavior, not a migration bug.

## 6. Release workflow

Releases use the permanent GitHub Actions workflow in `.github/workflows/publish.yml`.

The publish trigger is a temporary branch named:

```text
publish/vX.Y.Z
```

The branch MUST be created from the already merged and CI-green `main` commit.

The workflow verifies that:

- branch version `X.Y.Z` equals `package.json` version;
- the publish branch commit is the current `origin/main` commit;
- dependency audit and full validation pass;
- the production build contains both release assets;
- metadata and userscript versions are consistent;
- production update URLs are present.

Only after those checks does it create tag `vX.Y.Z`, publish the GitHub Release and upload both assets.

After successful publication, the temporary `publish/vX.Y.Z` branch is deleted.

### Release operator checklist

Before creating the publish branch:

```text
[ ] Feature/manual validation approved
[ ] Release PR CI green
[ ] package.json version correct
[ ] package-lock.json synchronized
[ ] CHANGELOG entry present
[ ] README/docs updated when behavior changed
[ ] Release PR merged to main
[ ] main CI green
```

Then:

```bash
git switch main
git pull --ff-only origin main
git switch -c publish/vX.Y.Z
git push origin publish/vX.Y.Z
```

Do not add release-only source changes to the publish branch. If a correction is needed, stop publication, fix it through a normal PR, merge it, and recreate the publish branch from the new `main`.

## 7. Post-release verification

After every release, verify all of the following before announcing it:

```text
[ ] GitHub Release exists at /releases/tag/vX.Y.Z
[ ] target commit equals the intended merged main commit
[ ] pokepixel-hunt-analyzer.meta.js is present
[ ] pokepixel-hunt-analyzer.user.js is present
[ ] both assets declare @version X.Y.Z
[ ] latest/download/pokepixel-hunt-analyzer.meta.js resolves
[ ] latest/download/pokepixel-hunt-analyzer.user.js resolves
[ ] release is not Draft/Prerelease unless intentional
[ ] publish workflow completed successfully
```

Record the userscript asset SHA-256 in the release confirmation when available.

## 8. Tampermonkey smoke test

For the bootstrap release, first install v1.11.0 manually and confirm its metadata contains the production update URLs.

To test the native update path without waiting for the next real release, use a disposable/local test copy of the installed script:

1. keep the v1.11.0 production `@updateURL` and `@downloadURL` unchanged;
2. temporarily lower only the installed copy's `@version`, for example to `1.10.99`;
3. use Tampermonkey's **Check for userscript updates** action;
4. Tampermonkey should resolve the latest `.meta.js`, detect v1.11.0 as newer and offer/install the current `.user.js` according to the user's Tampermonkey update settings;
5. confirm the installed script returns to v1.11.0;
6. delete the disposable test copy if a duplicate was created.

Do not perform this test on a DEV userscript.

Tampermonkey controls the exact notification/automatic-install behavior according to the user's extension settings. The Analyzer must not override that policy.

## 9. Hotfixes and rollbacks

A hotfix follows normal Semantic Versioning, for example `v1.11.1`. Publish it through the same workflow and with the same asset names. `releases/latest/download/...` then points to the newest published release automatically.

Do not overwrite an existing release asset with different code under the same version. If production code changes, increment the version and publish a new release.

Avoid deleting the latest valid release without immediately replacing it: installed userscripts depend on the stable `releases/latest/download/...` route.

## 10. Things that must not be added

The native update feature does not require and must not introduce:

- GitHub API polling from the Analyzer;
- an in-game update banner;
- extra `@connect` domains;
- extra `GM_*` grants;
- IndexedDB changes;
- update-specific analytics or telemetry;
- forced application-side updates.

Update policy belongs to Tampermonkey. The Analyzer only publishes correct metadata and stable release assets.
