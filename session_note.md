# Session Note — 2026-08-19

## Summary

No structural/geotechnical engineering work was done this session. The session was a short Q&A about Claude Code tooling itself, not the opt-bh project.

## Q&A: Claude Code "To Do list"

**Question:** How can I see the To Do list in Claude Code?

**Answer:**
- Claude Code has no persistent, user-facing to-do list UI. There is no `/todo` command, keyboard shortcut, or dedicated panel to view one on demand.
- During multi-step work, Claude may use an internal todo-tracking tool that renders a checklist inline in the conversation/terminal — but only while actively in use for that task. It disappears from view once the task/session output scrolls on; there's nothing to "reopen."
- To get a durable, always-visible task list across sessions, the practical options are:
  - Ask Claude to maintain a `todo.md` (or similar) file in the repo, updated as work progresses.
  - Use `/loop` to have Claude periodically check and report status on an ongoing task.
- User declined both options for now — just wanted to understand how the system works.

## Open items

None. No changes made to any project files (CIPBeamOptimizer.jsx, CIP_Beam_Optimizer.html, etc.) this session.
