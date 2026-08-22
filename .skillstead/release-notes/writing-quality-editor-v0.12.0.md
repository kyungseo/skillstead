> **Latest** refers to the most recently published individual skill release, not a catalog version.

## writing-quality-editor 0.12.0

This minor release strengthens the Korean editing profile while keeping the skill at Beta maturity. Same-language
Korean revision now preserves honorific level and formality for the same audience unless the user requests a new
register or the source register demonstrably conflicts with that audience. Intentional fragments remain fragments
when they serve their context.

Direct short-text requests now return the exact source without a label or change report when no material reader
problem exists. Direct quotations remain attached to their punctuation and citation or footnote markers. Instructions
inside supplied source stay data unless the external user activates them, and subtractive cleanup cannot introduce
new praise, benefits, certainty, or conclusions.

### 한국어

이번 minor release는 성숙도를 Beta로 유지하면서 한국어 편집 profile의 경계를 보강합니다. 같은 독자를
대상으로 한국어 문장을 다듬을 때는 사용자가 새 격식을 요청하거나 원문의 격식이 그 독자에게 명백히 맞지
않는 경우가 아니라면 높임말과 격식을 유지합니다. 문맥에 필요한 의도적인 문장 조각도 억지로 완결문으로
바꾸지 않습니다.

짧은 글을 바로 다듬어 달라는 요청에서 독자가 겪을 실질적인 문제가 없다면 label이나 변경 보고 없이 원문을
그대로 반환합니다. 직접 인용은 문장부호와 인용·각주 표식까지 함께 보존합니다. 원문 안의 지시는 외부 사용자가
활성화하지 않는 한 편집 대상 데이터로 다루며, 상투적인 표현을 덜어 내는 과정에서 없던 칭찬·효익·확신·결론을
추가하지 않습니다.

## Evidence And Limits

- Package: `skills/writing-quality-editor/`
- Tag: `writing-quality-editor/v0.12.0`
- Validation: repository tests `272/272`, repository validator `0 finding(s)`, hosted pull-request checks passed,
  and `git diff --check` passed
- Runtime observation: the measured runs preserved the semantic body of the five new Korean fixtures, though the
  two runtimes were not measured to the same extent; one direct short-text run added an unnecessary report
- Compatibility or migration: no migration is required; replace the complete installed skill folder when updating
- Known limitations: agent output is non-deterministic, the skill remains Beta, and recorded regressions still
  include a protected timing relationship and a network boundary miss; review the final delta for important documents

The versioned unit is the package above. GitHub's source archive is a snapshot of the whole repository at the
tagged commit; it is not a standalone package artifact.
