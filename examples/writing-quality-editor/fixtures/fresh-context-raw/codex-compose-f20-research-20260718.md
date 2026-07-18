## Drafted Text

# Spring Modulith 기반 모듈러 모놀리스와 마이크로서비스: 무엇을 먼저 선택할 것인가

근거 기준일: 2026년 7월 18일

### 결론

새 비즈니스 시스템에서 **독립 배포가 당장 필요한 명확한 이유가 없다면**, Spring Modulith로 경계를 검증하는 모듈러 모놀리스를 기본 출발점으로 삼는 편이 합리적이다. 반대로 도메인별 독립 배포, 팀별 운영 책임, 부분 확장·격리가 이미 사업 요구로 확인되었고 이를 감당할 플랫폼 역량도 있다면 마이크로서비스가 맞다.

이는 모듈러 모놀리스가 항상 우월하다는 뜻이 아니다. 핵심 질문은 “어느 구조가 더 현대적인가?”가 아니라 다음 두 가지다.

1. 지금 물리적으로 분리해야 얻을 수 있는 가치가 있는가?
2. 그 가치를 위해 분산 시스템의 비용을 지금부터 지불할 준비가 되어 있는가?

### 먼저 구분해야 할 세 가지

**Spring Modulith는 아키텍처 스타일이 아니라 도구 모음이다.** 공식 문서는 이를 도메인 중심의 모듈형 Spring Boot 애플리케이션을 만드는 “opinionated toolkit”으로 정의한다. 패키지 기반 애플리케이션 모듈 모델, 의존성 검증, 모듈 단위 통합 테스트, 이벤트 기반 상호작용, 문서화와 관측 기능을 제공한다. 현재 확인한 안정 문서는 Spring Modulith 2.1.0 기준이다. [Spring Modulith 개요](https://docs.spring.io/spring-modulith/reference/index.html), [Fundamentals](https://docs.spring.io/spring-modulith/reference/fundamentals.html)

**모듈러 모놀리스는 아키텍처 스타일이다.** 하나의 배포 단위 안에서 업무 능력별 모듈을 나누고, 공개 API와 내부 구현을 구분하며, 모듈 간 의존성을 통제한다. 일반적인 모놀리스는 여러 내부 프로젝트나 컴포넌트로 구성되어도 하나의 단위로 배포된다. [Microsoft의 모놀리식 애플리케이션 설명](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures)

**마이크로서비스는 물리적 경계를 포함하는 아키텍처 스타일이다.** 서비스가 별도 프로세스와 수명주기를 가지며, 잘 정의된 원격 계약으로 통신하고 독립적으로 배포되는 것이 핵심이다. 서비스 크기보다 독립 배포와 데이터·운영 책임의 분리가 더 본질적이다. [Lewis·Fowler의 원문](https://martinfowler.com/articles/microservices.html), [Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/microservices)

따라서 Spring Modulith를 도입했다고 해서 자동으로 독립 배포, 데이터 격리, 장애 격리 또는 팀 자율성이 생기는 것은 아니다. 반대로 Spring Modulith 없이도 모듈러 모놀리스를 설계할 수 있다. Spring Modulith의 가치는 그 경계를 코드와 테스트로 더 명시적으로 만들고 검증하는 데 있다.

### 핵심 비교

| 판단 축 | Spring Modulith 기반 모듈러 모놀리스 | 마이크로서비스 |
| --- | --- | --- |
| 배포 | 하나의 애플리케이션을 함께 빌드·배포한다. 배포 절차는 단순하지만 작은 변경도 전체 릴리스에 포함된다. | 서비스를 독립적으로 빌드·배포·롤백할 수 있다. 대신 서비스별 파이프라인과 계약 호환성이 필요하다. |
| 확장 | 애플리케이션 전체를 수평 확장한다. 부하가 고르게 분포하거나 규모가 중간 수준이면 단순하고 충분할 수 있다. | 병목 서비스만 독립 확장할 수 있다. 실제로 부하 특성이 다른 기능이 있을 때 가치가 커진다. |
| 데이터 경계 | 모듈별 데이터 소유권을 논리적으로 설계할 수 있지만, 같은 프로세스와 트랜잭션 자원을 사용하면 모듈을 가로지르는 로컬 ACID 트랜잭션도 가능하다. 편리한 만큼 결합 위험이 있다. | 각 서비스가 자신의 데이터와 스키마를 소유하는 것이 원칙이다. 서비스 간 쓰기는 단일 로컬 ACID 트랜잭션으로 처리하기 어렵고, 이벤트·Saga·보상 트랜잭션 같은 분산 일관성 설계가 필요하다. |
| 팀 자율성 | 팀별 모듈 소유권은 둘 수 있지만, 빌드와 배포 일정은 공유한다. 자율성은 주로 코드 변경 범위와 리뷰 권한에서 나온다. | 팀이 서비스의 코드·데이터·배포·운영을 끝까지 소유할 수 있다. 단, 공유 릴리스나 공유 스키마가 남으면 기대한 자율성이 사라진다. |
| 장애 | 프로세스나 공통 자원에 문제가 생기면 전체 애플리케이션이 영향을 받을 수 있다. 대신 네트워크를 건너지 않는 내부 호출은 실패 형태가 단순하다. | 서비스별 장애 격리가 가능하지만 자동으로 보장되지는 않는다. 타임아웃, 재시도, 서킷 브레이커, 멱등성, 백프레셔가 없으면 부분 장애가 연쇄 장애로 번질 수 있다. |
| 운영 비용 | 배포 대상, 로그 흐름, 구성과 런타임 토폴로지가 적어 운영 기준선을 만들기 쉽다. | 서비스 검색, 오케스트레이션, 중앙 로그, 분산 추적, 계약 버전 관리, 비밀·인증서 관리 등 더 많은 운영 표면이 생긴다. |
| 변경 비용 | 모듈 경계가 틀렸을 때 같은 코드베이스 안에서 책임을 옮기기 비교적 쉽다. | 경계를 옮기려면 API, 데이터, 배포, 모니터링과 소유권까지 함께 바꿔야 하므로 초기 경계 오류가 더 비싸다. |
| 진화 | 경계가 잘 관리되면 일부 모듈을 나중에 서비스로 추출할 수 있다. 그러나 추출 가능성은 자동 보장되지 않는다. | 이미 독립 수명주기를 가지므로 서비스별 진화가 가능하다. 그 대신 서비스 간 계약의 하위 호환성을 계속 관리해야 한다. |

마이크로서비스에서 서비스별 데이터 소유권은 독립 배포를 지키는 핵심 제약이다. Azure의 공식 지침도 두 서비스가 같은 스키마나 테이블을 직접 읽고 쓰지 않아야 한다고 설명하며, 서비스 간 데이터 관계에는 최종 일관성 문제가 따른다고 명시한다. [Data considerations for microservices](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/data-considerations)

여러 서비스에 걸친 업무 트랜잭션은 Saga처럼 각 서비스의 로컬 트랜잭션과 보상 동작으로 재설계할 수 있다. 다만 자동 롤백과 격리 수준을 잃기 때문에 이는 단순한 라이브러리 교체가 아니라 업무 상태 모델의 변화다. [Chris Richardson의 Saga 패턴](https://microservices.io/patterns/data/saga.html)

Spring Modulith는 모듈 간 순환 의존, 다른 모듈 내부 타입 접근, 허용되지 않은 모듈 의존을 빌드에서 검출할 수 있고, `@ApplicationModuleTest`로 특정 모듈만 부트스트랩해 통합 테스트할 수 있다. [구조 검증](https://docs.spring.io/spring-modulith/reference/verification.html), [모듈 통합 테스트](https://docs.spring.io/spring-modulith/reference/testing.html) 다만 이 검증은 물리적 서비스 경계가 아니다. 예를 들어 모듈이 다른 모듈 소유 테이블에 SQL로 직접 접근하는 문제까지 저절로 차단해 주는 것은 아니므로 데이터 소유권 규칙은 별도로 설계하고 검증해야 한다.

### 언제 모듈러 모놀리스를 선택할 것인가

다음 조건이 많을수록 Spring Modulith 기반 모듈러 모놀리스가 유리하다.

- 새 도메인이라 경계가 아직 학습 중이다.
- 여러 업무 기능이 하나의 강한 일관성 트랜잭션으로 자주 묶인다.
- 대부분의 기능이 비슷한 주기로 배포되고 비슷한 방식으로 확장된다.
- 팀 수가 적거나 하나의 제품 릴리스 흐름을 공유한다.
- 분산 추적, 서비스별 배포, 온콜, 계약 테스트를 운영할 플랫폼 역량이 아직 제한적이다.
- 초기 목표가 독립 확장보다 빠른 피드백과 낮은 운영 복잡도다.

이 경우에도 단순한 “큰 Spring Boot 애플리케이션”으로 끝내서는 안 된다. 업무 능력별 모듈, 공개 API, 내부 구현, 허용 의존성, 모듈별 데이터 소유권을 명시하고 Spring Modulith 검증을 CI에 포함해야 한다.

### 언제 마이크로서비스를 선택할 것인가

다음 요구가 이미 구체적이고 지속적이라면 마이크로서비스가 비용을 정당화할 가능성이 높다.

- 특정 업무 기능을 다른 기능과 독립적으로 자주 배포해야 한다.
- 여러 장기 운영 팀이 각자의 서비스와 운영 결과를 끝까지 책임져야 한다.
- 기능별 부하, 가용성 목표, 보안 경계 또는 기술 스택이 실제로 다르다.
- 서비스별 데이터 소유권이 명확하고 서비스 간 최종 일관성을 업무적으로 수용할 수 있다.
- 자동 프로비저닝, 짧은 배포 파이프라인, 중앙 관측, 빠른 롤백과 장애 대응 체계가 준비되어 있다.
- 네트워크 실패와 계약 버전 관리까지 포함한 분산 시스템 경험이 팀에 있다.

Lewis와 Fowler는 마이크로서비스의 핵심 특성으로 독립 배포, 업무 능력 중심 조직, 자동 배포와 분산된 데이터 관리를 들었다. Fowler는 별도의 선행 조건으로 빠른 프로비저닝·배포, 기본 모니터링, 개발과 운영의 긴밀한 협업을 제시한다. [Microservices](https://martinfowler.com/articles/microservices.html), [Microservice Prerequisites](https://martinfowler.com/bliki/MicroservicePrerequisites.html)

### 현실적인 진화 경로

신규 시스템에서 경계가 불확실하다면 다음 순서가 저위험 기본안이다.

1. 업무 능력별 모듈을 가진 하나의 Spring Boot 애플리케이션으로 시작한다.
2. Spring Modulith로 공개 인터페이스, 허용 의존성, 순환 의존과 모듈 단위 테스트를 검증한다.
3. 모듈마다 데이터 소유권을 정하고 다른 모듈의 테이블을 직접 읽거나 쓰지 않는 규칙을 둔다. 같은 데이터베이스 서버를 쓰더라도 소유 스키마와 접근 경로는 구분한다.
4. 독립 배포 필요, 현저히 다른 확장 패턴, 별도 가용성 목표, 조직 소유권 충돌이 반복해서 관측되는 모듈만 추출 후보로 삼는다.
5. 추출할 때는 코드를 떼는 것보다 데이터 소유권과 계약을 먼저 분명히 한다. 처음부터 지나치게 작은 서비스로 나누기보다 결합이 낮은 굵은 업무 능력부터 분리한다.

Spring Modulith는 선택된 애플리케이션 이벤트를 Kafka, AMQP, JMS 등 외부 브로커로 발행하고 이벤트 발행 기록을 관리하는 기능을 제공한다. 이는 향후 외부 소비자나 서비스 추출에 활용할 수 있는 연결점이지만, 서비스 분리 자체나 데이터 이전을 자동화하지는 않는다. 공식 문서 역시 기본 비동기 외부화 방식과 실제 outbox 구현의 기능 차이를 명시한다. [Spring Modulith 이벤트와 외부화](https://docs.spring.io/spring-modulith/reference/events.html)

모놀리스에서 마이크로서비스로 가는 길도 자동으로 안전하지는 않다. Fowler는 모듈성과 데이터 경계가 좋지 않은 모놀리스를 나중에 쉽게 분해할 수 있다고 가정해서는 안 된다고 경고한다. 반면 경계가 불확실한 신규 시스템에서 먼저 모놀리스로 학습하고, 준비된 능력부터 점진적으로 추출하는 전략에는 실용적 근거가 있다. [Monolith First](https://martinfowler.com/bliki/MonolithFirst.html), [How to break a Monolith into Microservices](https://martinfowler.com/articles/break-monolith-into-microservices.html)

### 최종 선택 규칙

- **독립 배포가 희망사항이면:** 모듈러 모놀리스로 시작한다.
- **독립 배포가 측정 가능한 사업 요구이면:** 마이크로서비스를 검토한다.
- **강한 일관성 업무가 중심이면:** 우선 모듈러 모놀리스에 무게를 둔다.
- **팀·데이터·운영 책임을 실제로 분리해야 하면:** 마이크로서비스에 무게를 둔다.
- **도메인 경계가 불확실하면:** 같은 프로세스 안에서 경계를 학습한다.
- **경계가 안정적이고 플랫폼 역량이 준비되어 있으면:** 필요한 영역만 물리적으로 분리한다.

가장 피해야 할 선택은 두 극단이다. 경계 없는 모놀리스는 시간이 갈수록 변경 비용을 키우고, 공유 데이터와 공동 배포를 유지한 마이크로서비스는 독립성 없이 분산 시스템 비용만 남기는 “분산 모놀리스”가 된다.

## Source Notes

- **관측 사실:** 2026년 7월 18일 확인한 Spring Modulith 공식 안정 문서는 2.1.0이며, 프로젝트는 자신을 Spring Boot용 도메인 중심 모듈화 도구 모음으로 정의한다.
- **공식 기능 근거:** Spring Modulith 문서에서 모듈 모델, 구조 검증, 모듈 단위 통합 테스트, 런타임 관측, 이벤트 발행 기록과 외부화를 확인했다.
- **마이크로서비스 특성 근거:** 독립 배포, 서비스별 데이터 소유권, 부분 확장, 운영 복잡성은 Microsoft Azure Architecture Center의 공식 기술 지침과 Lewis·Fowler의 원문을 함께 사용했다.
- **트랜잭션 근거:** 서비스 간 ACID 제약과 최종 일관성은 Azure 데이터 지침, Saga의 동작과 한계는 Chris Richardson의 원 패턴 설명을 사용했다.
- **작성자 종합:** “명확한 독립 배포 요구가 없으면 모듈러 모놀리스로 시작한다”는 선택 규칙과 단계별 진화안은 위 자료를 종합한 판단이며 특정 공급자의 보장이나 보편 법칙이 아니다.

## Sources

근거 기준일: **2026-07-18**

- Spring, [Spring Modulith Reference 2.1.0 — Overview](https://docs.spring.io/spring-modulith/reference/index.html): 도구의 정체성과 현재 안정 문서 기준.
- Spring, [Fundamentals](https://docs.spring.io/spring-modulith/reference/fundamentals.html): 논리적 애플리케이션 모듈, 공개·내부 인터페이스, 패키지 기반 모듈 모델.
- Spring, [Verifying Application Module Structure](https://docs.spring.io/spring-modulith/reference/verification.html): 순환 의존, 내부 타입 접근, 허용 의존성 검증.
- Spring, [Integration Testing Application Modules](https://docs.spring.io/spring-modulith/reference/testing.html): 모듈 단위 부트스트랩과 통합 테스트.
- Spring, [Working with Application Events](https://docs.spring.io/spring-modulith/reference/events.html): 트랜잭션 이벤트 기록, 재처리, 브로커 외부화와 outbox 관련 한계.
- Microsoft, [Common web application architectures](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures): 모놀리식 애플리케이션의 단일 배포 단위와 전체 단위 확장.
- Microsoft Azure Architecture Center, [Microservices architecture style](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/microservices): 독립 배포, 서비스 자율성, 부분 확장·장애 격리와 운영상 난점.
- Microsoft Azure Architecture Center, [Data considerations for microservices](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/data-considerations): 서비스별 데이터 소유권, 공유 스키마 제약, 최종 일관성.
- James Lewis·Martin Fowler, [Microservices](https://martinfowler.com/articles/microservices.html) (2014): 마이크로서비스의 원형적 특성과 서비스·모놀리스 경계 비교.
- Martin Fowler, [Microservice Prerequisites](https://martinfowler.com/bliki/MicroservicePrerequisites.html) (2014): 자동 프로비저닝·배포, 모니터링과 DevOps 선행 역량.
- Chris Richardson, [Saga Pattern](https://microservices.io/patterns/data/saga.html): 서비스 간 업무 트랜잭션, 보상 처리와 격리 한계.
- Martin Fowler, [Monolith First](https://martinfowler.com/bliki/MonolithFirst.html) (2015): 초기 경계 불확실성과 모놀리스 우선 전략의 근거 및 한계.
- Zhamak Dehghani, [How to break a Monolith into Microservices](https://martinfowler.com/articles/break-monolith-into-microservices.html) (2018): 운영 준비도, 굵은 업무 능력 중심의 점진적 추출.

## Assumptions And Omissions

- 신규 Spring/JVM 기반 업무 시스템을 전제로 했다. 특정 산업 규제, 멀티리전 의무, 극단적 트래픽 또는 조직 구조는 주어지지 않았다.
- 성능·비용의 수치 비교는 워크로드, 클라우드 구성과 조직 생산성 데이터가 없으므로 제시하지 않았다.
- 모듈러 모놀리스가 반드시 하나의 데이터베이스나 스키마를 써야 한다고 가정하지 않았다. 마이크로서비스 역시 서비스마다 별도 물리 서버가 필요하다는 뜻이 아니라, 데이터에 대한 논리적 소유권과 직접 접근 통제가 핵심이다.
- 오래된 Fowler 자료는 현재 제품 기능이 아니라 마이크로서비스의 원형적 특성과 진화 원칙을 설명하는 1차 아키텍처 자료로 한정해 사용했다.
