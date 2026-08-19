# Releasing

Chenoot ships as an unsigned desktop application for macOS, Windows, and
Linux. Everything below assumes you have run `npm install` and that
`npm run verify` passes.

## Version numbers

The version in `package.json` is the release version. Nothing derives it
from a tag, so the two have to be set together and the order matters:
update the version, commit it, then tag that commit.

``` bash
npm version minor
git push --follow-tags
```

Chenoot follows semantic versioning. Use patch releases for fixes that
do not add new user-facing features. Use minor releases for new features
or meaningful changes. Use major releases when there are breaking
changes.

## Building

`npm run dist` builds the supported platforms. In practice, each
platform has to be built in an environment that supports it. A macOS
disk image can only be built on macOS, so the usual sequence is to build
the platform you are on and let the release workflow build the others.

``` bash
npm run dist:mac      # .dmg and .zip for arm64 and x64. Needs macOS.
npm run dist:mac:zip  # .zip only, buildable from any host.
npm run dist:win      # .exe, NSIS installer.
npm run dist:linux    # .AppImage.
```

Each of these runs `prebuild` first, which performs the standards check,
icon build, SVG export, and renderer bundle. A build cannot be produced
from a tree that fails the standards check.

Output lands in `dist/`.

The generated installers are release artifacts and should not be
committed to the repository. They are attached to GitHub Releases.

## Producing the disk image

The `.dmg` is the primary macOS download and can only be built on macOS.
`hdiutil` creates the image and is only available on macOS.

Run:

``` bash
npm run dist:mac
```

This produces:

-   `Chenoot-arm64.dmg` for Apple Silicon Macs (M1, M2, M3, and M4)
-   `Chenoot-x64.dmg` for Intel Macs

The image opens with the application on the left and a shortcut to
Applications on the right so the installation process is clear without
requiring additional instructions inside the image.

## Signing

Chenoot is currently distributed without developer signing. This means
the first launch requires an additional confirmation step.

What that means for people downloading them:

-   **macOS** shows a warning that the application cannot be checked for
    malicious software. Right-click the application and choose Open,
    then Open again in the dialog. Gatekeeper remembers the decision.
-   **Windows** shows a SmartScreen warning. Select More info, then Run
    anyway.
-   **Linux** needs the AppImage marked executable:

``` bash
chmod +x Chenoot-*.AppImage
```

Include these instructions in the release notes because this is the
first thing many users encounter after downloading the application.

Signing certificates have an annual cost and do not change how the
application behaves. This can be revisited when the download volume
makes the warnings a meaningful obstacle.

## Automated builds

`.github/workflows/release.yml` builds the supported platforms when a
tag beginning with `v` is pushed and attaches the artifacts to a draft
release.

The draft is not published automatically. Check that the artifacts open
on at least one machine before publishing.

The workflow runs `npm run verify` before platform builds, so a tag on a
tree that fails its own checks produces no artifacts.

## Release notes

Write release notes in:

`docs/RELEASE-NOTES-<version>.md`

The changelog is maintained separately as a record of changes over time
and should not be reconstructed from commit messages during release
preparation.

When creating a GitHub Release, use the release notes file as the
release description.

Keep release notes in the order readers need:

1.  Fixes for visible problems.
2.  New features.
3.  Changes users will notice.
4.  Platform-specific installation notes and warnings.

## Checklist

1.  `npm run verify` passes.
2.  Run `npm run shots` if the landing page changed, and commit
    generated updates.
3.  `CHANGELOG.md` has an entry for the version, dated.
4.  Create `docs/RELEASE-NOTES-<version>.md`.
5.  Update the version with `npm version <major|minor|patch>`.
6.  Push the tag with `git push --follow-tags`.
7.  Wait for the workflow and download the artifacts.
8.  Open at least one build from each available platform.
9.  Create or update the GitHub Release using the release notes file.
10. Attach the installers and publish the release.
