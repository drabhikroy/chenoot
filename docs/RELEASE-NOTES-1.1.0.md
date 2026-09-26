# Chenoot 1.1.0

This release changes how Chenoot chooses and checks items. Running the same
specification through 1.1.0 can return a different instrument than 1.0.5 did,
and the reasons are set out below and in the audit trail of each run.

## Item selection

When a dimension holds more usable items than you asked for, Chenoot now keeps
the items that best match the dimension definition while repeating least of
what it has already kept. The earlier rule kept the items least like the rest
of the pool, and those were often the ones that had wandered away from the
construct.

If embeddings are not available, as with the Anthropic API backend or an embedding
model that has not been installed,
the instrument is still narrowed to the number of items you asked for. Before
this release it came back with the whole draft pool, about three times that
size. The audit trail notes that near-duplicates were not checked in that case.

## Overlapping dimensions

The audit trail now reports when two dimensions are worded so similarly that
their items sit as close to each other as to the items in their own dimension.
That is worth resolving in the specification before any responses are
collected, since dimensions that do not separate in the wording are unlikely to
separate in the data.

## Reading level

Syllable counting now handles the words survey items use most, such as "your",
"able", "being", and "sometimes". Reading grades on typical items are much
closer to a dictionary count, and fewer plainly worded items are flagged.

Choosing Flesch Reading Ease in settings now works as intended. The grade target
is converted to the matching Reading Ease score, where before nearly every item
was flagged.

## Smaller corrections

Items negated with a contraction are caught by the reverse keying check.
Absolutes are caught when punctuation follows them. Every "and" and "or" in an
item is checked for a second proposition, not only the first. Changing an item's
format uses the readability measure chosen in settings. Runtime estimates draw
on past runs of the model you have selected.

## Installing

The macOS downloads are signed and notarized and open without any extra steps.
Windows and Linux downloads are unchanged in how they install. See the README
for each platform.
