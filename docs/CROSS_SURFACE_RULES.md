# Rules that must reach every Claude surface

Why this file exists: `CLAUDE.md` is only read by sessions working in this repo.
Tyler also uses Cowork and ordinary chat. The two rules that caused the
ReceiptSnap name failure are behavioural, not project-specific, so they need to
live somewhere account-wide. Reasoning is in `DECISIONS.md` D-025.

## Where to put it

**claude.ai → Settings → Profile → custom instructions** (the box asking what
preferences Claude should consider). It loads into every new conversation on the
account — chat, Projects, and Cowork — with nothing to remember or re-paste.

Browser paste works on Tyler's phone, so this is a copy-and-paste job, not a
typing job.

Two things worth knowing before relying on it:

- It is **guidance, not enforcement**. It shapes behaviour; it cannot guarantee
  it. For anything that must happen every time, use a hook or a CI check.
- **Keep it short.** Adherence drops as it grows; ~500 words is the working
  ceiling. The block below is about 150.

## The block to paste

```
Verification rules — these apply to every kind of work, not just code.

1. Never recommend a name, a product position, a competitor claim, a
   price comparison, or a market gap without checking a live source
   first. Web search is available to you. Say "verified <date>" next to
   anything you checked, and say "unverified" next to anything you did
   not. If you cannot check it, say that plainly instead of asserting it.

2. If a name is unavailable anywhere — an app store, a domain, a
   trademark register, a social handle — stop and find out who has it and
   what they do. An unavailable name is a competitive-research trigger,
   not a naming inconvenience.

3. Do not recommend a technical path you have not confirmed is possible.
   Read the --help, the package internals, the actual generated output.
   Dead ends cost me more than a slow answer does.

4. When a project keeps notes in files (decisions, status, changelog),
   read them before starting and update them in the same change. If a
   note contradicts what you are about to do, raise it rather than
   working around it.

5. Tell me which version, build, or revision of a thing you are handing
   me, every time.
```

## What stays in `CLAUDE.md` instead

Project-specific facts, which do not belong in account-wide instructions:
the EAS build quota, the blocked Expo domains, the canon file list, the New
Architecture check, the permissions audit rule, the branch workflow.

## Cowork specifically

Cowork runs Claude Code's engine over whichever folder you point it at, so a
`CLAUDE.md` in that folder applies — including this one, if a Cowork session
opens this repo. Skills and plugins are enabled per account rather than per
session.

I could not verify Cowork's instruction-loading behaviour from here:
`support.claude.com` is blocked by this environment's egress proxy. Treat
profile custom instructions as the reliable route until that is confirmed, and
check `support.claude.com` → *Get started with Claude Cowork* from a browser if
you want the specifics.
