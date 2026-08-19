# Releasing

Chenoot ships as an unsigned desktop application for macOS, Windows, and Linux.
Everything below assumes you have run `npm install` and that `npm run verify`
passes.

## Version numbers

The version in `package.json` is the release. Nothing derives it from a tag, so
the two have to be set together and the order matters: bump the version, commit
it, then tag that commit.

```
npm version minor          # writes package.json and creates the tag
git push --follow-tags
```

Chenoot is pre-1.0. The minor number moves when a step of the pipeline changes
what it produces, the patch when nothing about the output changes.

## Building

`npm run dist` builds all three platforms. In practice you cannot: a macOS disk
image has to be built on macOS, so the usual sequence is to build the platform
you are on and let the release workflow build the others.

```
npm run dist:mac      # .dmg and .zip, arm64 and x64. Needs macOS.
npm run dist:mac:zip  # .zip only, buildable from any host.
npm run dist:win      # .exe, NSIS installer.
npm run dist:linux    # .AppImage.
```

Each of these runs `prebuild` first, which is the standards gate, the icon
build, the SVG export, and the renderer bundle. A build cannot be produced from
a tree that fails the standards check, which is deliberate.

Output lands in `dist/`.

## Producing the disk image

The `.dmg` is what most people will download, and it can only be built on
macOS. `hdiutil` makes the image and it does not exist anywhere else, so a
Linux or Windows machine can produce the macOS `.zip` and not the `.dmg`.

Two ways to get one:

```
npm run dist:mac
```

on a Mac, which writes `Chenoot-<version>-arm64.dmg` and an Intel build beside
it. Or push a version tag and let the release workflow build it on a macOS
runner, which is the same command on somebody else's Mac.

The image opens at 540 by 380 with the application on the left and a shortcut
to Applications on the right, so the drag is obvious without a background image
telling people to do it.

## Signing

Nothing is signed. `identity` is null in the build configuration and the
hardened runtime is off, so the artifacts are ad-hoc signed by electron-builder
and no more.

What that means for the people downloading them:

- **macOS** shows a warning that the application cannot be checked for malicious
  software. Right-click the application and choose Open, then Open again in the
  dialog. Gatekeeper remembers the decision.
- **Windows** shows a SmartScreen warning. More info, then Run anyway.
- **Linux** needs the AppImage marked executable: `chmod +x Chenoot-*.AppImage`.

Say this in the release notes every time. It is the first thing anyone hits and
the last thing they expect.

Signing certificates cost money annually and change nothing about how the
application behaves, so this is a decision to revisit when there are enough
users for the warning to be a real obstacle.

## Automated builds

`.github/workflows/release.yml` builds all three platforms when a tag beginning
with `v` is pushed, and attaches the artifacts to a draft release. The draft is
not published automatically: check the artifacts open on at least one machine
before you publish, because a broken build that nobody opened is worse than a
late one.

The workflow runs `npm run verify` on Linux before any platform builds, so a
tag on a tree that fails its own checks produces no artifacts at all.

## Release notes

Write them from `CHANGELOG.md`. The changelog is maintained by hand as changes
land, not reconstructed from commit messages at release time.

Keep the notes in the order a reader cares about: what is fixed that was
visibly broken, what is new, what changed that they will notice, and then the
platform warnings above.

## Checklist

1. `npm run verify` passes.
2. `npm run shots` if the landing page changed, and commit what it writes.
3. `CHANGELOG.md` has an entry for the version, dated.
4. `npm version <major|minor|patch>`.
5. `git push --follow-tags`.
6. Wait for the workflow, download the artifacts, open one.
7. Edit the draft release, paste the notes, publish.
