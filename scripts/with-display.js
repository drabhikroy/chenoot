// Runs a command that needs a window server.
//
// Linux runners have no display, so the command has to go through xvfb-run.
// macOS and Windows already have one, and xvfb-run does not exist there, so
// the command runs directly. Without this split, verify passes on the release
// runner and fails on the machine where the work is actually done.

const { spawnSync } = require("node:child_process");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("with-display needs a command to run.");
  process.exit(2);
}

// The -a flag picks a free display number rather than assuming one is open.
const useXvfb = process.platform === "linux";
const command = useXvfb ? "xvfb-run" : args[0];
const rest = useXvfb ? ["-a", ...args] : args.slice(1);

const result = spawnSync(command, rest, { stdio: "inherit" });

// A command killed by a signal reports a null status, which would otherwise
// read as success and let a failing check through the gate.
if (result.error) {
  console.error(`with-display could not start ${command}. ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);