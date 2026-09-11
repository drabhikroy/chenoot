// electron-builder afterSign hook. Runs once per macOS target after signing
// completes, and does nothing at all for Linux or Windows targets.
//
// Notarization only makes sense for a Developer ID signed build, so this
// reads the same three credentials Docuherence's build already uses rather
// than adding a second convention: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD,
// and APPLE_TEAM_ID. When any of them is missing, the hook prints why it is
// skipping and returns, rather than failing a build that was never going to
// be notarized. That keeps dist:linux, dist:win, and a local dist:mac run
// made without those credentials on hand working exactly as before.

const { notarize } = require('@electron/notarize');

exports.default = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.log(
      'Skipping notarization: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and ' +
      'APPLE_TEAM_ID must all be set in the environment.'
    );
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`Notarizing ${appPath}`);

  await notarize({
    appBundleId: 'com.abhikroy.chenoot',
    appPath,
    appleId,
    appleIdPassword,
    teamId
  });

  console.log(`Notarized ${appPath}`);
};
