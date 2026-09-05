# Security

## What Chenoot is exposed to

The renderer runs sandboxed, with context isolation on and Node
integration off, and reaches the file system, a child process, or the
network only through the small set of channels declared in
preload.js, a fixed list of channel names, none accepted as a
caller-supplied parameter. Content Security Policy forbids any remote
origin: connect-src is none in the renderer, and the one exception,
local model traffic, is made by the main process instead. Window
navigation away from the bundled page is refused outright, a new
window is never opened, and an external link is handed to the system
browser rather than followed in place. Permission requests for camera,
microphone, location, or notifications are denied wholesale, since the
application needs none of them.

## What the code does about it

Reaching a language model happens one of two ways, and the difference
is stated to you before either runs. The managed local path downloads
Ollama's own published binary into the application's data directory,
verifies its size and its published checksum before anything is
executed, and runs it as an unregistered child process that starts and
stops with the run. The opt-in remote path, off by default, sends the
construct, the population, the purpose, and every generated item to
Anthropic or OpenAI; the settings screen states this in the error
color, not as a hint. An API key is encrypted through the operating
system keychain when that is available, and refused rather than
written in the clear when it is not.

Every run is written as a single file under the per-user application
data directory, including a run that failed partway, so a crash at
Step 5 still documents Steps 1 through 4. Export writers never touch
the file system themselves; they return a string and a suggested
name, and the caller decides where it goes. The one other outbound
request, an update check, is off by default, sends an ordinary HTTPS
GET to a public release endpoint with no account or machine details
attached, and only reports a version string back. Reading the
machine's memory, processor, core count, and architecture for the
model catalog is opt-in, narrow, carries no identifiers, and revoking
it discards the stored reading rather than only stopping future ones.

## Reporting a problem

Open a private security advisory through the repository, or open a
normal issue if the problem is not sensitive. Please include the
version, what you did, and what you saw. If the report touches the
remote API path, leave your API key out of it; reproducing or
diagnosing a problem never requires it.

## Scope

In scope: anything that causes the renderer to reach the file system,
a process, or the network outside the channels in preload.js, that
causes the Content Security Policy to be bypassed, that sends data to
a remote provider without the opt-in being set, or that writes a
secret to disk unencrypted. Out of scope: the two third-party
providers reachable through the opt-in remote path, which are reported
to their own security teams, and anything that requires an attacker to
already be running code on the same machine.
