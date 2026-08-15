# github-release-guide 예제

[English](./README.md) · **한국어**

이 디렉터리에는 [`github-release-guide`](../../skills/github-release-guide/README.ko.md)가 약속한 대로
동작하는지 확인하기 위한 가상 예제와 다이어그램이 있습니다. 실제 저장소나 고객 자료는 사용하지 않았으며,
스킬을 설치할 때 이 예제 폴더까지 복사할 필요는 없습니다.

각 파일의 용도는 다음과 같습니다.

- [`fixtures/scenarios.md`](./fixtures/scenarios.md) — 가상 저장소 상태와 사용자 요청
- [`fixtures/expected-outcomes.md`](./fixtures/expected-outcomes.md) — 준비 상태 판정, 중단 사유, 승인,
  변경 및 복구에서 기대하는 결과를 정리한 정답표
- [`fixtures/runtime-assess-state.md`](./fixtures/runtime-assess-state.md)와
  [`fixtures/runtime-missing-reference-state.md`](./fixtures/runtime-missing-reference-state.md) — 정답을 보지 않은
  새 실행 환경에서도 같은 핵심 결과가 나오는지 확인하는 입력
- [`fixtures/runtime-safety-critical-state.md`](./fixtures/runtime-safety-critical-state.md) — 승인 뒤 상태 변경,
  저장소 공개 전 별도 동의, 원격 저장소 전송(push) 승인 범위, 태그 충돌, 강제 전송(force-push) 거부를
  다루는 안전 예제 5개
- [`fixtures/validation-evidence.md`](./fixtures/validation-evidence.md) — 각 시나리오를 어떤 방식으로 확인했고
  어디까지 검증했는지 기록한 표
- [`example-assessment.md`](./example-assessment.md) — `Assess` 전체 결과 예제
- [`example-guided-preview.md`](./example-guided-preview.md) — 저장소 공개 전환을 승인받기 전에 보여주는 예제
- [`release-announcement/`](./release-announcement/) — 한국어 LinkedIn 릴리스 게시용 세로형 SVG와 2× PNG.
  의도적으로 영문 대응본을 만들지 않았습니다.

## 이 스킬이 하는 일

| 방식 | 결과 |
| --- | --- |
| `Assess`(점검) | 저장소를 바꾸지 않고 준비 상태, 확인된 사실, 아직 모르는 정보, 필요한 결정, 건너뛸 때의 위험과 가장 안전한 다음 행동 하나를 알려줍니다. |
| `Guided`(단계별 진행) | 변경할 내용과 영향을 먼저 보여주고 현재 상태를 다시 확인합니다. 그다음 승인을 두 범위로 나눠 받습니다 — 저장소 명령을 실행하는 승인과 저장소를 변경하는 승인. 승인한 작업 하나만 실행한 뒤 실제 결과를 검증합니다. |

V1은 github.com에 이미 존재하는 비공개 저장소를 처음 공개 상태로 전환할 때 사용하고, 공개된 뒤에는 새
버전을 릴리스할 때마다 반복해서 사용할 수 있습니다. 저장소 생성, Git 초기화, 패키지 저장소 공개,
바이너리 서명, 클라우드 배포, 보안 감사, 강제 전송과 커밋 기록 다시 쓰기는 지원 범위에 포함되지 않습니다.

예제에 나오는 `northwind-labs/fieldnotes-fixture`는 설명을 위해 만든 이름이며 실제 저장소나 제품이 아닙니다.

## 한눈에 보는 진행 방식

**진행 방식과 릴리스 유형** — 어떤 방식을 고르고 어느 profile에서 동작하는지. `Guided`는 세 가지 진입
조건이 모두 충족될 때만 시작합니다. Assess를 마쳤고, release-critical blocker를 해소했고, 전환을
명시적으로 선택했을 때입니다.

[![Assess는 저장소를 바꾸지 않고 점검해 Ready·Needs attention·Blocked 중 하나를 돌려주며, Guided는 세 가지 진입 조건을 모두 충족할 때만 시작하고, 두 방식 모두 first-public 또는 version-release profile에서 동작한다](./mode-profile-map/mode-profile-map.ko.png)](./mode-profile-map/mode-profile-map.ko.svg)

**변경 작업의 승인 과정** — Guided가 변경 하나를 실행하는 방법. 실행 승인은 저장소 명령을 실행해야 하는
경로에서만 받고, 변경 승인은 두 경로 모두에서 받습니다. 서로를 대신하지 않으며, 재확인에서 상태가 바뀌면
둘 다 무효가 됩니다.

[![Guided는 변경마다 먼저 보여주고 실행 직전에 다시 확인한 뒤, 명령 실행이 필요할 때만 실행 승인을 받고 변경 승인은 언제나 받으며, 미리 보여준 것만 실행하고 실제 결과를 확인한 뒤 계속하거나 중단한다](./approval-safety-loop/approval-safety-loop.ko.png)](./approval-safety-loop/approval-safety-loop.ko.svg)

두 그림 모두 수정 가능한 SVG와 크기가 검증된 2× PNG로 제공합니다. 한국어판과 영문판은 좌표를 공유하고
문안만 다릅니다.

### 한국어 릴리스 게시 이미지

[![공개된 사본은 완전히 회수할 수 없으므로 Assess는 저장소를 바꾸지 않고 점검하고, Guided는 명령 실행 승인과 저장소 변경 승인을 따로 받으며, 공개 상태 변경은 별도로 승인받고, 승인한 변경만 실행한 뒤 실제 결과를 확인한다는 한국어 LinkedIn 게시 이미지](./release-announcement/release-announcement.ko.png)](./release-announcement/release-announcement.ko.svg)

이 세로형 이미지는 한국어 LinkedIn 게시를 위해 만든 단일 언어 자산이므로 영문 대응본이 없는 것이
의도된 상태입니다. EN/KO mirror parity 검사에서는 이 폴더를 예외로 처리하되, 릴리스 전 출처·인증 정보·
호스트 경로·민감 정보 검사에는 반드시 포함합니다.

`release-announcement.v0.9.0.ko.svg`와 그 PNG는 v0.9.0 게시물의 frozen 사본입니다. 출처 보존용으로
두며 어떤 문서에서도 링크하지 않고, 계약이 바뀌어도 갱신하지 않습니다 — 현행 내용은 위 자산을 보세요.

SVG를 고친 뒤에는 PNG를 다시 렌더합니다(저장소 루트에서 실행).

```bash
bash skills/svg-infographic/scripts/render.sh \
  examples/github-release-guide/release-announcement/release-announcement.ko.svg \
  examples/github-release-guide/release-announcement/release-announcement.ko.png --scale 2
```
