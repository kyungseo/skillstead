# F12 — Post-R2 Amendment First Run (Claude Code)

- Fixture: F12 — Preserve Already-Natural Text (intent inference: unnamed natural revision)
- Runtime: Claude Code (Agent tool fresh subagent)
- Observed model: `claude-fable-5`
- Reasoning effort: unobserved (session-inherited)
- Isolation: independent fresh subagent; installed skill folder read-only; examples/answer key forbidden; complete scenario metadata + user request `이 문서를 자연스럽게 고쳐 줘.` (skill/mode 미명명)
- Environment/delivery retry: 0
- Material corrective rerun: 0

## Complete Input (user request)

이 문서를 자연스럽게 고쳐 줘.

(Context: profile README; audience developers.)

```text
Acme Diff compares two configuration files and highlights values that changed. Run `acme-diff before.yml after.yml`
to print a local report; the command does not upload either file.
```

## First-Run Raw Output

검토를 마쳤습니다. 결론부터 말씀드리면, 이 문서는 이미 README와 개발자 독자에게 자연스럽고 효과적인 상태라서 고칠 부분이 없습니다. 후보 변경을 모두 검토했지만 전부 취향 차이 수준(Neutral)이었고, 의미 있는 개선 없이 표현만 바꾸는 것은 오히려 문서를 훼손하는 일이라 원문을 그대로 유지합니다.

**Revised Text**

```text
Acme Diff compares two configuration files and highlights values that changed. Run `acme-diff before.yml after.yml`
to print a local report; the command does not upload either file.
```

**Preservation Notes**

- 정보 순서가 README에 이상적입니다: 제품이 무엇을 하는지(설정 파일 비교, 변경 값 강조) → 가장 짧은 성공 경로(실행 명령) → 개발자가 신경 쓰는 경계 조건(파일을 업로드하지 않음) 순으로 이어집니다.
- 명령어 `acme-diff before.yml after.yml`과 파일명이 정확히 보존되어야 하는 식별자이며, 인라인 코드 형식도 그대로 유지했습니다.
- "the command does not upload either file"은 프라이버시 관련 사실 주장(claim)입니다. 세미콜론으로 실행 안내에 붙여 둔 현재 구조가 "로컬 리포트"라는 표현과 자연스럽게 호응하므로, 문장을 분리하거나 표현을 강화/완화하지 않았습니다.
- 문장 리듬과 어휘가 개발자 대상 README의 관례에 맞고, 번역투나 군더더기 프레이밍이 없습니다.

**Material Changes**

None
