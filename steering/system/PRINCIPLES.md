# Principles: the agent system

The direction of tumach-dance for the agent system (how the runs work): what the owner prefers when two good options
compete. They come from the owner's decisions in Larspolo/aoe2mc (its `steering/system/PRINCIPLES.md`, until
2026-10-30). `steering/system/DECISIONS.md` is the log of the new decisions. The project principles are P1 to P4 and P11 in
`steering/project/PRINCIPLES.md`; the numbers do not repeat.

How to use it:
- **Agents.** Before you recommend an option (decision ticket, PR, epic), compare each option with these principles.
  Recommend the option that follows them, and name the principle ("follows P6"). When two principles conflict, say
  so in the ticket: that is a real decision for the owner.
- **Owner.** Edit this file at any time: the agents follow the version on `main`.

## P5. Ship "fine for now", expand later

Take the smallest option that works now, and make the next step a later ticket. Do not block on the ideal version.

## P6. The time of Lars and Nina is the scarcest resource

Ask only what a person must judge. Measure, test and close the rest yourself.
- Ask only when there are several clear options and no single best one, and only on GitHub or the page "For Nina".
- Never ask for times, values or texts that a test can check. Assign a check only when you think it is fully okay.
- Group the tasks of the owner in one session, with a guide. Without a report of a fault, assume it works.

## P7. Done means the whole scope

An epic closes when each item of its full scope works, or the owner excluded it with a reason. Each owner question
gets an answer. The end goal is a site that Nina uses each day, not a demo.

## P8. Use the whole quota, and improve only from data

Use each usage window to its limit. Change the process only where data shows a loss, and measure the effect. A lever of
the `improve` skill whose signal is above its threshold is data enough (P10). Expensive checks (many browser runs) only
when they are really needed.

## P9. Fix the cause in all places, with a check or a structure, not a rule

When one cause shows in many places, fix all of them. Prefer a structure that prevents the fault (a data file, a
workflow) or a check that fails (a test, a lint) to a rule that each agent must remember. Data and configuration files
exist so that a change there needs no change of code or tests: no test checks their content, only their form and the
behavior of the code.

## P10. The system improves itself boldly, and counts work, not time

The owner must never have to suggest an improvement of the system. Make each change that pays, also a redesign, also
one that needs owner steps. A wait to measure a change counts merged PRs ("wait 50 PRs"), never hours.

## Tensions

- P5 against P7: "fine for now" is a step, not the end. An epic stays open until the later step is done or excluded.
- P6 against quality: the owner does not check each item. A check closes on the agent's evidence.
- P8 against P10: P8 measures before and after each change; P10 does not wait for a measured loss when a known lever
  is above its threshold.
