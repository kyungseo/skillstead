# 예제 — svg-infographic

[English](./README.md) · **한국어**

이 저장소에 들어 있는 산출물의 기술 인덱스입니다. 갤러리가 아닙니다 — 스킬이 무엇을 만들어내는지 둘러보려면
**[갤러리](../../gallery/index.html)** 를 여세요. 갤러리는 여기 있는 같은 파일에서 생성되며, 각 항목이 어떤
검증 근거를 갖는지 함께 표시합니다.

여기 무엇이 있고, 각 분류가 무엇까지 증명되는지는 이렇습니다.

| 분류 | 경로 | 검증 근거 |
| --- | --- | --- |
| Canonical TypePack 산출물 | [`typepacks/`](./typepacks) | `generate.mjs`가 receipt와 함께 생성. source lint·layout 통과. 현행 palette profile에서 **error 0건**, 고정된 warning debt 9색·46건. `generate.mjs verify`가 receipt와 대조해 재측정 |
| Presentation projection source | [`presentation-projections/`](./presentation-projections) | Public gallery의 선택형 derived projection PNG 3종을 만드는 하나의 verified canonical pair. 각 projection은 `gallery/presentation/` 아래에 별도 receipt를 가집니다 |
| 과도기 legacy 예제 | 아래 디렉터리들 | source lint·layout·typography까지만. receipt 없음 — TypePack 계약 이전에 만들어졌습니다 |
| 과거 릴리스 자산 | [`release-announcement/`](./release-announcement) | 공개 시점에 고정. 기록으로 보존하며 현행 계약으로 재검증하지 않습니다 |

## Canonical TypePack 산출물

9개 타입을 각각 영어·한국어로 만들고, 모든 산출물 옆에 receipt를 둡니다. 회귀를 감지하는 표면이 바로
여기입니다 — 패키지 변경이 그림을 바꾸면 가장 먼저 드러납니다.

```text
typepacks/<type>/<type>.{ko,en}.svg    # source
typepacks/<type>/<type>.{ko,en}.png    # 정확한 2× export
typepacks/<type>/<type>.{ko,en}.json   # receipt: 무엇을 소비·측정했고 어떤 패키지가 만들었는지
```

`approval-gate` · `before-after` · `cards-kpi-grid` · `decision-matrix` · `layer-stack` · `nested-scope` ·
`process-flow` · `roadmap-timeline` · `topology-component`

각 타입의 요청 문구와 생성 명령은
[`references/PROMPT-GALLERY.md`](../../skills/svg-infographic/references/PROMPT-GALLERY.md)에 있습니다.

## Presentation projection source

[`presentation-projections/`](./presentation-projections)에는 대표 canonical SVG/PNG pair 하나가 있습니다. Gallery는
이 pair를 바꾸지 않고 paper notebook, gallery wall, portrait monitor에 각각 투영합니다. 따라서 세 결과의 시각적
차이는 내용이 아니라 선택한 surface에서 옵니다. Derived PNG와 receipt는
[`gallery/presentation/`](../../gallery/presentation)에 있으며 gallery validator가 다시 검증합니다.

## 과도기 legacy 예제

TypePack 계약 이전에 만들어졌고, canonical 세트가 아직 다루지 못하는 요청 형태를 담고 있어 유지합니다.
이 중 6개는 갤러리의 현재 Featured 선정(★)이며 **Wave 2에서 교체 대상**입니다 — 남기기로 판정된 항목은
그때의 현행 계약으로 이행하거나 내려갑니다.

각 디렉터리에는 source SVG, 두 언어의 2× PNG, 그리고 그것을 만든 프롬프트가 들어 있습니다.

| 디렉터리 | |
| --- | --- |
| [`agent-system-sketch`](./agent-system-sketch) | ★ sketch 프리셋 |
| [`agent-task-matrix`](./agent-task-matrix) | ★ |
| [`agent-waiting-swimlane`](./agent-waiting-swimlane) | ★ |
| [`before-after-migration`](./before-after-migration) | ★ |
| [`cloud-infra-topology`](./cloud-infra-topology) | ★ |
| [`zero-trust-onion`](./zero-trust-onion) | ★ |
| [`ai-code-review-loop`](./ai-code-review-loop) | |
| [`ci-cd-artifact-promotion`](./ci-cd-artifact-promotion) | |
| [`incident-response-sketch`](./incident-response-sketch) | sketch 프리셋 |
| [`issue-tracker-cicd-approval-flow`](./issue-tracker-cicd-approval-flow) | |
| [`process-flow`](./process-flow) | |
| [`roadmap`](./roadmap) | |
| [`skill-overview`](./skill-overview) | |
| [`technical-infographic`](./technical-infographic) | |

모두 이 저장소를 위해 가상의, 고객과 무관한, 비공개 정보가 없는 내용으로 만들었습니다.

## 과거 릴리스 자산

[`release-announcement/`](./release-announcement)에는 `v0.8.0`과 함께 공개한 이미지가 있습니다. 공개 당시
상태로 고정돼 있으며 현행 계약으로 재검증하지 않습니다. 그 카드의 Windows 항목은 기록된 Windows 11 ARM64 VM
Codex App 실행을 가리키며 모든 Windows 환경을 뜻하지 않습니다.

## 분류별 점검 범위

전체를 하나로 묶어 주장하지 않고 분류별로 적습니다.

**Canonical TypePack 산출물** — source lint 오류 0건. 현행 palette profile 기준으로 **error 0건이며 warning은
9색 46건으로 고정**돼 있습니다 — profile이 아직 표현하지 못하는 단계이며, 색·pack·발생 수까지 묶어 두어
debt가 늘거나 옮겨가면 드러납니다. layout container·binding·reservation을 재측정. PNG는 SVG viewBox의 정확히
2×. receipt를 산출물과 대조 검증하므로, receipt가 세지만 그림에 없는 요소는 오차가 아니라 오류입니다.

**과도기 legacy 예제** — source lint·layout·typography 통과. 현행 palette profile로는 측정하지 않으며
receipt가 없습니다.

**Canonical TypePack 산출물, presentation canonical pair와 과도기 legacy 예제** (고정된 과거 릴리스 자산은 제외) — 텍스트 넘침 없음,
한국어·CJK tofu 없음, `<title>`/`<desc>` 존재, 호스트·고객 경로 없음, 아이콘 참조 정상,
짝을 이루는 박스의 여백 유지.

## 실행 환경 및 렌더링 검증

표준 렌더러 [`scripts/render.mjs`](../../skills/svg-infographic/scripts/render.mjs)는 Node.js 18 이상에서
렌더링 전에 source lint를 실행하고, Chromium 계열 브라우저를 찾아 PNG를 만든 뒤 출력 크기를
검증합니다. Bash, PowerShell과 CMD에서 바로 실행할 수 있으므로 Git Bash가 필수는 아닙니다. 선택형
[`scripts/render.sh`](../../skills/svg-infographic/scripts/render.sh)는 같은 렌더러를 호출하는
wrapper입니다.

스킬을 설치하거나 Agent가 발견하는 데는 Node가 필요하지 않습니다. Node 18 이상이 없으면 설치 전에
먼저 승인을 요청합니다. 사용자가 설치하지 않기로 해도
[`references/authoring.md`](../../skills/svg-infographic/references/authoring.md) §8의 전체 수동 원본
점검과 Chromium 직접 2× 렌더링·화면 검증 경로를 유지합니다.

| 환경 | 브라우저 | en/ko SVG → 2× PNG | 상태 |
| --- | --- | --- | --- |
| macOS | Chrome (headless) | 영문·한국어 예제 14쌍 + 새 Claude Code/Codex 고정 요구사항 | ✅ 검증 — 정확한 2×, tofu 없음, 핵심 결과 일치 |
| Windows 11 ARM64 VM | Chrome | 새 Codex App 실제 영문·한국어 fixture | ✅ 검증 — 설치, 발견, 보정, 정확한 2× 렌더링 |
| Linux / WSL | Chrome / Chromium | 문서화된 표준·수동 경로 | ⏳ 렌더링 검증 대기(한국어는 Noto Sans CJK/KR 설치) |

Windows 결과는 기록된 VM 구성에 해당하며 모든 Windows 장치나 파일 시스템을 뜻하지 않습니다.
Linux 렌더링 경로는 문서화했지만 아직 직접 검증하지 않았습니다.

## 범위

평면형 구조 다이어그램과 선택형 **sketch 프리셋**을 지원합니다. sketch 프리셋은 계산한 배치를 유지하면서
정돈된 손그림 느낌을 더합니다. 마스코트, 캐릭터와 장면 일러스트는 계속 **범위 밖**이며, 이 경계를
유지해야 결과물의 성격도 일관되게 지킬 수 있습니다.
