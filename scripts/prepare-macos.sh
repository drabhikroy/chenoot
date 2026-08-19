#!/bin/bash
# Prepares an unsigned Chenoot.app to run on macOS.
#
# Run it as ./prepare-macos.sh, or as bash prepare-macos.sh. Running it with
# sh will not work: this uses bash arrays and process substitution, and macOS
# runs sh in POSIX mode where neither exists.
#
# Three separate things are handled here, and only fixing one leaves the
# application blocked.
#
# QUARANTINE is the flag macOS attaches to anything that arrived from another
# machine. On its own it produces the milder unidentified developer dialog.
#
# THE SIGNATURE is what actually stops the application running. Since Big Sur,
# arm64 executables on Apple Silicon must carry a valid code signature or the
# kernel refuses them. A build produced on Linux carries none, because signing
# is only possible on macOS. An ad-hoc signature satisfies the kernel and
# asserts nothing about who built the software, which is the honest position
# for a build you produced yourself.
#
# SIGNING ORDER is what an earlier version of this script got wrong twice.
# Apple discourages codesign --deep, and on a bundle with four frameworks and
# four helper applications it produces a signature that fails validation.
# Nested code has to be signed from the inside out. The second mistake was
# worse: codesign errors were sent to /dev/null and the signing loops ran
# inside pipelines, so a nested failure was both invisible and unable to stop
# the script. Every error is now printed, and every step is checked.

set -uo pipefail

APP="${1:-Chenoot.app}"

if [ -n "${POSIXLY_CORRECT:-}" ] || [ -z "${BASH_VERSION:-}" ]; then
  echo "This script needs bash. Run it as: bash $0 $APP" >&2
  exit 1
fi

if [ ! -d "$APP" ]; then
  echo "Could not find $APP in $(pwd)" >&2
  echo "Usage: ./prepare-macos.sh [path to Chenoot.app]" >&2
  exit 1
fi

failures=0

# Errors are printed rather than swallowed. A signing script that hides what
# codesign said is worse than no script, because the person is left with a
# failure and no way to act on it.
sign() {
  local target="$1"
  local output
  if ! output=$(codesign --force --sign - --timestamp=none "$target" 2>&1); then
    echo "  FAILED  $target" >&2
    echo "          $output" >&2
    failures=$((failures + 1))
    return 1
  fi
  return 0
}

# Extended attributes are the most common cause of codesign refusing a bundle,
# reported as resource fork, Finder information, or similar detritus not
# allowed. Three passes are needed rather than one, because the usual advice of
# xattr -cr clears only part of the problem.
#
# The recursive clear handles ordinary attributes including quarantine.
#
# AppleDouble files, named with a leading ._ , are separate. They are how a
# volume that cannot store extended attributes natively, such as exFAT or a
# network share or the inside of a zip archive, carries them instead. xattr does
# not see them at all, and codesign refuses a bundle containing them. A build
# that has been zipped on one platform and unzipped on macOS frequently has
# them, which is exactly the path these packages take.
#
# The per-file clear catches attributes on individual files that survived the
# recursive pass, which happens when a parent directory clears successfully and
# its children do not.
echo "Clearing quarantine and extended attributes"
xattr -cr "$APP" || true

echo "Removing AppleDouble metadata files"
find "$APP" -name '._*' -delete 2>/dev/null || true
find "$APP" -name '.DS_Store' -delete 2>/dev/null || true

echo "Clearing attributes file by file"
find "$APP" -exec xattr -c {} \; 2>/dev/null || true

echo "Removing any existing signatures"
while IFS= read -r signature; do
  rm -rf "$signature"
done < <(find "$APP" -name "_CodeSignature" -type d)

# Collected into arrays rather than piped into a loop. A pipeline runs its loop
# in a subshell, so the failure counter incremented inside it was discarded and
# every nested failure went unreported.
echo "Signing libraries"
libraries=()
while IFS= read -r item; do libraries+=("$item"); done \
  < <(find "$APP" \( -name "*.dylib" -o -name "*.node" \) -type f)
for item in "${libraries[@]:-}"; do
  [ -n "$item" ] && sign "$item"
done

echo "Signing bundled helper executables"
helpers=()
while IFS= read -r item; do helpers+=("$item"); done \
  < <(find "$APP" -path "*/Helpers/*" -type f -perm -u+x)
for item in "${helpers[@]:-}"; do
  [ -n "$item" ] && sign "$item"
done

# Versioned frameworks are signed at Versions/A. Signing the bundle root of a
# versioned framework produces a signature macOS will not accept.
echo "Signing frameworks"
for framework in "$APP/Contents/Frameworks/"*.framework; do
  [ -d "$framework" ] || continue
  if [ -d "$framework/Versions/A" ]; then
    sign "$framework/Versions/A"
  else
    sign "$framework"
  fi
done

echo "Signing helper applications"
for helper in "$APP/Contents/Frameworks/"*.app; do
  [ -d "$helper" ] || continue
  sign "$helper"
done

echo "Signing the application"
sign "$APP"

if [ "$failures" -gt 0 ]; then
  echo
  echo "$failures item(s) failed to sign. The messages above say why." >&2
  echo

  # Offered as a command to run rather than done automatically. It deletes and
  # replaces the application, and a script that does that unasked after
  # reporting a failure is not a script anyone should trust.
  if [ "$failures" -gt 0 ]; then
    echo "If the message mentions resource fork or Finder information, the" >&2
    echo "bundle still carries metadata that codesign refuses. Rebuilding it" >&2
    echo "without any metadata clears that for certain:" >&2
    echo >&2
    echo "  ditto --norsrc --noextattr --noqtn \"$APP\" /tmp/cleaned.app" >&2
    echo "  rm -rf \"$APP\"" >&2
    echo "  mv /tmp/cleaned.app \"$APP\"" >&2
    echo "  bash $0 \"$APP\"" >&2
    echo >&2
    echo "ditto copies the bundle while stripping resource forks, extended" >&2
    echo "attributes, and quarantine, which is more thorough than clearing" >&2
    echo "them in place." >&2
    echo >&2
    echo "If it persists after that, the application is on a volume that does" >&2
    echo "not preserve macOS metadata: a network share, an exFAT or FAT32" >&2
    echo "drive, or a cloud-synced folder. Move it to ~/Applications first." >&2
  fi
  exit 1
fi

echo "Verifying"
if codesign --verify --deep --strict --verbose=2 "$APP" 2>&1 | sed 's/^/  /'; then
  echo
  echo "Signature is valid."
else
  echo
  echo "Verification reported a problem. The output above says where." >&2
  exit 1
fi

cat <<'NOTE'

One more step on macOS Sequoia and later.

Sequoia removed the right-click and Open bypass. The first launch is still
refused. When it is:

  1. Open System Settings, then Privacy and Security.
  2. Scroll to the bottom. A message naming Chenoot will be there,
     with an Open Anyway button beside it.
  3. Click Open Anyway, then confirm.

That message only appears after an attempt has been blocked, so try to open the
application first and then go looking for it.

This is required once. Afterwards it opens normally.

Ollama must be running, with llama3.1:8b and nomic-embed-text pulled.
NOTE
