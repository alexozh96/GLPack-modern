# GLPack Build System v2

This folder is designed so you do not need to manually transform prompts.

## Where to put this folder

Place the entire `build-system` folder inside your project root:

```txt
glpack-modern/
  backend/
  frontend/
  build-system/
    checkpoint.md
    progress_log.md
    resume_template.txt
    phases/
    session-prompts/
```

## How to run a phase

For each phase, open the matching file in:

```txt
build-system/session-prompts/
```

Example for Phase 6:

```txt
build-system/session-prompts/run_phase_6.txt
```

Copy the entire contents into a NEW Claude Code session.

Do not paste the checkpoint manually.
Do not paste the phase file manually.
The prompt instructs Claude to read the correct files itself.

## What Claude should do automatically

At the end of the phase, Claude should:

1. Run relevant validation.
2. Update `build-system/checkpoint.md` directly.
3. Append a summary to `build-system/progress_log.md`.
4. Output the checkpoint in chat.
5. Tell you the git commit command.

## What you do after Claude finishes

Run the git command Claude gives you.

Usually:

```bash
git add .
git commit -m "Phase X complete"
```

Then start the next phase in a NEW Claude session using:

```txt
build-system/session-prompts/run_phase_X+1.txt
```

## Emergency stop prompt

If Claude starts reading too many files, paste this:

```txt
Stop. Do not read additional files.

Proceed with implementation using only the current phase file, checkpoint, and files already read.
If you believe another file is required, ask me first and explain why.
```

## Do not do these

- Do not ask Claude to read the full GLPACK_DOCUMENTATION.md.
- Do not run multiple phases in one long session.
- Do not let Claude scan the entire project unless debugging truly requires it.
- Do not manually rewrite checkpoints unless Claude fails to update the file.

## Current starting point

This package assumes:
- Phase 5 is complete.
- The next phase is Phase 6 — Authentication.
