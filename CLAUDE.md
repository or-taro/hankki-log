# 한끼로그 — Claude 작업 기준

주인님이 개발·관리하고 다른 사람이 쓰는 개인용 웹앱. 기준 문서: Claude Doc "한끼로그 개발 요청서 v2" (https://claude.ai/artifact/Mp3bUs6s2TvXKkWa3rYKrz).

- 저장소 `or-taro/hankki-log`(공개), 배포 GitHub Pages `https://or-taro.github.io/hankki-log/`. 빌드 없음.
- commit·push·배포는 매번 주인님 승인. 오르타로 등 다른 프로젝트는 수정하지 않는다.
- 서버·로그인·유료 API 없음. 사진은 기기 밖으로 보내지 않는다.
- 사진 인식 없음: '사진 기반 추정' 같은 표현 금지. 건강 효과 표현 금지. 해시태그 최대 5개, 본문 2,200자.
- 실기기 확인 전에는 PENDING. 아이폰 결과를 안드로이드로 대신하지 않는다.
- 업데이트할 때 `app.js`의 VERSION과 `sw.js`의 CACHE 이름을 함께 올린다(새 버전 안내가 뜨려면 필요).

## 파일
- `app.js` 전체 기능, `styles.css`, `index.html`, `sw.js`, `manifest.webmanifest`
- `data/ingredients.json` 재료 107개 (USDA SR26, 재료별 NDB 번호 기록)
- `data/recipes.json` 직접 쓴 참고 레시피 52개 (영양 자료에 없는 재료는 `name`만 있고 계산에서 제외됨)
- `data/tips.json` 식단 팁 초안, `approved:false` (주인님 승인 전)

## 진행
- [x] 2026-11-17 1단계 첫 구현, 자동 시험 144/144 PASS (Chromium, PC 1366 / 모바일 390 / 320). WebKit 시험 환경 없음
- [ ] 저장소 생성(주인님) → push·Pages 배포(승인 후)
- [ ] 안드로이드·아이폰 13 Pro 실기기 체크리스트
- [ ] 식단 팁 문구 승인, 식약처 자료 재사용 조건 확인, 재료 300개로 확대
- [ ] 2단계 시험판(5초 MP4 저장)
