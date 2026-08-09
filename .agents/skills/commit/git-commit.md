---
name: git-commit
description: Generates professional git commit messages in English following Conventional Commits spec and Git Flow best practices, with proper type prefixes (feat, fix, chore, refactor, docs, style, test, perf, ci, build, revert). Use this skill whenever the user asks to write a commit, create a commit message, commit changes, or says things like "commit this", "generate a commit", "what should my commit say", "help me commit", or pastes a diff/list of changed files. Always trigger even if the user just describes what they changed — do not ask for confirmation, just generate the commit.
---

# Git Commit Generator

Generate structured, professional commit messages in English following [Conventional Commits](https://www.conventionalcommits.org/) and Git Flow conventions.

---

## Input sources (use whatever the user provides)

- A `git diff` or `git diff --staged` output
- A list of changed files with descriptions
- A plain-language description of what was done
- A mix of the above

If the user provides nothing but says "commit this", inspect the conversation for recent code changes and infer from context.

---

## Commit message format

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

### Rules
- **Subject line**: max 72 chars, imperative mood, no period at end, lowercase after the colon
- **Body**: wrapped at 72 chars, explains *what* and *why* (not *how*), separated from subject by blank line
- **Footer**: breaking changes (`BREAKING CHANGE: <desc>`), issue refs (`Closes #123`, `Refs #456`)
- **Language**: always English, technical but clear

---

## Type reference

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability visible to users |
| `fix` | Bug fix — corrects incorrect behavior |
| `refactor` | Code restructuring without behavior change |
| `perf` | Performance improvement |
| `style` | Formatting, whitespace, missing semicolons — no logic change |
| `docs` | Documentation only (README, comments, JSDoc) |
| `test` | Adding or updating tests |
| `chore` | Tooling, config, dependency updates, build scripts |
| `ci` | CI/CD pipeline changes (GitHub Actions, Dockerfile, etc.) |
| `build` | Build system or external dependency changes |
| `revert` | Reverts a previous commit |

### Scope (optional but recommended)
Use the affected module, component, or layer:
- `feat(auth):`, `fix(api):`, `refactor(ui):`, `chore(deps):`
- Omit scope when the change is truly cross-cutting

---

## Step 1 — Analyze the changes

Read the diff or description and identify:
1. **Primary intent** — what is the main thing being done?
2. **Affected scope** — which module/layer/component?
3. **Type** — pick the single most accurate type from the table
4. **Breaking changes** — does this change a public API or contract?
5. **Related issues** — any ticket/issue numbers mentioned?

If the changes contain **multiple unrelated concerns**, generate one commit per concern and note that the user should stage them separately.

---

## Step 2 — Generate the commit message

Output the commit message in a code block so it's easy to copy:

```
feat(auth): add JWT refresh token rotation

Implement automatic token rotation on each refresh request to reduce
the exposure window of long-lived tokens. Refresh tokens are now
single-use and a new one is issued alongside the access token.

Closes #142
```

Then briefly explain (1–2 sentences outside the code block) why you chose that type and scope.

---

## Step 3 — Offer the git command (when applicable)

If the user is in a terminal context or asks to run it, provide the ready-to-use command:

```bash
git commit -m "feat(auth): add JWT refresh token rotation" \
  -m "Implement automatic token rotation on each refresh request to reduce the exposure window of long-lived tokens. Refresh tokens are now single-use and a new one is issued alongside the access token." \
  -m "Closes #142"
```

---

## Git Flow branch naming (bonus — offer when relevant)

If the user mentions creating a branch or the change is large enough to warrant one, suggest the correct Git Flow branch name:

| Change type | Branch pattern | Example |
|---|---|---|
| New feature | `feature/<short-name>` | `feature/jwt-refresh-rotation` |
| Bug fix (non-prod) | `bugfix/<short-name>` | `bugfix/token-expiry-check` |
| Hotfix (production) | `hotfix/<short-name>` | `hotfix/null-pointer-login` |
| Release | `release/<version>` | `release/2.4.0` |
| Chore/task | `chore/<short-name>` | `chore/update-eslint-config` |

---

## Quality checklist (apply silently before output)

- [ ] Subject line is imperative mood ("add", "fix", "remove" — not "added", "fixes", "removing")
- [ ] Subject ≤ 72 characters
- [ ] No trailing period on subject line
- [ ] Body explains *why*, not just *what*
- [ ] Type matches the primary intent, not a secondary side-effect
- [ ] Scope is specific enough to be useful but not overly granular
- [ ] Breaking changes are called out in footer with `BREAKING CHANGE:`
- [ ] English throughout

---

## Examples

### Simple bug fix
```
fix(form): prevent duplicate submission on double-click

Disabled the submit button immediately on first click to avoid
sending duplicate requests when users click rapidly.
```

### Feature with breaking change
```
feat(api): replace paginated list endpoint with cursor-based pagination

Cursor pagination improves performance on large datasets and avoids
the page-drift problem when records are inserted during traversal.

BREAKING CHANGE: the `page` and `per_page` query params are removed.
Clients must use `cursor` and `limit` instead.

Closes #88
```

### Chore / dependency update
```
chore(deps): upgrade react-query to v5

v5 ships with a new devtools UI and removes the deprecated
`cacheTime` option in favor of `gcTime`.
```

### Multi-concern (tell user to split)
> "Your diff touches both the auth module and unrelated CSS cleanup. I'll generate two commits — stage them separately:"

```
refactor(auth): extract token validation into dedicated service
```
```
style(global): remove unused CSS variables and trailing whitespace
```
