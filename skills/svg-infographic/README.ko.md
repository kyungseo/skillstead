# svg-infographic

[English](./README.md) · **한국어**

에이전트 기반 코딩 작업에 필요한 평면형 기술 시각 자료를 만듭니다. 아키텍처 다이어그램, 클라우드
토폴로지, 프로세스 흐름, 변경 전후 비교, 로드맵과 공유용 인포그래픽에 적합합니다. Claude Code와
Codex에서 사용할 수 있습니다.

스킬은 그림을 그리기 전에 격자와 박스별 글자 분량을 계산해 레이아웃을 수치로 확정합니다. 그 결과를
바탕으로 편집 가능한 SVG를 만들고, 명백한 오류를 찾는 source lint를 실행한 뒤, 포함된 렌더링
스크립트로 선명한 2× PNG를 내보내며 크기까지 자동 검증합니다. 목표는 렌더링과 수정을 반복하는 대신
**첫 렌더링부터 검토를 통과할 수 있는 결과물**을 만드는 것입니다.

## 실행 환경 지원

**Supported: Claude Code + Codex.** macOS에서 Claude Code와 Codex가 같은 고정 요구사항을 완전히 새로운
작업으로 수행해 결과를 대조했고, Windows 11 ARM64 VM에서도 새 Codex App 작업으로 실제
다이어그램을 보정하고 렌더링했습니다. Windows 검증 결과는 이 VM 구성에 해당하며 모든 Windows 장치나
파일 시스템을 뜻하지 않습니다. Linux 브라우저 렌더링 경로는 문서화했지만 아직 직접 검증하지 않았습니다.

## 잘 맞는 작업

- 텍스트 설명을 아키텍처 / 토폴로지 다이어그램으로 정리
- 문서, 슬라이드, 소셜 포스트에 넣을 기술 한 장 요약
- 마이그레이션 또는 현대화 Before / After 비교
- 프로세스, 데이터, 요청 경로 플로우
- 한국어/CJK 텍스트가 깨지면 안 되는 다이어그램

## 동작 방식

스킬은 **첫 렌더링부터 검토를 통과하도록** 설계된 다섯 단계를 따릅니다.

1. **사전 확인** — 의도, 대상 독자, 비율과 언어를 확인합니다. 바꿀 수 있는 기본값과 필요한
   도구를 확인하고, 파일을 만들기 전에 출력 디렉터리를 제안합니다.
2. **형태 선택** — 내용에 맞는 다이어그램 유형을 고르고(아래 표), 해당 유형의 배치 골격,
   시각 표현 지침과 실패 점검 항목을 불러옵니다.
3. **레이아웃 계산** — 그리기 전에 캔버스 영역, 카드 격자와 박스별 글자 분량을 *수치로*
   확정합니다. 박스에 들어가지 않을 문구는 렌더링이 깨진 뒤가 아니라 이 단계에서 줄입니다.
4. **SVG 작성과 source lint** — 계산한 수치에 맞춰 SVG를 작성한 뒤,
   `scripts/check-svg.mjs`로 끊어진 참조, 명시하지 않았거나 지나치게 큰 marker 크기와 명백한
   text overflow를 찾습니다. 추정에 따른 warning은 통과로 간주하지 않고 직접 확인합니다.
5. **렌더링과 검증** — `scripts/render.sh`가 browser를 열기 전에 lint를 다시 실행하고 2× PNG를
   내보내면서 크기를 자동 확인합니다. 그다음 실제 이미지의 렌더링, 배치와 메시지를 검토합니다.

이 과정을 몰라도 스킬을 사용할 수 있습니다. 다만 각 단계에서 어떤 안내를 받는지, 결과물이 처음부터
안정적으로 나오는 이유가 궁금할 때 참고할 수 있습니다.

## 지원하는 다이어그램 유형

| 이런 내용을 주면 | 이렇게 그립니다 |
| --- | --- |
| 시스템/컴포넌트와 그 연결 | 토폴로지 / 컴포넌트 다이어그램 |
| 순서 있는 단계나 핸드오프 | 프로세스 플로우 (병렬 트랙은 swimlane 변형) |
| 승인 게이트가 있는 단순 요청 경로 | Approval / sequence-lite |
| 선택지·트레이드오프·정성 평가 | 의사결정 / 리스크 매트릭스, 또는 카드 |
| 이전 vs 이후 | Before / After 패널 |
| 계층 구조나 포함 관계 | Layer stack, 또는 중첩 "온니언" 모델 |
| 시간, 단계, 마일스톤 | 로드맵 / 타임라인 |
| 몇 개의 핵심 항목이나 숫자 | 아이콘 카드 / KPI grid (차트 아님) |

각 유형의 배치 골격, 시각 표현 지침과 전용 점검 항목은
[`references/archetypes.md`](./references/archetypes.md)에 있습니다. 내용에 맞는 유형이 없으면 억지로
끼워 맞추지 않고 그 사실을 알려줍니다.

## 프롬프트 예시

현재 가지고 있는 자료부터 제시하면 됩니다. 스킬은 입력 형태에 맞춰 작업합니다.

- **brief-first** — 주제나 목표만 주면 핵심 질문 몇 가지를 확인한 뒤 구성을 제안합니다.
- **source-first** — 문서, 메모, 기존 SVG나 README를 주면 내용을 정리하고 핵심 메시지를 확인한 뒤 그립니다.
- **research-first** — "초안부터 구성해 줘"라고 요청하면 먼저 가정을 밝힙니다. 외부 검색 가능 여부는
  실행 환경에 따라 다릅니다.

```text
svg-infographic으로 이 클라우드 아키텍처를 깔끔한 토폴로지 다이어그램으로 그려줘:
Application Gateway -> APIM -> AKS -> PostgreSQL.
```

```text
svg-infographic으로 이 모놀리스-마이크로서비스 전환 계획을 Before / After 인포그래픽으로 바꿔줘.
```

```text
svg-infographic으로 이 4가지 레이어를 설명하는 한국어 4:5 소셜 인포그래픽을 만들어줘.
```

## 상세 프롬프트 예시

레이아웃, 강조점, 검증 기준까지 맡기고 싶을 때는 조금 더 긴 프롬프트를 쓰면 좋습니다.

```text
svg-infographic으로 아래 내용을 한국어 기술 인포그래픽으로 만들어줘.

주제: AI 코드 리뷰 루프

대상 독자: PR 리뷰 파이프라인 동작을 훑어보는 엔지니어
핵심 메시지: 루프 안의 AI 리뷰어가 사람 승인 전에 위험한 변경을 잡아낸다
(핵심 메시지를 주면 제목이 주제 라벨이 아니라 결론을 앞세울 수 있다)

목표:
- 개발자가 PR을 올린 뒤 AI agent가 리뷰하고, 사람이 승인하고, 변경사항이 다시 반영되는 흐름을 한눈에 보여준다.
- 문서나 소셜에 공유할 수 있는 깔끔한 flat technical infographic 스타일로 만든다.

구성:
1. Developer opens PR
   - 코드 변경
   - 테스트 결과 첨부
2. AI Review Agent
   - diff 분석
   - 위험 지점 표시
   - 테스트 누락 확인
3. Human Reviewer
   - 판단이 필요한 코멘트 확인
   - false positive 정리
4. Patch & Verify
   - 수정 반영
   - 테스트 재실행
5. Merge Ready
   - 승인 완료
   - PR merge

표현 방식:
- 왼쪽에서 오른쪽으로 흐르는 process flow
- 각 단계는 둥근 카드로 표현
- 각 카드에는 간단한 line icon을 넣기
- AI Review Agent 단계는 강조 색상으로 표시
- 하단에 작은 legend를 넣기:
  - solid arrow = normal path
  - dashed arrow = feedback loop

출력:
- 현재 프로젝트 안의 적당한 디렉터리를 먼저 제안하고 확인받은 뒤 파일을 생성해줘.
- SVG 원본과 2x PNG를 모두 만들어줘.
- 한국어 글자가 깨지지 않는지 확인해줘.
- 기본 스타일, 폰트, 색상은 skill 기본값을 쓰되, 작업 전에 바꿀 수 있다고 알려줘.
```

더 많은 실제 프롬프트는 [예제 갤러리](https://github.com/kyungseo/skillstead/tree/main/examples/svg-infographic)에서
볼 수 있습니다. **각 예제 폴더의 README에는 결과물을 만들 때 사용한 영문·한국어 프롬프트가 그대로
들어 있습니다.** 필요한 결과와 가까운 예제를 골라 활용하면 됩니다.

## 생성 전 안내

스킬을 실행하면 파일을 만들기 전에 다음 기본값과 변경 가능한 항목을 먼저 보여줍니다. 이때 비율,
색상, 언어와 출력 위치 등을 조정할 수 있습니다.

| 항목 | 기본값 | 변경 가능 |
| --- | --- | --- |
| 스타일 | flat / muted technical, 밝은 배경 | dark mode, 요청 시 손그림 **sketch 프리셋** |
| 아이콘 | soft 원형 배경 + line icon | 배경 없는 line, solid, mono |
| 폰트 | Pretendard -> Apple SD Gothic Neo -> Malgun Gothic / Noto Sans KR 폴백 | 지정 폰트 |
| 색상 | 단계별 semantic 색상, 핵심 카드 accent | 브랜드 색상 |
| 비율 | 요청에 맞춰 선택, 예: wide landscape 또는 4:5 social | 원하는 크기 |
| 언어 | 프롬프트 기준으로 추론 | 한국어, 영어, bilingual |
| 출력 | 현재 프로젝트 안에 SVG + 2x PNG | SVG만 |
| Footer | 없음 | 요청 시 source / date / author footer(워터마크 아닌 라벨형 footer) |

## 출력

파일을 만들기 전에 현재 프로젝트 안의 출력 디렉터리를 먼저 제안합니다.

- `*.svg` — 문서, HTML과 PPTX 작업에서 편집할 수 있는 원본 벡터 이미지
- `*.png` — 공유 이미지, 썸네일과 소셜 게시물에 쓸 수 있는 2× 출력본

## 핸드오프 전 검토

결과물은 마지막에 한 번만 보는 것이 아니라 세 가지 관점에서 점검합니다.

- **렌더링 전 원본** — source lint가 hard error의 위치와 수정 방향을 알려줍니다. 영역 포함 관계,
  색상 대비, 영문판과 한국어판의 배치 일치와 heuristic warning은 별도로 직접 확인합니다.
- **PNG 렌더링** — 글자가 넘치지 않는지, 한국어/CJK 글자가 깨지지 않는지, PNG 크기가 정확히
  2×인지, 아이콘이 정상적으로 보이는지, SVG가 계속 편집 가능한지 확인합니다.
- **메시지** — 다이어그램 유형이 내용에 맞는지, 읽는 순서가 분명한지, 제목이 결론을 담는지,
  박스마다 글자가 지나치게 많지 않은지, 설명 수준과 언어가 대상 독자에게 맞는지 확인합니다.

복잡한 아키텍처나 흐름도에서는 노드를 여러 배치 구역으로 묶어 연결선 교차를 줄일 수 있습니다.
필수 형식이 아니라 필요할 때만 쓰는 배치 보조 방법입니다.

## 기본 스타일

기본값은 다음과 같습니다.

- 밝은 배경
- 차분한 technical palette
- 둥근 구조 카드와 패널
- 옅은 원형 배지 안의 단순 line icon
- 한 곳에 모은 CSS variables
- 한국어/CJK 대응 폰트 스택: Pretendard, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, sans-serif

작업 전에 skill이 이 기본값을 알려주고, 비율, 언어, brand color, 테마, 출력 형식을 바꿀 수 있게 합니다.

## 요구 사항과 Node가 없을 때의 진행 방법

스킬을 설치하거나 Agent가 스킬을 발견하는 데는 Node.js가 필요하지 않습니다. 편집 가능한 SVG도
Node 없이 작성할 수 있습니다. 자동 lint부터 PNG 검증까지 전체 workflow를 사용하려면 다음 도구가
필요합니다.

- `scripts/check-svg.mjs`와 표준 렌더러 `scripts/render.mjs` 실행을 위한 Node.js 18 이상
- PNG 출력을 위한 Chrome, Edge 또는 Chromium

선택형 `scripts/render.sh` wrapper를 사용하려면 Bash가 필요합니다(Windows에서는 Git Bash). Windows
PowerShell이나 CMD에서는 `node scripts/render.mjs`를 바로 실행할 수 있습니다.

검사기는 Node.js 표준 라이브러리만 사용하므로 `npm install`이나 별도의 npm package는 필요하지
않습니다. Agent는 작업을 시작할 때 설치된 Node 버전을 확인합니다. Node 18 이상이 없으면 현재
환경의 package manager에 맞는 정확한 설치 명령을 보여주고, Node를 대신 설치한 뒤 자동 검증을
계속할지 묻습니다. 사용자 승인 없이 시스템을 변경하거나 원격 `curl | sh` installer를 실행하지
않습니다.

설치를 원하지 않아도 이전 버전의 품질 기준은 유지합니다. Agent가 전체 수동 원본 점검을 수행하고,
Chrome, Edge 또는 Chromium을 직접 실행해 2× PNG를 만든 뒤 크기와 실제 화면을 확인합니다. 결과를
전달할 때는 자동 source lint를 실행하지 않았다는 사실과, 수동 원본 점검 및 PNG 검증을 통과했다는
사실을 구분해서 알려줍니다. 운영체제에서 PNG 크기를 읽을 방법을 찾지 못한 경우에도 그 제한을
따로 밝힙니다. Chromium 계열 browser도 없을 때만 두 제한을 명시한 SVG-only 초안으로 마무리합니다.

## 설치

Claude Code 또는 Codex의 skills 디렉터리에 패키지를 복사합니다. Claude Code는 전역
`~/.claude/skills/` 또는 프로젝트의 `.claude/skills/`를 사용하고, Codex는 전역
`~/.agents/skills/` 또는 프로젝트의 `.agents/skills/`를 사용합니다. 여러 파일로 구성된 패키지이므로
폴더 전체를 복사해야 합니다.

```text
<skills-dir>/svg-infographic/
├── SKILL.md                  # 핵심 작업 절차(진입점)
├── references/
│   ├── archetypes.md         # 다이어그램 유형별 골격, 시각 표현 지침, 점검 항목
│   ├── authoring.md          # 상세 규칙, 아이콘 모음, 수동 렌더링 대안
│   └── sketch.md             # 선택형 정돈된 손그림 프리셋(종이·손글씨·거친 선)
└── scripts/
    ├── check-svg.mjs         # source lint gate(Node.js 18 이상, 표준 라이브러리만 사용)
    ├── check-svg.test.mjs    # fixture regression test
    ├── fixtures/             # 정상·오류·warning case
    ├── render.mjs            # shell 공통 표준 lint → browser 렌더링 → 2× 검증
    ├── render.test.mjs       # renderer 탐색과 lifecycle regression test
    └── render.sh             # render.mjs를 호출하는 얇은 Bash wrapper
```

macOS, Linux와 Windows에서 전역 또는 프로젝트 경로에 설치하는 명령은
[../../docs/INSTALL.md](../../docs/INSTALL.md)를 참고하세요.

## 예제

전체 갤러리:

**https://github.com/kyungseo/skillstead/tree/main/examples/svg-infographic**

토폴로지, 계층·온니언 모델, 변경 전후 비교, 프로세스 흐름, 로드맵, 의사결정 매트릭스,
CI/CD 아티팩트 승격, 이슈 트래커 승인 흐름과 스킬 자체 소개를 영문·한국어 예제로 제공합니다.

## 범위

이 스킬은 평면형 구조 시각 자료에 적합합니다. 요청하면 **sketch 프리셋**으로 종이 배경, 한국어
손글씨 폰트, 거친 선과 형광펜을 사용한 "정돈된 손그림" 느낌도 만들 수 있습니다. 이 경우에도 배치는
계산한 값을 따릅니다. 다음 작업에는 적합하지 않습니다.

- 사진 또는 일러스트 중심 마케팅 그래픽
- 막대, 선, 산점도, 히트맵 같은 통계 차트
- 마스코트, 캐릭터, 장면 일러스트 (sketch 프리셋에서도 제외)

PNG export를 사용할 수 없는 환경에서는 SVG를 먼저 제공하고 한계를 명시합니다.
