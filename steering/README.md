# Steering files

The owner steers tumach-dance with the files in this directory. `system/` holds the preferences for the agent system
(how the runs work). `project/` holds the preferences for the project (what the site becomes). The project
principles are P1 to P4 and P11, the system principles P5 to P10: the numbers do not repeat (a new principle takes
the next free number).

| File | Who writes it | Kind |
|---|---|---|
| `system/PRINCIPLES.md` | The agent, from the owner's decisions. The owner edits it at any time. | system |
| `system/DECISIONS.md` | The agent, one line for each answer of the owner. | system |
| `system/system.toml` | The owner: the pacing of the runs and the reviews. | system |
| `project/PRINCIPLES.md` | The agent, from the owner's decisions. The owner edits it at any time. | project |
| `project/DECISIONS.md` | The agent, one line for each answer of the owner. | project |
| `project/ROADMAP.md` | The owner (a new feature line), and the agent (done features, `roadmap` skill). | project |
