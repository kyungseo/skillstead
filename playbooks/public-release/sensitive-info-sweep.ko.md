# Sensitive Information Sweep

[English](./sensitive-info-sweep.md) · **한국어**

repo를 public으로 만들기 전에 민감정보를 점검하는 절차다.

## 빠른 검색

repo 특성에 맞게 검색 패턴을 조정한다. 처음에는 넓게 찾고, match를 직접 확인한다.

추천 패턴:

```bash
rg -n --hidden --glob '!.git' --glob '!node_modules' --glob '!dist' --glob '!build' \
  'api[_-]?key|secret|token|password|passwd|credential|private[_-]?key|BEGIN [A-Z ]*PRIVATE KEY|AWS_|GITHUB_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|SLACK_|DISCORD_|DATABASE_URL|MONGO_URI|POSTGRES_|MYSQL_|REDIS_URL'
```

```bash
rg -n --hidden --glob '!.git' --glob '!node_modules' --glob '!dist' --glob '!build' \
  '/Users/|/home/|C:\\\\Users|localhost|127\\.0\\.0\\.1|internal|private|corp|staging|prod'
```

## 확인할 파일

- [ ] `.env*`
- [ ] config files
- [ ] CI files
- [ ] deployment files
- [ ] docs and examples
- [ ] generated artifacts
- [ ] screenshots and exported PDFs
- [ ] metadata를 포함할 수 있는 binary files
- [ ] package metadata

## Git History

private 상태에서 작업량이 많았던 repo는 history도 검토한다.

- [ ] 이전 commit에 secret이 들어간 적이 있는지 확인한다.
- [ ] 큰 binary artifact에 private metadata가 있는지 확인한다.
- [ ] history rewrite가 필요한지 판단한다.
- [ ] credential이 commit된 적이 있다면 나중에 삭제했더라도 rotate한다.

도움 되는 명령:

```bash
git log --all --oneline --decorate
git log --all --name-only --pretty=format: | sort -u
git grep -n 'TOKEN\|SECRET\|PASSWORD\|API_KEY' $(git rev-list --all)
```

큰 repo에서는 history-wide command를 조심해서 실행한다.

## Generated Artifacts

- [ ] PDF에 local username, internal path, hidden comments가 노출되지 않는다.
- [ ] Office files에 의도치 않은 author/company metadata가 없다.
- [ ] Screenshot에 local path, terminal, credential, private tab이 보이지 않는다.
- [ ] Example data는 synthetic이거나 공개 가능하다고 판단했다.

## 판단

public 전환 전 아래 중 하나로 결론을 낸다.

- [ ] 그대로 공개 가능
- [ ] 작은 cleanup 후 공개 가능
- [ ] credential rotation 전까지 block
- [ ] history rewrite 전까지 block
