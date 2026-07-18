# F20 — First-Run Raw Output (Claude Code)

모든 비교 축을 지지할 evidence가 확보되어 연구를 종료합니다(검색 1라운드, 페이지 5개 열람, 인용 5건 — 예산 내). 아래가 사용자에게 드리는 최종 응답입니다.

---

## Drafted Text

# Spring Modulith 기반 모듈러 모놀리스 vs 마이크로서비스: 신규 업무 시스템을 위한 아키텍처 결정 비교

**결론부터:** 이 선택은 "어느 쪽이 우월한가"의 문제가 아니라, **분산 시스템의 비용(microservices premium)을 지금 지불할 조직적 근거가 있는가**의 문제다. 신규 업무 시스템처럼 도메인 경계가 아직 검증되지 않은 상황이라면, Spring Modulith로 경계를 강제한 모듈러 모놀리스로 시작해 경계가 안정된 뒤 필요한 부분만 분리하는 경로가 기본값으로 합리적이다. Martin Fowler는 "거의 모든 성공적인 마이크로서비스 사례는 너무 커져서 쪼갠 모놀리스에서 시작했다"고 관찰한다([MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html)). 반대로, 다수 팀이 독립적으로 배포·운영해야 하고 성숙한 DevOps 역량이 이미 있다면 마이크로서비스의 비용이 정당화된다([Microservice Trade-Offs](https://martinfowler.com/articles/microservice-trade-offs.html)).

## 용어 경계: 도구와 스타일을 구분하라

- **모듈러 모놀리스(아키텍처 스타일):** 하나의 배포 단위 안에서 도메인 단위 모듈 간 경계를 강하게 유지하는 스타일이다. 특정 프레임워크 없이도 패키지 규율과 리뷰만으로 시도할 수 있으나, 이 경우 경계는 관례일 뿐 강제되지 않는다.
- **Spring Modulith(도구):** Spring Boot 애플리케이션 안에서 논리 모듈을 구현하도록 돕는 프로젝트로, 모듈 구조의 **정적 검증, 모듈 단위 통합 테스트, 모듈 수준 관측(observability), 문서 스니펫 생성**을 제공한다([Spring Modulith 프로젝트 페이지](https://spring.io/projects/spring-modulith), 열람 시점 기준 버전 2.1.0). 즉 Modulith는 모듈러 모놀리스 스타일을 Spring 생태계에서 *집행 가능하게* 만드는 수단이지, 스타일 그 자체가 아니다.

Modulith에서 모듈은 패키지 구조로 표현되며, 다른 모듈에 노출되는 provided interface(API 패키지, 발행 이벤트)와 접근이 금지되는 내부 구현으로 나뉜다. `ApplicationModules.of(...).verify()`가 허용되지 않은 모듈 간 접근을 테스트 시점에 실패시키므로, Fowler가 모놀리스의 고질병으로 지적한 "경계를 우회하는 편법(cancerous workarounds)"을 프로세스 분리 없이도 상당 부분 차단할 수 있다([Fundamentals](https://docs.spring.io/spring-modulith/reference/fundamentals.html), [Microservice Trade-Offs](https://martinfowler.com/articles/microservice-trade-offs.html)).

## 축별 비교

| 축 | Modulith 기반 모듈러 모놀리스 | 마이크로서비스 |
| --- | --- | --- |
| 배포 | 단일 배포 단위, 전체 릴리스 | 서비스별 독립 배포 |
| 데이터·트랜잭션 | 단일 DB·로컬 트랜잭션 가능, 이벤트로 결합 완화 | 서비스별 데이터 소유, eventual consistency |
| 팀 자율성 | 코드베이스 공유, 릴리스 조율 필요 | 팀별 독립 릴리스, 기술 스택 선택 |
| 장애·운영 | 단일 프로세스 장애 도메인, 운영 단순 | 부분 장애 격리 가능, 운영 복잡도 급증 |
| 진화 경로 | 이벤트 외부화로 점진 분리 가능 | 서비스 간 경계 재조정이 어려움 |

### 1) 배포

모듈러 모놀리스는 정의상 하나의 Spring Boot 애플리케이션, 즉 하나의 배포 단위다([Fundamentals](https://docs.spring.io/spring-modulith/reference/fundamentals.html)). 배포 파이프라인·버전 관리가 단순하지만, 한 모듈의 변경도 전체 재배포를 요구하고 scaling도 애플리케이션 전체 단위로 이루어진다(배포 단위 정의에서 따라오는 구조적 귀결). 마이크로서비스는 서비스별 독립 배포가 핵심 이점이다 — "잘못 배포해도 시스템 전체를 내려앉히지 않는다"([Microservice Trade-Offs](https://martinfowler.com/articles/microservice-trade-offs.html)).

### 2) 데이터·트랜잭션 경계

모놀리스에서는 단일 데이터베이스와 로컬 트랜잭션으로 강한 일관성을 유지할 수 있다. 다만 Modulith는 모듈 간 직접 bean 호출이 트랜잭션 경계를 불필요하게 확장하고 결합을 키운다는 이유로, 모듈 간 상호작용의 기본 수단을 **애플리케이션 이벤트**로 둘 것을 권한다. 이때 event publication registry가 이벤트 발행 기록을 **원래 비즈니스 트랜잭션의 일부로** 로그에 기록하고, 실패한 처리를 추적·재제출할 수 있게 한다([Events](https://docs.spring.io/spring-modulith/reference/events.html)) — 분산 outbox 패턴이 해결하는 문제를 프로세스 내부에서 흡수하는 셈이다. 마이크로서비스에서는 강한 일관성 유지가 극히 어려워 eventual consistency를 모두가 감당해야 하고, "비즈니스 로직이 비일관 데이터 위에서 결정을 내리면 원인 진단이 극도로 어려워질 수 있다"([Microservice Trade-Offs](https://martinfowler.com/articles/microservice-trade-offs.html)). **업무 시스템에서 트랜잭션 정합성이 핵심 요구라면 이 축이 가장 무겁게 작용한다.**

### 3) 팀 자율성

마이크로서비스는 물리적 서비스 경계가 팀 경계와 정렬될 때(Conway's Law) 팀별 독립 릴리스와 기술 스택 선택의 자유를 준다. 라이브러리 버전 충돌처럼 "코드베이스가 커질수록 기하급수적으로 어려워지는 문제"도 회피한다([Microservice Trade-Offs](https://martinfowler.com/articles/microservice-trade-offs.html)). 모듈러 모놀리스에서는 모듈 소유권을 팀별로 나눌 수 있고 Modulith의 `@ApplicationModuleTest`가 모듈 단위 검증을 지원하지만([Fundamentals](https://docs.spring.io/spring-modulith/reference/fundamentals.html)), 릴리스 일정과 기술 스택은 결국 공유된다. **팀 수가 적고 릴리스 조율 비용이 낮다면 이 제약은 실질 문제가 아니며, 다수의 독립 팀이라면 결정적 제약이 된다.**

### 4) 장애·운영 비용

마이크로서비스의 비용은 분산 그 자체에서 나온다: 원격 호출은 느리고 항상 실패 위험이 있으며, 다수의 작은 서비스 생태계를 운영해야 하므로 성숙한 DevOps 문화가 전제된다. Fowler는 "이 역량 향상과 문화 변화를 이루지 못하면 마이크로서비스 애플리케이션은 상처를 입을 것"이라고 경고한다([Microservice Trade-Offs](https://martinfowler.com/articles/microservice-trade-offs.html)). 반면 부분 장애 격리는 마이크로서비스가 잘 설계되었을 때의 이점이다. 모듈러 모놀리스는 단일 프로세스라 한 모듈의 심각한 결함이 전체에 영향을 줄 수 있지만, 운영 대상이 하나이고 원격 호출·부분 실패 시나리오가 없어 운영 비용과 장애 진단 난이도가 낮다. Modulith는 모듈 수준 관측 기능으로 단일 프로세스 안에서도 모듈별 동작 가시성을 보완한다([프로젝트 페이지](https://spring.io/projects/spring-modulith)).

### 5) 진화 경로

가장 큰 리스크는 **경계를 너무 일찍 확정하는 것**이다. "서비스 간 기능 재배치(refactoring)는 모놀리스 내부에서보다 훨씬 어렵다"([MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html)). 모듈러 모놀리스는 경계 실험 비용이 낮고, Modulith의 이벤트 중심 상호작용은 분리 시점의 재작성 비용을 줄인다. 특히 이벤트 외부화(externalization)로 모듈 이벤트를 Kafka, AMQP, JMS 등 외부 브로커에 그대로 내보낼 수 있어([Events](https://docs.spring.io/spring-modulith/reference/events.html)), 검증된 모듈을 "가장자리부터 벗겨내는(peel off at the edges)" 점진 추출 경로와 자연스럽게 이어진다([MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html)). 마이크로서비스로 시작하면 이 학습 경로가 없고, 잘못 그은 경계의 교정 비용이 크다.

## 선택 기준

**모듈러 모놀리스(+ Spring Modulith)가 유리한 조건:**

- 신규 도메인이라 모듈 경계가 아직 가설 단계다
- 업무 트랜잭션의 강한 일관성이 핵심 요구다
- 팀 수가 적거나 릴리스 조율 비용이 낮다
- 분산 시스템 운영(관측, 부분 실패 대응, 배포 자동화) 역량이 아직 조직에 없다

**마이크로서비스가 유리한 조건:**

- 다수 팀이 독립적으로 배포 주기를 가져가야 한다
- 도메인 경계가 이미 검증되어 있다(기존 시스템 경험 등)
- 서비스별로 다른 기술 스택·데이터 저장소가 실질적으로 필요하다
- 성숙한 DevOps·플랫폼 역량이 이미 갖춰져 있고, eventual consistency를 업무적으로 수용할 수 있다

**결정 프레임 제안:** 위 마이크로서비스 조건 중 충족되지 않는 항목이 하나라도 있다면, 그 항목이 바로 지불하게 될 비용이다. 조건이 대부분 미충족인 신규 업무 시스템이라면 Modulith 기반 모듈러 모놀리스로 시작하되, `verify()` 기반 경계 강제와 이벤트 중심 모듈 상호작용을 처음부터 적용해 두는 것이 이후 분리 옵션을 살리는 최소 비용의 선택이다. 이는 되돌리기 비용(reversal cost) 관점에서도 비대칭적이다: 모놀리스 → 서비스 추출은 검증된 경로가 있지만, 잘못 분리된 서비스의 재통합·경계 재조정은 훨씬 비싸다([MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html)).

---

## Source Notes

- Spring Modulith의 정체성(단일 Spring Boot 앱 내 논리 모듈, 검증·테스트·관측·문서화), 모듈 구성(provided interface/내부 구현), `verify()` 강제: 공식 레퍼런스 Fundamentals 및 프로젝트 페이지.
- 이벤트 권장 근거, event publication registry의 "원래 비즈니스 트랜잭션 내 발행 로그 기록"과 재제출, Kafka/AMQP/JMS 외부화: 공식 레퍼런스 Events.
- 마이크로서비스 편익(경계 강제, 독립 배포, 기술 다양성)과 비용(분산, eventual consistency, 운영 복잡도·DevOps 문화 전제), microservices premium: Fowler, Microservice Trade-Offs.
- 모놀리스 우선 논거, 경계 조기 확정 리스크, 점진 추출 경로: Fowler, MonolithFirst.
- registry의 보장은 "발행 기록의 트랜잭션 내 저장 + 실패 추적·재처리"로 한정해 기술했다. 비동기 listener 처리까지 원자적으로 묶인다는 주장은 문서가 지지하지 않으므로 쓰지 않았다.

## Assumptions And Omissions

- 팀 규모별 수치 기준(예: "n명 이하는 모놀리스")은 열람한 primary source에 없어 의도적으로 제외했다. 검색 결과에 있던 수치는 미열람 2차 자료라 인용하지 않았다.
- 서비스별 독립 scaling은 배포 단위 정의에서 따라오는 구조적 귀결로만 기술했으며, 별도 출처 인용 없이 본문에 그 성격을 표시했다.
- Spring Modulith의 Spring Boot 버전 호환 범위는 프로젝트 페이지에 명시가 없어 다루지 않았다. 도입 확정 전 공식 문서에서 확인이 필요하다.
- MonolithFirst에는 반대 입장(처음부터 마이크로서비스가 나았다는 사례) 언급이 존재하는 것으로 알려져 있으나, 이번 조사 범위에서 해당 반론 원문을 별도로 열람하지 않았으므로 본문 결론은 "기본값" 권고로 한정했다.

## Sources

Evidence cutoff: 2026-07-18 (모든 출처를 이 날짜에 직접 열람).

1. [Spring Modulith — Fundamentals (공식 레퍼런스)](https://docs.spring.io/spring-modulith/reference/fundamentals.html)
2. [Spring Modulith — Working with Application Events (공식 레퍼런스)](https://docs.spring.io/spring-modulith/reference/events.html)
3. [Spring Modulith 프로젝트 페이지 (spring.io)](https://spring.io/projects/spring-modulith)
4. [Martin Fowler — Microservice Trade-Offs](https://martinfowler.com/articles/microservice-trade-offs.html)
5. [Martin Fowler — MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html)
