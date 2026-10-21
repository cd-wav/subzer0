# AGENTS.md

## Repo

- Remote: https://github.com/cd-wav/conv (private)
- Branch: `main` tracks `origin/main`
- Commit identity: `cd <256783022+cd-wav@users.noreply.github.com>`

## Push workflow

The user works in VS Code. Do **not** commit or push automatically.

When the user says anything like:

- "push everything into github"
- "push it" / "push this"
- "commit and push"
- "back it up"

then:

1. `git status` / `git diff` to see what changed.
2. Stage changes (`git add -A`), excluding secrets, `.env`, `node_modules`, build output.
3. Commit with a short, descriptive, imperative message (e.g. `add csv parser`, `fix header rendering`).
4. `git push` to `origin main`.

If the push fails (auth, conflicts, rejected non-fast-forward), stop and report the error — do not force-push without explicit permission.

## Notes

- The original converter app previously in this folder was deleted on 2026-10-21 and is unrecoverable; it is not part of this repo.
