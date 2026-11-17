# 한끼로그

완성된 음식 사진으로 재료·만드는 법·예상 영양 정보를 정리하고, 인스타그램 게시글을 만드는 개인용 웹앱입니다.

- 서버·로그인 없음. 사진과 글은 사용하는 기기의 브라우저(IndexedDB)에만 저장됩니다.
- 사진 인식 기능은 없습니다. 메뉴 이름으로 앱 안의 참고 레시피를 찾고, 재료를 직접 고칩니다.
- 영양 수치는 입력한 재료로 계산한 추정값입니다.

## 자료 출처
- 영양: USDA National Nutrient Database for Standard Reference, Release 26 (미국 농무부, 공공 자료). `data/ingredients.json`에 재료별 NDB 번호와 원래 이름을 기록했습니다.
- 참고 레시피: 직접 작성한 가정식 레시피 (`data/recipes.json`).

## 구조
`index.html`, `styles.css`, `app.js`(전체 기능), `sw.js`(오프라인·새 버전 안내), `data/`.
빌드 과정 없이 GitHub Pages로 그대로 배포합니다.
