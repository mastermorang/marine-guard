# Marine Guard 프로젝트 개발 현황

작성일: 2026-04-01

## 1. 프로젝트 개요

Marine Guard는 해양 레저 및 수상 활동 환경에서 착용형 디바이스와 현장 수신기를 통해
사용자의 위치 및 생체 신호를 확인하고, 위험 상황을 빠르게 감지하기 위한 시스템입니다.

현재 프로젝트는 다음 두 축으로 구성되어 있습니다.

- 기존 웹 기반 모니터링 시스템
- 신규 Java 기반 현장 운영 프로그램

현재 개발 방향은 `웹 중심`에서 `현장 노트북/PC에 설치하는 Java 데스크톱 프로그램 중심`으로
전환되었습니다.

## 2. 현재 개발 방향

초기에는 웹 대시보드와 서버를 통해 모니터링하는 구조를 병행했습니다.
하지만 실제 운영 환경을 고려했을 때, 현장 수신기와 직접 연결된 노트북 또는 PC에서
바로 데이터를 수신하고 확인할 수 있는 구조가 더 적합하다고 판단했습니다.

현재 기준 목표는 다음과 같습니다.

- 송수신기와 연결된 현장 운영 장비에서 직접 데이터 확인
- 디바이스의 위치 및 상태를 실시간으로 확인
- 수신기 연결 상태를 즉시 파악
- 향후 게스트 할당, 장비 관리, 운영 기록 기능까지 확장 가능한 구조 확보

따라서 웹 시스템은 현 단계에서 일단 정리된 상태로 유지하고,
앞으로의 주 개발은 Java 기반 운영 프로그램에 집중합니다.

## 3. 현재 구현 완료 항목

### 3.1 기존 웹 시스템

웹 시스템은 다음 수준까지 구현되어 있습니다.

- 대시보드, 라이브 맵, 사건 로그, 디바이스, 리포트 화면 구현
- React + Tailwind 기반 프론트엔드 재구성
- 수집기 상태 표시 및 연결 상태 시각화
- 센서/디바이스/게스트 흐름 일부 정리
- GitHub 저장소에 최신 상태 반영 완료

다만 현재 웹 시스템은 주 개발 대상이 아니며, 이 상태에서 유지합니다.

### 3.2 Java 데스크톱 운영 프로그램

새로운 Java 기반 현장 운영 프로그램 폴더가 추가되었습니다.

경로:

- [station-monitor](C:/Users/ccor1/OneDrive/Desktop/Marine%20guard%20project/station-monitor)

현재 이 프로그램에서 구현된 기능은 다음과 같습니다.

- COM 포트를 통한 수신기 직접 연결
- 수신기 연결 / 해제 상태 표시
- 디바이스 텔레메트리 수신
- 디바이스 목록 테이블 표시
- 선택 디바이스 상세 정보 표시
- 상대 좌표 기반 간이 맵 표시
- 이벤트 로그 표시
- 설정값 저장
  - COM 포트
  - Baud rate
  - 기준 위도/경도
  - 자동 기준 좌표 모드 여부

### 3.3 수신기 기준 좌표 처리

현재 Java 프로그램은 두 가지 기준 좌표 모드를 지원합니다.

1. 수동 입력 모드
2. 수신기 GPS 자동 추적 모드

#### 수동 입력 모드

운영자가 직접 기준 위도/경도를 입력하고 저장합니다.
저장된 값은 다음 실행 시 재사용됩니다.

#### 자동 추적 모드

수신기가 자신의 GPS 좌표를 시리얼 데이터로 송신하면,
프로그램이 해당 좌표를 받아 기준점으로 자동 반영합니다.

지원되는 수신기 좌표 데이터 예시:

```text
RX,$M35.097500,129.994900,receiver-gps
RECEIVER,$M35.097500,129.994900
BASE,$M35.097500,129.994900
R,$M35.097500,129.994900
```

즉, 향후 수신기 장치가 GPS를 함께 송신하면 운영자가 좌표를 반복 입력하지 않아도 됩니다.

## 4. 현재 사용 중인 주요 파일

### 기존 Java 프로그램

- [Wearable.java](C:/Users/ccor1/OneDrive/Desktop/Marine%20guard%20project/Wearable.java)

기존 Processing 기반 프로그램이며, 예전 시리얼 프로토콜과 화면 로직이 포함되어 있습니다.
현재는 참고 자산으로 보고 있으며, 신규 운영 프로그램은 별도 구조로 재작성 중입니다.

### 신규 Java 운영 프로그램

- [station-monitor/README.md](C:/Users/ccor1/OneDrive/Desktop/Marine%20guard%20project/station-monitor/README.md)
- [StationMonitorMain.java](C:/Users/ccor1/OneDrive/Desktop/Marine%20guard%20project/station-monitor/src/com/marineguard/station/StationMonitorMain.java)
- [StationMonitorFrame.java](C:/Users/ccor1/OneDrive/Desktop/Marine%20guard%20project/station-monitor/src/com/marineguard/station/StationMonitorFrame.java)
- [SerialReceiverService.java](C:/Users/ccor1/OneDrive/Desktop/Marine%20guard%20project/station-monitor/src/com/marineguard/station/SerialReceiverService.java)
- [TelemetryParser.java](C:/Users/ccor1/OneDrive/Desktop/Marine%20guard%20project/station-monitor/src/com/marineguard/station/TelemetryParser.java)
- [ReceiverLocation.java](C:/Users/ccor1/OneDrive/Desktop/Marine%20guard%20project/station-monitor/src/com/marineguard/station/ReceiverLocation.java)
- [MapCanvas.java](C:/Users/ccor1/OneDrive/Desktop/Marine%20guard%20project/station-monitor/src/com/marineguard/station/MapCanvas.java)
- [AppConfig.java](C:/Users/ccor1/OneDrive/Desktop/Marine%20guard%20project/station-monitor/src/com/marineguard/station/AppConfig.java)

## 5. 현재 데이터 처리 구조

현 단계 데이터 흐름은 아래와 같습니다.

```text
웨어러블 디바이스 -> 현장 수신기/송수신기 -> 시리얼(COM) -> Java Station Monitor
```

Java 프로그램은 수신기에서 전달되는 시리얼 문자열을 직접 읽고 해석합니다.

현재 지원 텔레메트리 예시:

```text
1,$M35.097012,129.994446,0,1,088
1,$M35.097012,129.994446,0,1,088,77,Guest 1
```

포함 정보:

- 디바이스 ID
- 위도
- 경도
- 응급 상태
- 착용/접촉 상태
- 심박수
- 배터리
- 게스트 이름

## 6. 현재까지 검증된 사항

- `station-monitor` Java 프로그램 빌드 성공
- 프로그램 기동 스모크 테스트 성공
- 기준 좌표 수동 저장 기능 동작
- 수신기 GPS 자동 기준점 반영 기능 코드 구현 완료
- GitHub `main` 브랜치에 최신 내용 반영 완료

## 7. 남은 주요 개발 과제

현재 가장 중요한 다음 단계는 아래와 같습니다.

### 7.1 실제 수신기 시리얼 포맷 최종 반영

현재 파서는 예상 포맷과 기존 포맷을 기준으로 작성되어 있습니다.
실제 현장 장비가 출력하는 문자열 샘플을 기준으로 세부 조정이 필요합니다.

### 7.2 게스트-디바이스 운영 관리 기능

목표 운영 흐름은 다음과 같습니다.

- 수신기와 디바이스가 연결됨
- 운영자가 디바이스를 확인함
- 운영자가 해당 디바이스에 게스트를 지정함
- 라이브 맵과 상태 화면에서 해당 게스트 기준으로 확인함

이를 위해 향후 다음 기능을 추가할 예정입니다.

- 디바이스별 게스트 할당 UI
- 장비 등록/해제 관리
- 상태 저장
- 운영 세션 관리

### 7.3 경고/이상 상황 처리 강화

추후 확장 예정 항목:

- 위험 수치 기반 경고 표시
- 심박수 임계치 경고
- 장비 미응답 알림
- 연결 끊김 이력 기록

### 7.4 현장 설치형 패키징

추후 사용자 편의를 위해 다음도 고려할 수 있습니다.

- 실행 파일 패키징
- 설치형 배포
- 로그 파일 저장
- 환경설정 GUI 고도화

## 8. 현재 결론

현재 Marine Guard 프로젝트는 단순 웹 서비스가 아니라,
현장 수신기와 직접 연결되는 `설치형 Java 운영 시스템`으로 방향이 명확해졌습니다.

웹 시스템은 참고 및 보조 수준으로 유지하고,
실제 운영 핵심은 `station-monitor` Java 프로그램으로 옮겨가고 있습니다.

이미 기본 수신, 디바이스 표시, 상대 위치 표시, 수신기 좌표 자동 기준점 반영까지
기초 구조는 마련된 상태입니다.

이제부터는 실제 장비 데이터 포맷, 게스트 관리, 경고 처리, 현장 배포성을 중심으로
완성도를 높이는 단계입니다.
