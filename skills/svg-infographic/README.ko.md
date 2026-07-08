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

이 폴더를 Claude Code skills 디렉터리에 복사합니다:

```text
<claude-skills-dir>/svg-infographic/SKILL.md
```

macOS, Linux, Windows용 GitHub 설치 명령은 [../../docs/INSTALL.md](../../docs/INSTALL.md)를 참고하세요.

## 예제

전체 갤러리:

**https://github.com/kyungseo/agent-skills/tree/main/examples/svg-infographic**

토폴로지, 레이어/온니언 모델, Before / After 비교, 프로세스 플로우, 로드맵, self-demo를 영문·한글 예제로 제공합니다.

## 범위

이 skill은 flat하고 구조적인 시각 자료에 맞춰져 있습니다. 다음 작업에는 적합하지 않습니다:

- 사진 또는 일러스트 중심 마케팅 그래픽
- 막대, 선, 산점도, 히트맵 같은 통계 차트
- 손그림/크레용 스케치노트 스타일
- 마스코트, 캐릭터, 커스텀 일러스트

PNG export를 사용할 수 없는 환경에서는 SVG를 먼저 제공하고 한계를 명시합니다.
