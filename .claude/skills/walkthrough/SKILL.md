---
name: walkthrough
description: Explain part of this codebase as a linear walkthrough the human can learn from, following how data and control actually flow. Usage — /walkthrough <area, file, flow, or "slice N">
disable-model-invocation: true
argument-hint: "<area, file or flow>"
---

Give me a linear walkthrough of: $ARGUMENTS

- Read the code before explaining it; don't describe it from memory or from file names.
- Follow the real flow (entry point → … → result), not the folder structure.
- For each step: `path:line-range`, a short excerpt (at most ~15 lines), what it does, and *why* it's built that way — cite `docs/DECISIONS.md` or `docs/VISION.md` where they explain it.
- Point out the one or two places where a bug would hurt most, and which tests protect them.
- Suggest 2–3 small changes I could make myself to learn (for example, "add hits to the skater line"), with the files and tests involved.
- Finish with three questions that check my understanding, and put the answers at the very end under "Answers".
- Don't modify any files.
