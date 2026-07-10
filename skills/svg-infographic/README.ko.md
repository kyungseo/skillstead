# svg-infographic

[English](./README.md) · **한국어**

Agentic coding workflow에서 쓰는 flat하고 구조적인 기술 시각 자료를 만듭니다. 아키텍처 다이어그램, 클라우드 토폴로지, 프로세스 플로우, Before / After 비교, 로드맵, 공유용 인포그래픽에 맞춰져 있습니다. 현재 package는 Claude Code용으로 작성되어 있습니다.

skill은 먼저 레이아웃을 숫자로 확정하고(필수 layout pass — 그리기 전에 grid 산술과 박스별 텍스트 budget을 계산), 편집 가능한 SVG를 작성한 뒤, pre-render checklist로 소스를 자가검증하고, 번들된 render script로 선명한 2x PNG를 export하면서 출력 치수까지 자동 확인합니다. 목표는 렌더-수정 반복이 아니라 **첫 렌더에서 리뷰를 통과하는 결과물**입니다.

## 잘 맞는 작업

- 텍스트 설명을 아키텍처 / 토폴로지 다이어그램으로 정리
- 문서, 슬라이드, 소셜 포스트에 넣을 기술 한 장 요약
- 마이그레이션 또는 현대화 Before / After 비교
- 프로세스, 데이터, 요청 경로 플로우
- 한국어/CJK 텍스트가 깨지면 안 되는 다이어그램

## 동작 방식

skill은 **첫 렌더가 리뷰를 통과하도록** 설계된 5단계 고정 워크플로우를 따릅니다:

1. **Preflight** — 의도·대상 독자·비율·언어를 확인하고, 바꿀 수 있는 기본값을 보여주고, 파일을 쓰기 전에 출력 디렉터리를 제안합니다.
2. **Archetype 선택** — 내용에서 다이어그램 형태를 고르고(아래 표), 그 archetype의 layout 골격·premium recipe·실패 체크를 로드합니다.
3. **Layout pass** — 그리기 전에 캔버스 영역, 카드 grid, 박스별 텍스트 budget을 *숫자로* 확정합니다. 박스에 안 들어갈 문구는 깨진 렌더 후가 아니라 이 단계에서 줄입니다.
4. **저작 + 자가검증** — 계산된 숫자대로 SVG를 작성한 뒤, 소스에 대해 기계적인 pre-render checklist(containment 산술, 아이콘/화살표 참조, 대비 클래스, EN/KO geometry 동일성)를 돌립니다.
5. **렌더 + 검증** — 번들된 `scripts/render.sh`로 2× PNG를 export하면서 치수까지 자동 확인하고, 픽셀 결과를 품질 기준(렌더링·containment·메시지)으로 리뷰합니다.

이 과정을 몰라도 사용에는 지장이 없습니다 — 다만 skill이 단계마다 무엇을 알려주는지, 왜 결과물이 처음부터 맞게 나오는 편인지를 설명해 줍니다.

## 지원 Archetype

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

각 archetype은 layout 골격, premium visual recipe, 전용 체크를 [`references/archetypes.md`](./references/archetypes.md)에 갖고 있습니다. 내용이 어디에도 맞지 않으면 억지로 끼워 맞추지 않고 그렇다고 말해 줍니다.

## 프롬프트 예시

가진 것에서 시작하면 됩니다 — skill이 입력 모드에 맞춰 동작합니다:

- **brief-first** — 주제나 목표만 줄 때. skill이 핵심 질문 몇 개를 묻고 구조를 제안합니다.
- **source-first** — 문서, 메모, 기존 SVG, README 등을 줄 때. skill이 요약하고 핵심 메시지를 합의한 뒤 그립니다.
- **research-first** — "초안부터 구성해줘"라고 할 때. skill이 가정을 먼저 밝힙니다(외부 검색 가능 여부는 환경에 따라 다름).

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

더 많은 실제 프롬프트는 [예제 갤러리](https://github.com/kyungseo/skillstead/tree/main/examples/svg-infographic)에서 볼 수 있습니다: **각 예제 폴더의 README에 그 예제를 만든 프롬프트(영문·한글)가 그대로 들어 있으니**, 필요한 것과 가까운 패턴을 골라 복사해 쓰면 됩니다.

## 생성 전 안내

실제로 실행하면 skill은 파일을 만들기 전에 다음 표와 같은 기본값을 먼저 보여주고, 바꿀 수 있는 항목을 알려줍니다. 사용자는 이 단계에서 비율, 색상, 언어, 출력 위치 등을 조정할 수 있습니다.

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

파일을 쓰기 전에 skill이 현재 프로젝트 안의 출력 디렉터리를 먼저 제안합니다.

- `*.svg` — 문서, HTML, PPTX workflow에 바로 넣어 편집 가능한 핵심 vector asset
- `*.png` — 공유 이미지, 썸네일, 소셜 포스트용 2x preview/export

## 핸드오프 전 검토

skill은 마지막에 한 번이 아니라 세 단계에서 결과를 점검합니다:

- **Pre-render(소스)** — containment 산술 재확인, 아이콘/화살표 참조가 모두 정의에 연결되는지, 텍스트가 계획한 budget 안인지, accent 배경 위 대비 클래스, EN/KO 변형의 동일 geometry 공식.
- **렌더링(PNG)** — 텍스트 넘침 없음, 한국어/CJK 글자 정상(tofu 없음), PNG 치수가 정확히 2×인지 자동 검증(render script), 아이콘 렌더, SVG 편집 가능 유지.
- **메시지** — archetype이 내용에 맞고, 읽는 순서가 하나로 분명하며, 제목이 결론을 담고, 박스당 텍스트 밀도가 낮고, 깊이와 언어가 대상 독자에 맞는지.

복잡한 아키텍처·플로우 다이어그램에서는 노드 배치를 zone으로 정규화해 교차를 줄일 수 있습니다 — 강제 형식이 아니라 선택적 배치 보조입니다.

## 기본 스타일

기본값은 다음과 같습니다:

- 밝은 배경
- 차분한 technical palette
- 둥근 구조 카드와 패널
- 옅은 원형 배지 안의 단순 line icon
- 한 곳에 모은 CSS variables
- 한국어/CJK 대응 폰트 스택: Pretendard, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, sans-serif

작업 전에 skill이 이 기본값을 알려주고, 비율, 언어, brand color, 테마, 출력 형식을 바꿀 수 있게 합니다.

## 설치

이 Claude Code package를 skills 디렉터리에 복사합니다 — **전역**(`~/.claude/skills/`, 모든 프로젝트에서 사용) 또는 **프로젝트**(repo의 `.claude/skills/`, 팀원이 clone만으로 사용) 중 선택. multi-file package이므로 폴더 전체를 복사합니다:

```text
<skills-dir>/svg-infographic/
├── SKILL.md                  # core workflow (진입점)
├── references/
│   ├── archetypes.md         # archetype 카탈로그: 골격, premium recipe, 체크
│   ├── authoring.md          # 상세 규칙, icon set, 수동 render fallback
│   └── sketch.md             # opt-in 정돈된 손그림 프리셋(종이·손글씨·rough)
└── scripts/
    └── render.sh             # SVG → 2× PNG 렌더 + 치수 검증
```

전역·프로젝트 scope의 macOS, Linux, Windows용 GitHub 설치 명령은 [../../docs/INSTALL.md](../../docs/INSTALL.md)를 참고하세요.

## 예제

전체 갤러리:

**https://github.com/kyungseo/skillstead/tree/main/examples/svg-infographic**

토폴로지, 레이어/온니언 모델, Before / After 비교, 프로세스 플로우, 로드맵, 의사결정 매트릭스, CI/CD 아티팩트 승격, 이슈 트래커 승인 흐름, self-demo를 영문·한글 예제로 제공합니다.

## 범위

이 skill은 flat하고 구조적인 시각 자료에 맞춰져 있고, 요청 시 **sketch 프리셋**으로 "정돈된 손그림" 느낌(종이 배경, 한글 손글씨 폰트, rough 스트로크, 형광펜 — 배치는 계산된 그대로)도 만듭니다. 다음 작업에는 적합하지 않습니다:

- 사진 또는 일러스트 중심 마케팅 그래픽
- 막대, 선, 산점도, 히트맵 같은 통계 차트
- 마스코트, 캐릭터, 장면 일러스트 (sketch 프리셋에서도 제외)

PNG export를 사용할 수 없는 환경에서는 SVG를 먼저 제공하고 한계를 명시합니다.
