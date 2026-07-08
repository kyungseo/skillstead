<!-- English: [README.md](./README.md) -->

# svg-infographic

Claude Code에서 flat하고 구조적인 기술 시각 자료를 만듭니다. 아키텍처 다이어그램, 클라우드 토폴로지, 프로세스 플로우, Before / After 비교, 로드맵, 공유용 인포그래픽에 맞춰져 있습니다.

먼저 편집 가능한 SVG를 만들고, Chromium 기반 브라우저를 사용할 수 있으면 선명한 2x PNG까지 export합니다.

## 잘 맞는 작업

- 텍스트 설명을 아키텍처 / 토폴로지 다이어그램으로 정리
- 문서, 슬라이드, 소셜 포스트에 넣을 기술 한 장 요약
- 마이그레이션 또는 현대화 Before / After 비교
- 프로세스, 데이터, 요청 경로 플로우
- 한국어/CJK 텍스트가 깨지면 안 되는 다이어그램

## 프롬프트 예시

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

## 생성 전 안내

실제로 실행하면 skill은 파일을 만들기 전에 다음 표와 같은 기본값을 먼저 보여주고, 바꿀 수 있는 항목을 알려줍니다. 사용자는 이 단계에서 비율, 색상, 언어, 출력 위치 등을 조정할 수 있습니다.

| 항목 | 기본값 | 변경 가능 |
| --- | --- | --- |
| 스타일 | flat / muted technical, 밝은 배경 | dark mode |
| 아이콘 | soft 원형 배경 + line icon | 배경 없는 line, solid, mono |
| 폰트 | Pretendard -> Apple SD Gothic Neo -> Malgun Gothic / Noto Sans KR 폴백 | 지정 폰트 |
| 색상 | 단계별 semantic 색상, 핵심 카드 accent | 브랜드 색상 |
| 비율 | 요청에 맞춰 선택, 예: wide landscape 또는 4:5 social | 원하는 크기 |
| 언어 | 프롬프트 기준으로 추론 | 한국어, 영어, bilingual |
| 출력 | 현재 프로젝트 안에 SVG + 2x PNG | SVG만 |

## 출력

파일을 쓰기 전에 skill이 현재 프로젝트 안의 출력 디렉터리를 먼저 제안합니다.

- `*.svg` — 나중에 편집할 수 있는 원본
- `*.png` — 문서, 슬라이드, 소셜 공유용 2x 렌더

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

이 폴더를 Claude Code skills 디렉터리에 복사합니다 — **전역**(`~/.claude/skills/`, 모든 프로젝트에서 사용) 또는 **프로젝트**(repo의 `.claude/skills/`, 팀원이 clone만으로 사용) 중 선택:

```text
<skills-dir>/svg-infographic/SKILL.md
```

전역·프로젝트 scope의 macOS, Linux, Windows용 GitHub 설치 명령은 [../../docs/INSTALL.md](../../docs/INSTALL.md)를 참고하세요.

## 예제

전체 갤러리:

**https://github.com/kyungseo/skillstead/tree/main/examples/svg-infographic**

토폴로지, 레이어/온니언 모델, Before / After 비교, 프로세스 플로우, 로드맵, self-demo를 영문·한글 예제로 제공합니다.

## 범위

이 skill은 flat하고 구조적인 시각 자료에 맞춰져 있습니다. 다음 작업에는 적합하지 않습니다:

- 사진 또는 일러스트 중심 마케팅 그래픽
- 막대, 선, 산점도, 히트맵 같은 통계 차트
- 손그림/크레용 스케치노트 스타일
- 마스코트, 캐릭터, 커스텀 일러스트

PNG export를 사용할 수 없는 환경에서는 SVG를 먼저 제공하고 한계를 명시합니다.
