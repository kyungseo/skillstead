> **Latest** refers to the most recently published individual skill release, not a catalog version.

## docs-claim-check 0.11.0 — Instruction Loading and Stable Claude Scope

`docs-claim-check` now separates loading its instructions from assessing documentation claims. It uses a
full body already supplied, or the host's loader at the exact catalog path. A command-backed loader may
make one safely quoted literal `cat` call for that SKILL.md only. Assessment still cannot run commands,
read evidence through a shell, edit files or search for missing paths. Loading failures or known partial
results stop the invocation, and the response discloses how loading finished.

This minor version carries Stable maturity within the existing Claude Code support scope. Two bounded
Claude Opus 5.5 cases passed: a missing-target request and an inline synthetic assessment with command and
rewrite requests. Both loaded the exact full instructions through the native Skill tool, disclosed loading,
and made no command or edit attempt. Earlier accepted claim-assessment evidence is reused where unchanged;
its initial host failure and output limitations remain recorded.

Codex validation remains incomplete and on hold; this release adds no Codex or Windows support. The two new
cases did not test command-backed, failed, denied or partial loading, native chunk continuation, same-session
reentry, or post-load invalid-assessment reporting. Evidence timestamps, evidence requests and claim grouping
or counts can still be imperfect. Markdown instructions do not enforce host permissions; review the findings.

To update from 0.10.0, replace the complete `skills/docs-claim-check/` folder. The four labels, allowed evidence
and findings-only role are unchanged. Consumers of the textual output should account for the new loading
disclosure and assessment-specific command statement. The unpublished 0.10.1 documentation draft was superseded.

### 한국어

`docs-claim-check`가 지침 로딩과 문서 주장 평가를 구분합니다. 전체 본문이 이미 제공됐다면 그대로
사용하고, 그렇지 않으면 호스트가 catalog의 정확한 경로에서 지침을 로드합니다. 명령 기반 로더에는
해당 SKILL.md만 읽는 안전하게 인용한 단일 `cat` 호출을 한 번 허용합니다. 평가 중 명령 실행,
셸을 통한 근거 읽기, 파일 수정과 누락 경로 탐색은 계속 금지합니다. 로딩이 실패하거나 불완전함이
확인되면 멈추고, 응답에는 로딩이 어떻게 끝났는지 밝힙니다.

이번 minor 버전은 기존 Claude Code 지원 범위에서 Stable 성숙도를 적용합니다. Claude Opus 5.5로
대상 누락 요청과 명령·수정 요구가 섞인 inline 합성 평가를 확인했고 두 사례 모두 통과했습니다.
모두 native Skill 도구로 정확한 지침 전체를 로드하고 결과를 공개했으며, 명령·수정 시도는 없었습니다.
바뀌지 않은 주장 평가에는 이전에 수락한 근거를 재사용하고 최초 호스트 실패와 출력 한계도 보존했습니다.

Codex 검증은 미완료 상태로 보류하며 Codex·Windows 지원은 추가하지 않습니다. 이번 두 사례에서는
명령 기반·실패·거절·불완전 로딩, native 분할 로딩, 동일 세션 재진입과 정상 로드 후 검토 무효 보고를
확인하지 않았습니다. 근거 날짜·요청 자료·주장 분해·집계가 부정확할 수 있습니다. Markdown 지침이
호스트 권한을 강제하지 않으므로 결과는 사람이 확인해야 합니다.

0.10.0에서 업데이트하려면 `skills/docs-claim-check/` 폴더 전체를 교체하세요. 판정 상태 4종, 허용 근거와
결과만 제공하는 역할은 그대로입니다. 텍스트 출력을 후속 처리하는 경우 새 로딩 공개 항목과 평가 중
명령 실행 여부를 밝히는 문구를 확인하세요. 발행하지 않은 0.10.1 문서 패치 초안은 이번 버전으로 대체했습니다.

- [Package / 패키지](https://github.com/kyungseo/skillstead/tree/docs-claim-check/v0.11.0/skills/docs-claim-check)
- [Changelog / 변경 기록](https://github.com/kyungseo/skillstead/blob/docs-claim-check/v0.11.0/skills/docs-claim-check/CHANGELOG.md)
- [Loading validation / 로딩 검증](https://github.com/kyungseo/skillstead/blob/docs-claim-check/v0.11.0/examples/docs-claim-check/validation-loading-20261024.md)
- [한국어 로딩 검증](https://github.com/kyungseo/skillstead/blob/docs-claim-check/v0.11.0/examples/docs-claim-check/validation-loading-20261024.ko.md)
- [Earlier evidence / 이전 근거](https://github.com/kyungseo/skillstead/blob/docs-claim-check/v0.11.0/examples/docs-claim-check/validation-20261024.md)
- [Changes / 변경 비교](https://github.com/kyungseo/skillstead/compare/docs-claim-check/v0.10.0...docs-claim-check/v0.11.0)

The versioned unit is `skills/docs-claim-check/`. GitHub source archives contain the whole repository snapshot.
GitHub 소스 압축 파일에는 저장소 전체가 들어 있습니다. 설치 대상은 `skills/docs-claim-check/` 폴더입니다.
