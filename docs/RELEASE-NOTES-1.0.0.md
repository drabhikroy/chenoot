# Chenoot 1.0.0

Chenoot builds psychometric survey instruments on your own machine and keeps a
record of every decision it made along the way. You give it a construct, who you
are asking, and why. It returns a questionnaire with a response scale, and an
audit trail you can hand to a reviewer.

Nothing leaves your computer. The models run locally through Ollama.

## What it does

Nine steps run unattended once started.

1. Reads your specification and records what is missing.
2. Splits the construct into dimensions and gives each a share of the items.
3. Optionally recalls comparable published scales for phrasing conventions.
4. Drafts about three times the items you asked for.
5. Checks every item for reading grade, length, double-barreled wording,
   absolutes, negation, leading phrasing, and social desirability.
6. Rewrites what failed, up to three rounds, then drops what will not converge.
7. Removes near-duplicates using embeddings and narrows to your target count.
8. Chooses a response scale from a catalog of twenty and takes the anchor
   labels from that catalog.
9. Compiles the instrument and renders the audit trail.

If something missing would change what gets measured, the run stops and asks
rather than guessing.

## What you get

The instrument, with items grouped by dimension and an administration order
that does not present dimensions as blocks. Alongside it, a record of every
decision, marked according to whether it was measured in code, judged by the
model, or recalled without a source to confirm it.

Export to Word, PDF, JSON, CSV, or plain text, or straight into Qualtrics,
REDCap, or Google Forms.

## Response scales

Scales print the most positive anchor first, which is what most published
instruments do. Any item can be turned around on its own, and one control
reverses every scale in the instrument.

The point numbers follow the ascending scale whichever way the anchors are
printed, so a five point scale reading from Very satisfied prints 5 4 3 2 1.
Reversing how a scale reads never changes what a response is worth, and a
completed questionnaire stays scorable without knowing how it was laid out.

## Two references built in

**Formats** covers every response scale the pipeline can attach to an item, what
each measures well, where it goes wrong, and the survey methodology behind it,
with citations to Dillman, Krosnick, Schwarz, Saris, and others.

**Item types** covers the wider vocabulary of survey item design after Dillman,
Smyth, and Christian, grouped by the seven properties an item is classified on.

## Before you start

You need two things and the application sets up both. Setup fetches Ollama into
its own folder if you do not already have it, then downloads a model. Nothing is
installed system wide. If you already run Ollama, Setup finds it and uses it.

A run takes minutes rather than seconds. The estimate on the New screen is a
rough figure until a few runs have finished, after which it is measured from
what your machine has actually done.

## Requirements

- macOS 11 or later, Windows 10 or later, or a modern Linux distribution.
- About 16 GB of memory for a 7B model, more for larger ones.
- Around 10 GB of disk for the runtime and one model.

## Installing

Take the `.dmg` on macOS, the `.exe` on Windows, or the `.AppImage` on Linux.

Nothing is signed, so the first launch needs one extra step.

- **macOS**: right-click the application, choose Open, then Open again.
- **Windows**: More info, then Run anyway.
- **Linux**: `chmod +x Chenoot-*.AppImage` before running it.

## What comes next

Chenoot writes instruments. It does not yet analyze the responses they collect,
and that is the next piece of work.

The intention is to take a completed dataset back into the application and run
the checks a scale needs before anyone reports results from it: item and scale
statistics, internal consistency, item-total correlations, and the factor
structure the dimensions imply. The audit trail already records which items
belong to which dimension and which are reverse keyed, so the instrument arrives
carrying most of what an analysis needs to know about it.

Some of that work suits methods that find structure rather than test for it,
and where those are used the same rule will apply as everywhere else here: the
application will say what it ran, on what, and what it assumed, and it will not
present a result as settled because a procedure completed.

No timeline is attached to this. It is written here so the direction is clear
and not as a commitment about a date.

## Known limitations

- The Qualtrics `.qsf` export is built from the structure Qualtrics itself
  writes, and has not been confirmed against a Qualtrics import. The advanced
  format text export is the documented path and is the safer choice.
- What the pipeline produces is a first draft on defensible conventions. It has
  not been validated by running it with respondents, and it needs piloting like
  any other instrument.
- Grounding is off by default, because a local model asked to recall published
  scales will invent them.

## License

PolyForm Noncommercial License 1.0.0. Any noncommercial purpose is permitted,
including personal study, research, teaching, and use by charities, educational
institutions, public research bodies, and government.
