# Decisions: the agent system

The log of the owner's decisions: one line per decision, the newest at the end. `steering/system/PRINCIPLES.md` generalizes
them. Runs only add lines here (`merge=union` in `.gitattributes`).

Columns: date · ticket · decision · recommendation (`taken`, `changed`: the owner combined or changed it, `other`:
the owner chose another option, `-`: no recommendation) · principle (`P<n>`, or `new` when no principle predicts it).

- 2026-10-30 · - · Three lanes: main, haiku and deep · - · new
- 2026-10-30 · #12 · Nina logs in with a code by email on a new device; then the app offers a passkey for the later logins (#19, #26) · changed · P1
- 2026-11-01 · - · The 7-day usage does not limit the runs: week_guard = false, only the 5-hour window counts · - · new
