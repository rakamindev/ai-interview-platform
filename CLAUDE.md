<!-- project-memory:start -->
## Project memory
This project keeps persistent memory in `.memory/` (Markdown, shared by all agents) — follow the `project-memory` skill.
- Start of every task: read `.memory/index.md`, `.memory/progress.md` and, if present, `~/.agents/memory/user.md` (skip what a `[project-memory]` message already provided). Triage `.memory/inbox.md` if it has items.
- For a new request, look for related memory: `bash .agents/skills/project-memory/scripts/mem.sh search <keywords>`.
- Before editing an area: `bash .agents/skills/project-memory/scripts/mem.sh path <file>`; ask before touching anything tagged `#hold`.
- While working: record decisions, user corrections and gotchas immediately. Before finishing: update `.memory/progress.md`.
- Never write secrets into memory.
<!-- project-memory:end -->
