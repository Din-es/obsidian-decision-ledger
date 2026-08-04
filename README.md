# Decision Ledger

Keep your design notes honest. This plugin renders the **live code** a decision
governs, right inside the note that explains it — and tells you when that code
has drifted away from what the note claims.

> **Requires a separate CLI and is desktop-only.** The plugin is a front end for
> [`ledger`](https://github.com/Din-es/Ledger_c), a small Go binary that does
> the git work. Install that first — see [Requirements](#requirements).

## The problem

You write down why you made a decision. Months later the code has moved, been
refactored, or deleted, and the note still confidently describes something that
no longer exists. Nobody notices, because nothing ever checks.

## What this does

Put a `ledger` block in any note:

````markdown
```ledger
id: jitter-backoff
```
````

It renders the code that decision governs, fetched from your repository at read
time, with a status:

| Status | Meaning |
|---|---|
| **tracked** | The anchor still matches its code |
| **drifted 67%** | Relocated by similarity — the code changed since you wrote this |
| **code gone** | The governed code no longer exists, so the decision is probably stale |

There is also a sidebar listing every decision in the repository, worst first,
so you can see at a glance which of your notes have rotted.

The id can come from the note's frontmatter instead:

```yaml
---
ledger-id: jitter-backoff
---
```

## Requirements

The plugin shells out to the `ledger` binary, which reads your git history.

```
go install github.com/Din-es/Ledger_c/cmd/ledger@latest
```

Or download a binary for Windows, macOS or Linux from
[Releases](https://github.com/Din-es/Ledger_c/releases).

Because it runs a local process, this plugin is **desktop only** — it cannot
work on Obsidian mobile.

## Setup

1. Install the plugin.
2. In its settings, set:
   - **Ledger binary** — the full path to `ledger` (or just `ledger` if it is on
     your `PATH`)
   - **Repository path** — the full path to the git repository the decisions
     live in
3. In that repository, run `ledger init`, then anchor your first decision:

```
ledger bind src/auth/retry.go:11-14 --note jitter-backoff --title "Jittered backoff"
```

**Tip:** the cleanest setup is keeping your notes *inside* the repository, so
vault paths and repo paths are the same thing. A separate vault works, but you
will be mapping paths by hand.

## Commands

| Command | What it does |
|---|---|
| Open decision ledger | The staleness sidebar, worst decisions first |
| Resolve all decisions | Re-check every decision against the current code |
| Show stale decisions | Notice listing anything not currently tracked |

## Troubleshooting

**`spawn ledger ENOENT`** — the plugin cannot find the binary. Put its full
path in settings, or add it to your `PATH`.

**Nothing renders / settings seem ignored** — check the plugin's `data.json` is
valid JSON. On Windows, use forward slashes in paths (`C:/Users/you/ledger.exe`)
to avoid escaping mistakes.

**Everything says "code gone" right after cloning** — the resolver needs real
git history; a shallow clone has nothing to compare against.

## Development

```bash
npm install
npm run dev     # watch mode
npm run build   # typecheck + bundle to main.js
```

Copy `main.js`, `manifest.json` and `styles.css` into
`<vault>/.obsidian/plugins/decision-ledger/`.

## Links

- [`ledger` CLI and full documentation](https://github.com/Din-es/Ledger_c)
- [Getting started guide](https://github.com/Din-es/Ledger_c/blob/main/GETTING_STARTED.md)
- [Report an issue](https://github.com/Din-es/obsidian-decision-ledger/issues)

MIT licensed.
