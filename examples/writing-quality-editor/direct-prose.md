# Direct Explanation: Synthetic Development Comparison

These synthetic Korean tasks exercise reader-facing explanation, necessary limits, and restraint in local editing.
They do not reproduce a source project's manual. No exact replacement sentence is required.

## Tasks

Supply only one task and its mode's complete applicable contract to a fresh assistant. Keep the checks below out
of its input. The two arms use the same task; only the instruction text changes.

### Compose

다음 자료로 처음 읽는 운영 담당자를 위한 한국어 사용 안내를 작성해 주세요. 짧은 문단으로 읽기 쉽게 정리하고, 안내문만 주세요.

자료:
- 첫 화면의 문구는 작성자가 권장하는 예시다. 사용성 검증은 아직 완료하지 않았다. 실제 사용 전 사용성 검증이 필요하다.
- snapshot-a 실습 기록은 과거 환경에서 실행한 결과다. 현재 설치본은 이 기록으로 검증하지 않았다. 현재 설치본의 검증 결과는 제공되지 않았다.
- release qualification은 릴리스 요건 충족 여부를 확인하는 절차다. HEAD 차이만으로 요건을 충족할 수 없다. 다른 요건이나 절차는 이 자료에 없다.
- 누락된 계획과 오래된 참조를 발견했다. 이를 보완해야 계획 정렬을 마칠 수 있다. 담당자나 완료 날짜는 정해지지 않았다.
- 설정을 바꾸려면 유지보수자의 사전 승인이 필요하다.

### Revise

다음 사용 안내를 처음 읽는 운영 담당자에게 자연스럽게 읽히도록 다듬어 주세요. 제목과 문단 순서는 유지하고, 수정한 본문만 주세요. R5의 인용문은 그대로 두세요.

## R1 예시와 실습 기록
이 문안은 권장 예시이며, 사용성 검증을 완료했다는 뜻은 아닙니다. 사용성 검증은 아직 완료하지 않았으며 실제 사용 전에는 검증이 필요합니다. 아래 snapshot-a 실습은 과거 환경에서 실행한 기록이며, 현재 설치본의 검증 근거가 아닙니다. 현재 설치본의 검증 결과는 이 안내에 없습니다.

## R2 릴리스 요건
HEAD가 다르다는 사실만으로 release qualification이 성립하지는 않습니다.

## R3 계획 정렬
계획 누락이나 오래된 참조는 해결할 공백이며, 계획 정렬이 끝났다는 근거가 아닙니다. 누락된 계획과 오래된 참조를 보완해야 계획 정렬을 마칠 수 있습니다.

## R4 설정 변경
설정을 바꾸려면 유지보수자의 사전 승인이 필요합니다.

## R5 보관 문구
보관된 원문은 다음과 같습니다: “이 문안은 검증을 완료했다는 뜻은 아닙니다.”

## Checks Fixed Before Outputs

- Compose: retain example status, incomplete usability validation and its pre-use requirement, historical
  environment, unavailable current-install validation result, HEAD insufficiency, plan corrections, and prior
  maintainer approval. Do not invent owners, deadlines, qualification steps, or test history.
- Revise R1: retain the same substantive limits while allowing redundant rebuttals to become a direct explanation.
  Missing current results do not establish that no tests ever occurred.
- Revise R2: keep HEAD difference insufficient, including its technical identifiers. A necessary negative is useful;
  do not invent validation steps merely to make it positive.
- Revise R3: correction of missing plans and outdated references precedes completed alignment.
- Revise R4 and R5: retain the clear sentence and protected quotation exactly; keep headings and paragraph order.
- Separately assess whether the output explains purpose, status, or requirements directly, merely substitutes
  disclaimer synonyms, or adds a second explanation without removing the redundant first one. Judge material
  meaning, not exact rhetorical form. There is no word blacklist, negative-sentence quota, or numerical style gate.

## Development Observations

Four fresh Claude CLI sessions (`claude-opus-5-5`, high effort) compared the released 0.18.0 instructions with
an initial candidate: one Compose and one Revise task per arm. Each task received its complete applicable
contracts inline; no tools or MCP servers were available. Only the first output from each session was retained.
The checks above were fixed before generation. All four calls completed without retry or timeout.

Driver inspection found the material conditions and limits preserved in these four outputs. Both Revise arms
kept the clear approval sentence, the protected quotation, and the supplied headings. The initial candidate made
some phrasing more direct, while both arms retained duplicate explanation in R3:

| Area | Baseline observation | Initial candidate observation |
| --- | --- | --- |
| Compose historical record | Added “따라서 이 기록만으로 현재 설치본의 상태를 판단할 수 없습니다.” after already describing the old environment and missing current results | Omitted that additional rebuttal; still explained the old environment and missing current results |
| Revise R1 | Retained “현재 설치본의 검증 근거가 아닙니다.” | Used “현재 설치본에서 실행한 결과가 아닙니다.” to explain the environment distinction |
| Revise R2 | “HEAD가 다르다는 사실만으로는 릴리스 요건(release qualification)을 충족했다고 볼 수 없습니다.” | “HEAD가 다르다는 사실만으로는 릴리스 요건(release qualification)을 충족하지 않습니다.” |
| Revise R3 | Stated incomplete alignment, then repeated the correction required to finish it | Retained the same two-sentence repetition with slightly different wording |

These are small qualitative differences, not evidence that the recurring style problem is solved. The direct
R1 wording still uses a negative; negatives themselves are not the defect. R2 needs its negative constraint.

After these outputs, one local follow-up clarified the edit-span rule: adjacent sentences repeating the same
point may be treated as one span and reduced to a single direct statement with its conditions. That follow-up
received static checking only. The four outputs describe the initial candidate, not an execution of the final
follow-up. No further model calls were made. The comparison does not test automatic package loading, Codex
behavior, recurrence rates, or broad writing quality. Owner acceptance remains separate from Driver assessment.


## Targeted R3 Follow-Up — 2026-10-27

A later, owner-requested check ran only the original R3 paragraph against the final instructions. It used a fresh
Claude CLI session with `claude-opus-5-5`, high effort, the same ordinary revision request with the unrelated
quotation instruction removed, and the complete Korean Revise contracts inline. The input included neither a
preferred answer nor a special instruction to remove duplication. No other scenario or baseline was rerun.

The first output was:

> ## R3 계획 정렬
> 누락된 계획과 오래된 참조를 보완해야 계획 정렬을 마칠 수 있습니다.

The call completed in 13.24 seconds without timeout or retry. Driver inspection found the repetition removed,
with correction of missing plans and outdated references still required before alignment is complete. The heading
was preserved, and no owner, deadline, or procedural obligation was added. This verifies the final instruction
on this one case. Because R3 was isolated from the earlier five-part task, the result does not isolate the effect
of the instruction change or establish consistency across repeated runs. The earlier four-output record remains
unchanged; this check adds no evidence about the other cases, automatic loading, or Codex behavior.
