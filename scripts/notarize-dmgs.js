// electron-builder afterAllArtifactBuild hook. Runs once, after every
// target (dmg, zip) for every architecture has already been built.
//
// notarize.js (the afterSign hook) notarizes and staples the signed .app
// itself, which is what @electron/notarize's appPath argument points at
// there. electron-builder wraps that already-notarized app into a DMG
// afterward, as a separate step that hook never sees, so the DMG file
// itself carries no notarization record of its own and stapler finds
// nothing to attach. Submitting each DMG here, once every artifact exists,
// gives it one too. The zip targets need nothing further: they are built
// from the same already-stapled .app, so its ticket travels with them.

const { notarize } = require('@electron/notarize');
const { execFileSync } = require('node:child_process');

exports.default = async function afterAllArtifactBuild(buildResult) {
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.log(
      'Skipping DMG notarization: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, ' +
      'and APPLE_TEAM_ID must all be set in the environment.'
    );
    return [];
  }

  const dmgPaths = buildResult.filter(function (artifactPath) {
    return artifactPath.endsWith('.dmg');
  });

  for (const dmgPath of dmgPaths) {
    console.log(`Notarizing ${dmgPath}`);
    await notarize({
      appBundleId: 'com.abhikroy.chenoot',
      appPath: dmgPath,
      appleId,
      appleIdPassword,
      teamId
    });
    console.log(`Notarized ${dmgPath}`);

    execFileSync('xcrun', ['stapler', 'staple', dmgPath]);
    console.log(`Stapled ${dmgPath}`);
  }

  return [];
};
