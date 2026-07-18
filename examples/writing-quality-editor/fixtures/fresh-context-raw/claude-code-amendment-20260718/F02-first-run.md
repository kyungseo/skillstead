# F02 — Post-R2 Amendment First Run (Claude Code)

- Fixture: F02 — Explained Technical Concept (intent inference: named skill without mode)
- Runtime: Claude Code (Agent tool fresh subagent)
- Observed model: `claude-fable-5`
- Reasoning effort: unobserved (session-inherited)
- Isolation: independent fresh subagent; installed skill folder read-only; examples/answer key forbidden; complete scenario metadata + user request `writing-quality-editor를 사용해 이 문서를 자연스럽고 명확하게 고쳐 줘.` (mode 미명명)
- Environment/delivery retry: 0
- Material corrective rerun: 0

## Complete Input (user request)

writing-quality-editor를 사용해 이 문서를 자연스럽고 명확하게 고쳐 줘.

(Context: profile Manual; audience an application developer who knows Git but not Acme Relay internals; constraint — preserve `atomic parity`, `pull request`, and the same-change requirement.)

```text
Atomic parity surface maintenance should be executed as a dual-artifact convergence activity. English and Korean
documents should reflect semantic deltas through a co-located pull request surface.
```

## First-Run Raw Output

**Revised Text**

```text
Maintain atomic parity between the English and Korean documents: both language versions change
together. Whenever you make a change that affects meaning, update both documents in the same
pull request.
```

**Preservation Notes**

- `atomic parity`와 `pull request` 식별자를 그대로 유지했다. `atomic parity`는 Acme Relay 내부를 모르는 독자가 문장만으로 뜻을 복원할 수 없으므로, 첫 사용 지점에서 "두 언어 버전이 함께 바뀐다"는 정의를 곁들였다 — 정의 내용은 원문의 same-change 요구와 동일하며 새 의미를 더하지 않았다.
- 핵심 요구 사항(의미가 바뀌면 영어·한국어 문서를 같은 pull request에서 함께 갱신)은 그대로 보존했다. Git을 아는 독자를 전제로 `pull request` 자체는 추가 설명 없이 두었다.

**Material Changes**

- 내부 추상어를 일반 개발자가 읽을 수 있는 문장으로 교체했다: "dual-artifact convergence activity" → 두 언어 버전이 함께 바뀐다는 직접 서술, "co-located pull request surface" → "the same pull request", "semantic deltas" → "a change that affects meaning". 지칭 대상은 동일하며 범위를 넓히거나 좁히지 않았다.
- 수동태 "should be executed" / "should reflect"를 manual 관례에 맞는 지시문(imperative)으로 바꾸고, 행위 주체를 독자("you")로 드러냈다. 요청 맥락에서 이 내용이 요구 사항(requirement)으로 명시되어 있어 규범 강도는 유지된 것으로 판단했다 — 만약 원문의 "should"가 의도적으로 권고(비강제) 수준이었다면 "You should update both documents…"로 완화할 수 있다.
