# F19 — Post-R2 Amendment First Run (Claude Code)

- Fixture: F19 — Research-Backed Current Enterprise AX Trend Brief
- Runtime: Claude Code (Agent tool fresh subagent, live web research enabled)
- Observed model: `claude-fable-5`
- Reasoning effort: unobserved (session-inherited)
- Isolation: independent fresh subagent; installed skill folder read-only(local); examples/answer key forbidden; complete scenario metadata + research budget inline
- Research budget compliance (self-reported): 검색 2라운드(상한 2), 열람 성공 3페이지(상한 6), 인용 3건(상한 5). 접근 실패: McKinsey 원문 timeout, korea.net redirect 오류, KoreaTechDesk·Stimson 403 — environment-side access failure로 기록, substantive open으로 세지 않음
- Environment/delivery retry: 0 (평가 절차 오류 아님 — 외부 사이트 접근 실패는 output 내에서 stop-condition 처리됨)
- Material corrective rerun: 0

## First-Run Raw Output

조사를 마쳤습니다. 검증 예산 내에서 검색 2라운드를 사용했고, 접근 실패(McKinsey 원문 timeout, korea.net redirect 오류, KoreaTechDesk·Stimson 403)를 제외하면 실제 열람에 성공한 출처는 3건입니다. 열람하지 못한 출처의 수치는 규칙에 따라 본문 주장에 사용하지 않고 `Needs Human`으로 분리했으며, 그만큼 브리프는 **잠정(provisional)** 으로 표시합니다.

---

## Drafted Text

# 엔터프라이즈 AX 도입 동향 브리프 (잠정판)

**대상**: 전사 AI transformation(AX)을 계획하는 기술 리더
**증거 컷오프**: 2026-07-18 (열람 출처 중 최신 발행일 2026-07-17)

## 핵심 결론

AI 도입률 자체는 이미 보편화 단계에 도달했고, 경쟁의 축은 "어떤 모델을 확보하느냐"에서 "조직과 워크플로를 어떻게 재설계하느냐"로 이동하고 있다. 다만 이 전환의 성과 격차를 뒷받침하는 정량 근거는 아직 벤더와 연사의 주장 수준에 머무는 경우가 많아, 도입 결정 시 주장의 성격을 구분해 읽어야 한다.

## 1. 측정된 도입 (measured adoption)

- Stanford HAI [AI Index 2026](https://hai.stanford.edu/ai-index/2026-ai-index-report)에 따르면 조직의 AI 도입률은 2025년 기준 88%에 도달했다. 같은 보고서는 2025년 미국 민간 AI 투자를 $285.9B, 신규 투자 유치 AI 기업을 1,953개로 집계한다.
- 해석 경계: 이런 도입률 지표는 통상 "하나 이상의 기능에서 AI 사용"이라는 넓은 정의를 쓴다. 도입률이 높다는 것과 전사 확산·손익 기여가 이뤄졌다는 것은 별개의 지표이며, 이번 조사 범위에서 확산 단계별 측정치는 원문 검증에 실패해 본문에 싣지 않았다(아래 Needs Human 참조).

## 2. 발표된 계획과 예측 (announced intent)

- SK hynix는 SK AX와 digital twin 기반 "Autonomous FAB" 모델 개발 협력을, 신한금융그룹은 "1인 1금융 에이전트(One Employee, One Financial Agent)" 모델 개발을 각각 발표했다 (2026-06-16, IMAGINE AX 2026 — [The Elec 보도](https://www.thelec.net/news/articleView.html?idxno=11370)). 두 건 모두 벤더 행사에서 발표된 계획이며, 성과 수치는 공개되지 않았다.
- Wrtn AX CEO 박민준은 FKI 2026 CEO Summer Forum(2026-07-17)에서 invoice 처리·이메일·기업 소프트웨어 조작을 수행하는 computer-use agent가 1년 안에 주류화될 것으로 전망했다 ([The Korea Times](https://www.koreatimes.co.kr/business/companies/20260717/ai-race-shifts-from-building-models-to-rebuilding-companies)). 이는 측정치가 아니라 이해관계가 있는 사업자의 예측이다.

## 3. 벤더 프레이밍 (vendor framing)

- SK AX는 "Agentic Enterprise" 비전을 내세우며 "경쟁력은 더 나은 AI 도입이 아니라 AI를 통한 전사 최적화에서 나오며, 성과 격차가 이미 실적에 나타나고 있다"고 주장한다. 그러나 보도 기준으로 독립 검증된 효율 지표나 정량 결과는 공개된 것이 없다. 이 내러티브는 시장의 판매 방향을 보여주는 신호로 읽어야 하며, 검증된 ROI 증거로 취급해서는 안 된다.

## 4. 제한된 종합 (bounded synthesis)

열람한 출처들이 일관되게 가리키는 방향은 다음과 같다. 이는 3개 출처에 근거한 필자의 종합이며, 시장 전체를 대표하는 결론은 아니다.

- **도입은 넓고, 확산은 얕다.** 도입률 88%는 벤치마크로서 변별력을 잃어가고 있다. 내부 KPI는 도입 여부가 아니라 전사 확산 단계와 손익 기여로 잡는 것이 타당하다.
- **논의의 중심이 이동했다.** 글로벌·국내 담론 모두 모델 성능 경쟁에서 워크플로 재설계, agent 운영화, 인간의 의사결정·검증 구조 설계로 옮겨가고 있다. FKI 포럼에서도 "AI가 실행을 맡을수록 인간의 판단·검증·책임 구조가 병목이 된다"는 논지가 반복됐다.
- **agent 도입 시점 판단에는 주의가 필요하다.** "1년 내 주류화" 같은 전망은 벤더 측 예측이므로, 자사 파일럿의 측정 가능한 성과를 기준으로 도입 속도를 결정하는 편이 안전하다.

---

## Source Notes

| 주장 | 출처 | 발행/확인일 | 상태 |
| --- | --- | --- | --- |
| 조직 AI 도입률 88% (2025), 미국 민간 투자 $285.9B | Stanford HAI AI Index 2026 (페이지 열람) | 2026 확인 | source claim — 기저 서베이 방법론은 원문 PDF 미확인 |
| SK hynix Autonomous FAB, 신한 1인 1에이전트 발표 | The Elec (열람) | 2026-06-16 행사 | announced intent |
| "Agentic Enterprise" 성과 격차 주장 | The Elec (열람) | 2026-06-16 | vendor claim — 독립 검증 없음 |
| computer-use agent 1년 내 주류화 전망 | The Korea Times (열람) | 2026-07-17 | 연사 예측 — 통계 인용 없음 |

## Needs Human

- **McKinsey State of AI 세부 지표 미검증**: 검색 결과에는 "AI agent 실험 조직 62%, 전사 scaling 완료 7%, 2025-06~07 조사(n=1,993, 105개국)" 등 확산 단계 수치가 반복 등장하나, mckinsey.com 원문이 반복 timeout으로 열리지 않아 본문에서 제외했다. 확산 단계 수치를 브리프에 넣으려면 원문(보고서 PDF) 확인이 필요하다.
- **한국 정부 AX 정책 수치 미검증**: 2026년 AX 예산 대폭 증액, M.AX(2030년까지 AI factory 500개) 발표가 검색 결과에 나타나나 korea.net 보도자료와 관련 기사 접근이 모두 실패했다. 국내 정책 동향 섹션을 추가하려면 정부 보도자료 원문 확인이 필요하다.
- **한국 기업의 측정된 국내 도입률 부재**: 열람에 성공한 출처 중 한국 기업 대상의 측정된 도입 통계는 없었다. 국내 의사결정용으로는 과기정통부·KISDI 등 국내 실태조사 확인을 권한다.

## Assumptions And Omissions

- 검증 예산(검색 2라운드, 열람 성공 3페이지) 안에서 작성한 잠정 브리프이며, 시장 전수 조사가 아니다. 특히 측정된 확산 단계 지표와 한국 정책 항목이 접근 실패로 빠져 있어, 해당 공백이 채워지면 결론의 정밀도가 달라질 수 있다.
- "도입률 88%"의 기저 서베이 정의(응답자 자기보고, 기능 1개 이상 사용)는 일반적 관행에 근거한 가정이다(신뢰도: 중간).

## Sources

1. [Stanford HAI — 2026 AI Index Report](https://hai.stanford.edu/ai-index/2026-ai-index-report)
2. [The Korea Times — 'AI race shifts from building models to rebuilding companies' (2026-07-17)](https://www.koreatimes.co.kr/business/companies/20260717/ai-race-shifts-from-building-models-to-rebuilding-companies)
3. [The Elec — SK AX Unveils Vision for 'Agentic Enterprise' Driven by AI](https://www.thelec.net/news/articleView.html?idxno=11370)
