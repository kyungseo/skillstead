## Drafted Text

### 결론

새 비즈니스 시스템이라면 기본값은 **Spring Modulith로 경계를 검증하는 모듈러 모놀리스**가 합리적이다. 도메인 경계가 아직 학습 중이고, 여러 팀이 독립 배포해야 할 명확한 이유가 없다면 마이크로서비스의 분산 시스템 비용을 먼저 부담할 필요가 없기 때문이다.

반대로 다음 요구가 이미 구체적이라면 마이크로서비스를 검토할 근거가 충분하다.

- 여러 팀이 서로 기다리지 않고 배포해야 한다.
- 업무 영역별 트래픽, 가용성 목표 또는 보안·규제 조건이 크게 다르다.
- 서비스별 데이터 소유권과 장애 격리가 조직 운영 모델에 포함돼 있다.
- 배포 자동화, 관측성, 장애 대응, 메시징을 플랫폼 역량으로 제공할 수 있다.

핵심은 “어느 구조가 더 현대적인가”가 아니라 **독립 배포가 주는 편익이 분산 시스템 비용보다 큰가**이다.

### 먼저 구분할 것: 도구와 아키텍처

이 비교에서 **모듈러 모놀리스**는 도메인 기능을 명시적인 모듈로 나누되, 전체를 하나의 애플리케이션 배포 단위로 운영하는 아키텍처 스타일을 뜻한다.

**Spring Modulith**는 그 스타일 자체가 아니라, Spring Boot 애플리케이션에서 논리적 모듈을 표현하고 검증·문서화·테스트하며 이벤트로 느슨하게 연결하도록 돕는 라이브러리 집합이다. 공식 문서도 이를 “domain-driven, modular applications”를 위한 의견이 반영된 툴킷으로 정의한다. 따라서 의존성을 추가했다고 시스템이 저절로 모듈화되는 것도, 나중에 마이크로서비스로 자동 전환되는 것도 아니다. [Spring Modulith 공식 문서](https://docs.spring.io/spring-modulith/reference/)

### 비교

| 판단 축 | Spring Modulith 지원 모듈러 모놀리스 | 마이크로서비스 |
|---|---|---|
| 배포 | 애플리케이션 전체가 하나의 배포 단위다. 배포·롤백·로컬 실행은 단순하지만, 작은 모듈 변경도 전체 애플리케이션을 다시 배포한다. 확장도 일반적으로 전체 단위로 수행한다. | 서비스별 독립 배포와 확장이 가능하다. 대신 서비스 오케스트레이션, API 게이트웨이, 서비스 간 통신, 중앙 관측성 같은 운영 기반이 필요하다. Microsoft의 아키텍처 지침도 독립 배포를 장점으로 들면서 전체 시스템의 이동 부품과 운영 복잡성이 증가한다고 명시한다. [Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/microservices) |
| 데이터 경계 | 물리적으로 하나의 데이터베이스를 사용할 수 있지만, 테이블과 저장소의 소유권은 모듈별로 분리하는 편이 좋다. 같은 프로세스와 데이터베이스 안에서는 단일 ACID 트랜잭션으로 여러 모듈을 묶을 수 있다. 이는 강한 일관성이 필요한 업무에는 유리하지만 모듈 결합을 숨길 수도 있다. | 원칙적으로 서비스가 자신의 데이터와 스키마를 소유하며 다른 서비스가 직접 접근하지 않는다. 독립성은 높아지지만 서비스 간 데이터 복제, 중복, 조회 조합과 일관성 관리가 새로운 설계 문제가 된다. [Azure의 마이크로서비스 데이터 지침](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/data-considerations) |
| 트랜잭션 | 동기식 모듈 호출이나 이벤트 처리를 하나의 로컬 트랜잭션으로 묶기 쉽다. 다만 Spring Modulith 문서가 설명하듯 동기 이벤트의 처리 범위가 커지면 부차적인 기능의 실패가 전체 트랜잭션을 실패시킬 수 있다. 비동기 리스너와 이벤트 발행 레지스트리를 사용하면 경계를 분리하고 실패한 발행을 재시도할 수 있다. [Spring Modulith 이벤트 문서](https://docs.spring.io/spring-modulith/reference/events.html) | 여러 서비스와 데이터 저장소를 하나의 ACID 트랜잭션으로 처리하기 어렵다. 업무 흐름별로 필요한 일관성 수준을 정하고, 이벤트·내구성 큐·보상 트랜잭션 같은 패턴으로 부분 실패와 최종 일관성을 다뤄야 한다. [Azure의 마이크로서비스 데이터 지침](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/data-considerations) |
| 팀 자율성 | 모듈별 코드 소유권과 API 경계를 둘 수 있지만, 빌드·런타임·릴리스 일정은 공유한다. 소수 팀이 빠르게 협업하기에는 유리하나, 팀 수가 늘면 저장소와 배포 파이프라인이 조정 지점이 될 수 있다. | 서비스별 코드베이스, 데이터, 기술 선택과 배포 주기를 가질 수 있다. 진정한 자율성을 얻으려면 서비스 경계와 팀 책임이 일치해야 하며, API·이벤트 스키마·로깅 같은 전사 표준도 함께 운영해야 한다. |
| 장애와 복구 | 네트워크 호출이 적어 부분 실패, 타임아웃, 재시도와 분산 추적 문제가 줄어든다. 반면 프로세스 장애나 잘못된 전체 배포의 영향 범위는 애플리케이션 전체가 될 수 있다. | 서비스 장애를 격리할 수 있지만, 그 효과는 호출자가 타임아웃·서킷 브레이커·비동기 처리 등으로 장애를 감당하도록 설계했을 때만 얻는다. 그렇지 않으면 네트워크 장애가 연쇄 장애로 번질 수 있다. [Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/microservices) |
| 운영 비용 | 하나의 런타임, 배포 파이프라인과 기본 관측 체계로 시작할 수 있다. 작은 플랫폼 팀이나 초기 제품에 적합하다. | 서비스 수만큼 배포, 설정, 인증서, 비밀, 로그, 메트릭, 추적, 용량과 온콜 대상을 관리해야 한다. 서비스 하나는 단순해져도 시스템 전체는 더 복잡해진다. |
| 진화 경로 | 모듈 API와 데이터 소유권을 엄격히 관리하고, 모듈 간 통신을 이벤트로 분리하면 향후 특정 모듈을 서비스로 추출할 수 있는 기반이 된다. Spring Modulith는 선택한 이벤트를 Kafka·AMQP·JMS 등 외부 브로커로 발행하는 기능도 제공한다. 다만 이는 추출 가능성을 높이는 수단이지 추출을 보장하지는 않는다. [Spring Modulith 이벤트 문서](https://docs.spring.io/spring-modulith/reference/events.html) | 처음부터 독립 경계를 강제할 수 있지만, 초기 도메인 경계가 틀리면 네트워크 API와 분리된 데이터까지 함께 재편해야 한다. Fowler는 서비스 경계가 안정되기 전에 마이크로서비스로 시작하는 비용과, 잘 모듈화된 모놀리스도 자동으로 분해 가능한 것은 아니라는 점을 함께 경고한다. [Martin Fowler, *Monolith First*](https://martinfowler.com/bliki/MonolithFirst.html) |

### 선택 기준

다음 조건이 우세하면 **모듈러 모놀리스**를 선택한다.

- 하나 또는 소수의 긴밀한 팀이 시스템을 개발한다.
- 도메인과 bounded context 경계가 아직 바뀔 가능성이 크다.
- 여러 업무 단계에 걸친 강한 일관성이 중요하다.
- 모듈별 부하와 가용성 요구가 대체로 비슷하다.
- 빠른 피드백과 낮은 운영 복잡성이 독립 배포보다 중요하다.
- 조직에 분산 추적, 메시징, 서비스별 배포·온콜을 표준화한 플랫폼이 아직 없다.

다음 조건이 실제 요구사항으로 확인됐다면 **마이크로서비스** 쪽으로 기운다.

- 여러 팀의 릴리스 충돌이 이미 반복되고 있으며 독립 배포가 이를 실질적으로 줄인다.
- 특정 업무 영역만 독립적으로 확장하거나 별도의 가용성 목표를 적용해야 한다.
- 서비스별 데이터 소유권과 최종 일관성을 업무적으로 수용할 수 있다.
- 장애 격리의 이익이 서비스 간 통신 실패와 복구 설계 비용보다 크다.
- API·이벤트 호환성, 관측성, 자동 배포와 운영 책임을 맡을 조직 구조가 준비돼 있다.
- 도메인 경계가 충분히 안정됐고 팀 경계와도 대응한다.

### 권장 진화 전략

초기 선택을 영구 결정으로 만들 필요는 없다.

1. 도메인 기능을 Spring Modulith 애플리케이션 모듈로 구분한다.
2. 공개 API, 내부 구현과 데이터 소유권을 명시한다.
3. 모듈 간 불법 의존성을 빌드에서 검증한다.
4. 강한 일관성이 필요한 흐름과 비동기화할 수 있는 흐름을 구분한다.
5. 독립 배포 필요성이 생긴 모듈만 추출한다.

추출 판단은 “서비스로 만들 수 있다”가 아니라 다음과 같은 관측 가능한 신호를 기준으로 한다.

- 한 모듈의 배포 빈도나 장애 허용 수준이 나머지와 지속적으로 다르다.
- 특정 모듈의 부하 때문에 전체 애플리케이션을 반복해서 과잉 확장한다.
- 팀 간 릴리스 조정이 실제 리드타임 병목으로 측정된다.
- 데이터와 트랜잭션 경계를 서비스 단위로 분리해도 업무 정합성을 유지할 수 있다.

이 신호가 없다면 모듈러 모놀리스는 “임시 구조”가 아니라 충분히 유효한 최종 아키텍처다. 신호가 분명하다면 잘 관리된 모듈 경계가 점진적 서비스 추출의 출발점이 된다.

## Source Notes

- 근거 확인일: **2026-07-18**
- Spring Modulith 관련 주장은 공식 2.1 계열 참조 문서에서 확인했다.
- 마이크로서비스의 독립 배포, 데이터 소유권, 장애 격리와 운영 복잡성은 Microsoft의 공식 아키텍처 지침을 근거로 삼았다.
- 모놀리스 우선 전략은 보편 법칙이 아니라 Martin Fowler가 경험을 토대로 제시한 아키텍처 견해로 취급했다.
- “기본값은 모듈러 모놀리스”라는 결론은 새 시스템에서 경계가 아직 불확실하다는 조건을 둔 종합 판단이다.

## Sources

1. [Spring Modulith Reference — Overview](https://docs.spring.io/spring-modulith/reference/)
2. [Spring Modulith Reference — Working with Application Events](https://docs.spring.io/spring-modulith/reference/events.html)
3. [Azure Architecture Center — Microservices architecture style](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/microservices)
4. [Azure Architecture Center — Data considerations for microservices](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/data-considerations)
5. [Martin Fowler — Monolith First](https://martinfowler.com/bliki/MonolithFirst.html)

---

**Research budget ledger**

- 검색 라운드: 1/2
- 본문 확인에 성공한 실질 페이지: 6/6
- gap-filling 단계: 1/1 — 이미 연 페이지 안에서 독립 배포·이벤트 외부화 근거 위치 확인
- 실패·접근 거부·redirect-only 시도: 0
- 인용한 출처: 5/5
