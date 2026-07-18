# Public Release Playbook

**English** · [한국어](./README.ko.md)

This is a personal checklist for taking a private repository public.

The playbook is not tied to any one project. Keep project-specific decisions and execution records in the target
repository; keep reusable public-release procedures and review criteria here.

## Documents

| File | Purpose |
| --- | --- |
| `github-public-release-checklist.md` | End-to-end public-release checklist, including GitHub Release title and notes preparation |
| `sensitive-info-sweep.md` | Sensitive-information review guide |
| `repo-settings-template.md` | Baseline GitHub repository settings |
| `post-public-verification.md` | Verification immediately after a repository becomes public |
| `recurring-release-protection-checkpoint.md` | Protection review before every version release after publication |
| `social-release-note-template.md` | Template for preparing a public announcement |

Korean mirrors use the same names with the `.ko.md` suffix.

## Operating Principles

Review this playbook before changing repository visibility.

For each target repository:

1. Create a Work item for the public-release effort, or reuse an existing one.
2. Complete the pre-public checks before changing visibility.
3. Make the repository public only after confirming a clean baseline.
4. Run `post-public-verification.md` immediately after changing visibility.
5. If you plan to create a GitHub Release, prepare the title and notes before publishing it.
6. If you plan to announce the release publicly, prepare a short announcement.
7. Record blocked settings, GitHub plan constraints, and manual follow-up work in the target repository.
