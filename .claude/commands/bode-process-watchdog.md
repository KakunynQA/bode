---
command_name: bode-process-watchdog
description: Inspect, report, and optionally terminate long-running commands during a Bode workflow.
---

# /bode-process-watchdog - Long-Running Process Watchdog

Use this when a command, dev server, test run, build, CI poll, or external tool appears stuck during a Bode workflow.

Default timeout: **30 minutes**. The timeout is configurable per task, per phase, or per command.

## Policy

The watchdog must investigate before killing a process. Terminate only when the process is clearly stuck, has no useful progress signal, blocks the next phase, or is safe to restart.

## Inputs

`$ARGUMENTS` may include:

- `--timeout <minutes>`: override the default 30-minute threshold.
- `--pid <pid>`: inspect a specific process.
- `--command "<text>"`: identify the command by command line text.
- `--action inspect|terminate|ask`: default is `inspect`.
- `--task <task-slug>`: attach notes to an active Bode task.

If no process is identified, list candidate long-running processes and ask the user which one to inspect.

## Investigation Steps

1. Identify elapsed runtime, command line, working directory, child processes, CPU use, memory use, and recent output/log files if available.
2. Check whether the process is expected to be long-running: dev servers, watch mode, Docker services, and CI polling are usually expected; tests, builds, codegen, lint, deploy, and migration commands should have progress or a known upper bound.
3. Look for progress: recent stdout/stderr, changed files or logs, network or child-process activity, and test/build phase markers.
4. Decide: `continue`, `terminate`, or `ask`.
5. If terminated, record the reason and next diagnostic command.

## Safe Termination Rules

Safe to terminate without asking:

- Hung lint/typecheck/test/build/codegen commands with no progress after timeout.
- Repeated CI polling command that can be rerun.
- Local dev server started only for validation and not needed anymore.

Ask before terminating:

- Database migrations, seed scripts, deploy scripts, FTP/SFTP uploads, Docker volume operations, or any command that may be mutating remote state.
- Any process with unknown purpose.
- Any process started by the user outside the Bode workflow.

Never terminate:

- Processes unrelated to the current task.
- System processes.
- User-owned editors, terminals, browsers, or shells unless explicitly requested.

## Report Format

```markdown
## Process Watchdog Report

- Process: <pid and command>
- Runtime: <duration>
- Timeout threshold: <duration>
- Progress signal: <found | not found | unclear>
- Risk of termination: <low | medium | high>
- Decision: <continue | terminate | ask>
- Action taken: <none | terminated pid ...>
- Next step: <specific command/action>
```

## Bode Integration

- Append the report to the active plan's Implementation notes when a plan exists.
- If memory logging is mandatory, record the watchdog decision in the current phase memory log under `## Issues`.
- If the watchdog terminates a process, rerun the narrowest diagnostic command before resuming the phase.
