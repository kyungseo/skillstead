# Sensitive Information Sweep

**English** · [한국어](./sensitive-info-sweep.ko.md)

Use this procedure to check for sensitive information before making a repository public.

## Quick Search

Adjust the search patterns to the repository. Start broadly, then inspect every match.

Suggested patterns:

```bash
rg -n --hidden --glob '!.git' --glob '!node_modules' --glob '!dist' --glob '!build' \
  'api[_-]?key|secret|token|password|passwd|credential|private[_-]?key|BEGIN [A-Z ]*PRIVATE KEY|AWS_|GITHUB_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|SLACK_|DISCORD_|DATABASE_URL|MONGO_URI|POSTGRES_|MYSQL_|REDIS_URL'
```

```bash
rg -n --hidden --glob '!.git' --glob '!node_modules' --glob '!dist' --glob '!build' \
  '/Users/|/home/|C:\\\\Users|localhost|127\\.0\\.0\\.1|internal|private|corp|staging|prod'
```

## Files To Review

- [ ] `.env*`
- [ ] Configuration files
- [ ] CI files
- [ ] Deployment files
- [ ] Documentation and examples
- [ ] Generated artifacts
- [ ] Screenshots and exported PDFs
- [ ] Binary files that may contain metadata
- [ ] Package metadata

## Git History

Review the history of any repository that accumulated substantial work while private.

- [ ] Check whether any earlier commit contained a secret.
- [ ] Check large binary artifacts for private metadata.
- [ ] Decide whether a history rewrite is necessary.
- [ ] Rotate any credential that was committed, even if it was later removed.

Useful commands:

```bash
git log --all --oneline --decorate
git log --all --name-only --pretty=format: | sort -u
git grep -n 'TOKEN\|SECRET\|PASSWORD\|API_KEY' $(git rev-list --all)
```

Use history-wide commands carefully in large repositories.

## Generated Artifacts

- [ ] PDFs do not expose a local username, internal path, or hidden comment.
- [ ] Office files do not contain unintended author or company metadata.
- [ ] Screenshots do not show a local path, terminal, credential, or private tab.
- [ ] Example data is synthetic or has been confirmed safe for public use.

## Decision

Choose one conclusion before making the repository public:

- [ ] Safe to publish as-is
- [ ] Safe after a small cleanup
- [ ] Blocked until credentials are rotated
- [ ] Blocked until history is rewritten
