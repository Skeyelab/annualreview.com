# GitHub OAuth scopes (public vs private)

PRD §11: *Best GitHub scopes for private repos vs public-only mode.*  
Use least-privilege and clear UX: **"Connect (public repos only)"** vs **"Connect (include private)"**.

---

## Public-only (minimal scopes)

For users who only want to analyze **public** repositories.

| Scope | Purpose |
|-------|--------|
| `read:user` | User login, name, avatar (sign-in identity). |
| `public_repo` | Read public repo metadata, list/read public PRs, commits, releases. |

**Not requested:** `repo`, `read:org`, or any scope that grants private access.

**UX:** Button label e.g. *"Connect GitHub (public repos only)"*. Explain: *"We only read your public repositories and activity within the selected timeframe."*

---

## Private repos (extended scopes)

For users who want to include **private** repositories in their annual review.

| Scope | Purpose |
|-------|--------|
| `read:user` | As above. |
| `repo` | Full access to private repos (read): PRs, commits, releases, issues. |

**Note:** `repo` is a broad scope. GitHub does not offer a narrower “only private read” scope; it’s all-or-nothing for repo access.

**UX:**  
- Separate action: *"Connect GitHub (include private repos)"*.  
- Explicit consent: *"This grants read access to your private repositories. We only use it to list PRs, reviews, and releases in the date range you choose. We do not store your code."*  
- Settings: allow user to **disconnect** and **delete imported data** (PRD §Auth & Data, Security).

---

## Summary

| Mode | Scopes | Use when |
|------|--------|----------|
| Public only | `read:user`, `public_repo` | Default; minimal trust. |
| Include private | `read:user`, `repo` | User opts in to private analysis. |

Implement as two OAuth flows or one flow with a query param (e.g. `?scope=public` vs `?scope=private`) so the requested scopes differ per click.
