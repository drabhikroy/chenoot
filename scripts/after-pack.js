// electron-builder afterPack hook. Runs once per platform right after the
// app is assembled and before signing starts.
//
// This project's working copy lives under ~/Documents, which iCloud Drive's
// "Desktop & Documents Folders" sync can attach its own extended attributes
// to as files are created here. codesign refuses to sign anything carrying
// that kind of metadata ("resource fork, Finder information, or similar
// detritus not allowed"), and electron-builder packages and signs Chenoot in
// place inside dist/, which sits inside this same synced folder. Clearing
// extended attributes and stray AppleDouble files here, before electron-
// builder hands the bundle to codesign, removes the problem before codesign
// ever sees it.

const { execFileSync } = require('node:child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;

  execFileSync('xattr', ['-cr', appPath]);
  execFileSync('find', [appPath, '-name', '._*', '-delete']);
  execFileSync('find', [appPath, '-name', '.DS_Store', '-delete']);
};
