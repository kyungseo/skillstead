# Current Catalog Standard Mapping

현재 package 4개를 authoring 표준에 대조한 결과입니다. 적용 가능성을 기록하며 runtime·maturity
claim은 변경하지 않습니다.

| 표준 영역 | docs-claim-check | github-release-guide | svg-infographic | writing-quality-editor |
| --- | --- | --- | --- | --- |
| EN/KO package README | adopt — pair 존재 | adopt — pair 존재 | adopt — pair 존재 | adopt — pair 존재 |
| Folder = frontmatter name | adopt — M1 | adopt — M1 | adopt — M1 | adopt — M1 |
| Use·do-not-use 경계 | adopt — 명시됨 | adopt — 명시됨 | adopt — 명시됨 | adopt — 명시됨 |
| Self-contained license | adopt — M1 byte equality | adopt — M1 byte equality | adopt — M1 byte equality | adopt — M1 byte equality |
| 상세 `references/` 분리 | not applicable — compact package contract | adapt — profile reference | adapt — authoring/archetype reference | adapt — editing/adaptation reference |
| Required-reference failure | not applicable — required package reference 없음 | adopt — profile 누락 시 Guided mutation 차단 | adopt — required authoring reference 누락 시 automated path 차단 | adopt — required reference 누락 시 revision 차단 |
| Mutation approval | adopt — advisory/no-edit 경계 | adopt — action별 approval | adopt — output path·system change approval | adopt — host workflow·mutation boundary |
| Fresh-context evidence | adapt — synthetic assessment evidence | adapt — release-profile evidence | adopt — frozen fresh-context brief | adopt — fresh-context behavior fixture |

## Gap과 disposition

- **Naming lifecycle:** 현재 public identity는 input이며 rename 후보가 아닙니다. 새 pre-publication
  naming procedure는 future package에 적용하고 공개 후 in-place rename은 지원하지 않습니다.
- **Independent review evidence:** future material package change에 review가 필요하면 relay template을
  사용합니다. 모든 과거 변경이 새 template을 사용했다고 소급해서 주장하지 않습니다.
- **Bilingual parity:** 현재 pair가 존재하고 repository validation은 green입니다. 문장 수 일치는
  gate가 아니므로 material parity는 계속 review obligation입니다.
- **Scripts:** `svg-infographic`은 executable script와 기존 runtime fixture를 소유합니다. V1
  authoring template에는 script가 없으며 script-runtime claim도 하지 않습니다.

## Evidence Boundary

현재 package tree와 production repository validator를 근거로 한 mapping입니다. 새로운 runtime,
locale, provider, maturity support를 증명하지 않습니다.
