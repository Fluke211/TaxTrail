# Parser corpus

Raw Apple Vision output from real receipts, one file per receipt:

```
<name>.txt              the ocrText exactly as the device produced it
<name>.expected.json    optional — fields the parser must get right
```

Populated from the app's **Summary → Parser diagnostics** export. Each entry's
`ocrText` becomes one `.txt` here, named `<merchant>-<date>`.

`.expected.json` holds only the fields worth pinning, e.g.

```json
{ "total": 140.35, "taxTotal": 7.16, "merchant": "Costco" }
```

Run `npm run test:score` to score the corpus. Mismatches against an
`.expected.json` fail; triage flags (no total, uncategorized, low confidence)
are reported but do not fail — an unparsed receipt is a to-do, not a regression.

These are real receipts. Keep anything sensitive out of the repo.
