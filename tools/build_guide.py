# 만화 사용설명서(guide.html) 생성기. 화면 캡처는 guide/*.jpg (tools/shots2.py로 다시 찍을 수 있음)
import html
MASCOT = '''<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="#e6efe2"/><path d="M48 24c-6 6 6 10 0 18M62 20c-6 7 6 11 0 20M76 24c-6 6 6 10 0 18" stroke="#9db59f" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M20 58h80c0 23-18 38-40 38S20 81 20 58z" fill="#fff" stroke="#2f3a30" stroke-width="4"/><ellipse cx="60" cy="58" rx="40" ry="9" fill="#f6d9d3" stroke="#2f3a30" stroke-width="4"/><circle cx="46" cy="74" r="4" fill="#2f3a30"/><circle cx="74" cy="74" r="4" fill="#2f3a30"/><path d="M53 81q7 6 14 0" stroke="#2f3a30" stroke-width="3.5" fill="none" stroke-linecap="round"/><ellipse cx="38" cy="81" rx="6" ry="3.5" fill="#f3b6aa"/><ellipse cx="82" cy="81" rx="6" ry="3.5" fill="#f3b6aa"/></svg>'''
# (화 제목, 색, [(그림, 한끼 대사, 작은 설명)])
EP = [
 ("목표부터 정해요", "butter", [
   ("01_settings", "위쪽 메뉴에서 <b>설정·백업</b>을 눌러요!", ""),
   ("02_goal", "내 하루 목표 열량이랑 단백질을 넣고 <b>저장</b>!", "목표는 앱이 정해 주지 않아요. 원래 하던 식단 숫자를 넣어요."),
 ]),
 ("한 끼 기록하기", "sage", [
   ("03_title", "<b>새 콘텐츠</b>에서 메뉴 이름을 먼저 적어요.", "예: 닭가슴살 현미덮밥"),
   ("04_meal", "아침·점심·저녁·간식 중에 골라요. 반만 먹었으면 <b>먹은 양 0.5</b>!", "날짜와 끼니는 지금 시간에 맞춰 미리 골라져 있어요."),
   ("05_upload", "큰 칸을 눌러서 음식 사진을 골라요. 한 장이어도 괜찮아요!", "최대 10장. 사진은 폰 밖으로 나가지 않아요."),
   ("06_next", "다 올렸으면 <b>다음</b>을 눌러요.", ""),
   ("07_find", "<b>레시피 찾기</b>를 누르면 비슷한 레시피를 찾아 줘요.", "‘식단’ 표시가 붙은 건 다이어트 식단 레시피예요."),
   ("08_pick", "맞는 걸 콕! 재료가 자동으로 채워져요.", ""),
   ("09_amount", "실제로 먹은 양이랑 다르면 숫자를 고쳐요.", "g 말고 개·큰술·작은술로 바꿀 수도 있어요."),
   ("10_excluded", "이 표시가 나오면 앱 자료에 없는 재료라 합계에서 빠진 거예요.", "고추장·김치·곤약면 같은 재료예요. 실제보다 조금 낮게 나올 수 있어요."),
   ("11_nutri", "짜잔! 이 한 끼가 내 하루 목표의 몇 %인지 보여 줘요.", "사진을 보고 맞히는 게 아니라, 넣은 재료로 계산한 추정값이에요."),
 ]),
 ("인스타 게시글", "pink", [
   ("12_tomake", "이제 <b>다음: 만들기</b>로 가요.", ""),
   ("13_tags", "해시태그를 고르고 <b>게시글 만들기</b>!", "인스타는 해시태그 5개까지라서 5개까지만 골라져요."),
   ("14_copy", "<b>전체 복사</b>해서 인스타 문구 칸에 붙여넣으면 끝!", "글은 올리기 전에 마음대로 고쳐도 돼요."),
   ("15_save", "기록을 남기려면 <b>보관함에 저장</b>을 꼭 눌러요.", ""),
 ]),
 ("사진 한 장으로 인스타 사진", "pink", [
   ("16_cardtab", "<b>인스타 사진</b> 탭을 눌러요.", "완성 사진 한 장으로 표지·가까이·재료·만드는 법·영양 정보 사진을 만들어요."),
   ("17_style", "글씨체랑 색감을 골라요. 뭐가 제일 귀여울까?", "‘가까이’ 장은 가로·세로·확대 막대로 위치를 맞춰요."),
   ("18_cards", "<b>사진 만들기</b>를 누르면 여러 장이 뚝딱!", ""),
   ("18b_save", "마음에 들면 <b>만든 사진 모두 저장</b>!", "아이폰은 공유 창에서 ‘이미지 저장’, 안드로이드는 다운로드에 저장돼요. 인스타에서 순서대로 골라 올려요."),
 ]),
 ("하루 합계 보기", "sage", [
   ("19_library", "<b>보관함</b>에 가면 오늘 먹은 끼니를 모두 더해서 보여 줘요.", "열기로 다시 고치고, 복제로 자주 먹는 메뉴를 빨리 기록해요."),
 ]),
 ("백업이랑 도움 요청", "butter", [
   ("20_backup", "2주에 한 번은 <b>백업 내보내기</b>를 꾹!", "기록은 이 폰 안에만 있어요. 폰을 바꾸면 ‘백업 가져오기’로 옮겨요."),
   ("21_diag", "이상하면 <b>오류 정보 복사</b> → 화면 캡처랑 같이 보내 주세요.", "사진과 글 내용은 들어가지 않아요."),
 ]),
]
def panel(img, say, note, k):
    tilt = ['-0.6deg', '0.5deg', '-0.3deg', '0.7deg'][k % 4]
    return f'''<figure class="panel" style="--tilt:{tilt}">
  <div class="talk"><div class="face">{MASCOT}</div><div class="bubble">{say}</div></div>
  <img src="guide/{img}.jpg" alt="" loading="lazy">
  {f'<figcaption>{note}</figcaption>' if note else ''}
</figure>'''
body = []
k = 0
for i, (title, color, panels) in enumerate(EP, start=2):
    ps = []
    for img, say, note in panels: ps.append(panel(img, say, note, k)); k += 1
    body.append(f'<section class="ep {color}" id="ep{i}"><h2><span class="no">{i}화</span>{title}</h2><div class="grid">{"".join(ps)}</div></section>')
toc = ''.join(f'<a href="#ep{i}">{i}화 {t}</a>' for i, (t, _, _) in enumerate(EP, start=2))
HTML = f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>만화로 보는 한끼로그 사용법</title><meta name="robots" content="noindex"><meta name="theme-color" content="#6f8f72"><link rel="icon" href="icon-192.png">
<style>
@font-face{{font-family:"HK Jua";src:url(fonts/Jua.woff) format("woff");font-display:swap}}
:root{{--ink:#2f3a30;--sage:#6f8f72;--sage-l:#e6efe2;--pink:#ffe3dd;--pink-d:#e0705f;--butter:#fff3c9;--bg:#fff9ef}}
*{{box-sizing:border-box}}
body{{margin:0;color:var(--ink);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;background:var(--bg) radial-gradient(#f0dfc0 1.4px,transparent 1.5px) 0 0/18px 18px;padding-bottom:calc(2rem + env(safe-area-inset-bottom))}}
.wrap{{max-width:900px;margin:0 auto;padding:0 .9rem}}
.jua,h1,h2,.bubble,.toc a,.go{{font-family:"HK Jua",-apple-system,"Apple SD Gothic Neo",sans-serif;font-weight:400}}
.cover{{margin:calc(1.4rem + env(safe-area-inset-top)) 0 1rem;background:#fff;border:4px solid var(--ink);border-radius:26px;box-shadow:6px 6px 0 var(--ink);padding:1.2rem 1rem 1.3rem;text-align:center;position:relative;overflow:hidden}}
.cover::before{{content:"";position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 50% 38%,#fff6dc 0 8deg,#fff 8deg 16deg);opacity:.9}}
.cover>*{{position:relative}}
.cover .big{{width:130px;height:130px;margin:0 auto;animation:bob 2.4s ease-in-out infinite}}
@keyframes bob{{50%{{transform:translateY(-6px) rotate(-3deg)}}}}
@media (prefers-reduced-motion:reduce){{.cover .big{{animation:none}}}}
.cover h1{{font-size:2.1rem;margin:.2rem 0 0;line-height:1.25}}
.cover h1 em{{font-style:normal;color:var(--sage)}}
.cover .hello{{display:inline-block;margin-top:.7rem;background:var(--pink);border:3px solid var(--ink);border-radius:18px;padding:.4rem .9rem;font-family:"HK Jua",sans-serif;font-size:1.1rem;box-shadow:3px 3px 0 var(--ink)}}
.toc{{display:flex;flex-wrap:wrap;gap:.4rem;justify-content:center;margin:1rem 0 .5rem}}
.toc a{{text-decoration:none;color:var(--ink);background:#fff;border:2.5px solid var(--ink);border-radius:999px;padding:.15rem .75rem;box-shadow:2px 2px 0 var(--ink);font-size:.98rem}}
.ep{{margin:1.6rem 0}}
.ep h2{{display:flex;align-items:center;gap:.5rem;font-size:1.6rem;margin:0 0 .8rem}}
.ep h2 .no{{background:var(--ink);color:#fff;border-radius:12px;padding:.05rem .6rem;font-size:1.1rem;transform:rotate(-4deg)}}
.grid{{display:grid;grid-template-columns:1fr;gap:1.1rem}}
@media (min-width:700px){{.grid{{grid-template-columns:1fr 1fr}}}}
.panel{{margin:0;background:#fff;border:3.5px solid var(--ink);border-radius:20px;box-shadow:5px 5px 0 var(--ink);padding:.8rem;transform:rotate(var(--tilt));}}
.ep.sage .panel{{background:linear-gradient(#f3f8f0,#fff 40%)}}
.ep.pink .panel{{background:linear-gradient(#fff1ed,#fff 40%)}}
.ep.butter .panel{{background:linear-gradient(#fff8dc,#fff 40%)}}
.talk{{display:flex;align-items:flex-start;gap:.55rem;margin-bottom:.7rem}}
.face{{width:58px;height:58px;flex:none}}
.bubble{{position:relative;background:#fff;border:3px solid var(--ink);border-radius:18px;padding:.45rem .75rem;font-size:1.16rem;line-height:1.4;box-shadow:3px 3px 0 var(--ink)}}
.bubble b{{color:#d4594a;font-weight:400}}
.bubble::before{{content:"";position:absolute;left:-12px;top:16px;width:16px;height:16px;background:#fff;border-left:3px solid var(--ink);border-bottom:3px solid var(--ink);transform:rotate(45deg)}}
.panel img{{display:block;width:100%;border-radius:14px;border:2.5px solid var(--ink)}}
.panel figcaption{{margin-top:.55rem;font-size:.93rem;background:#fffbe9;border:2px dashed #e5cf8c;border-radius:12px;padding:.35rem .6rem}}
.home{{display:grid;grid-template-columns:1fr;gap:1rem}}
@media (min-width:700px){{.home{{grid-template-columns:1fr 1fr}}}}
.phone{{background:#fff;border:3.5px solid var(--ink);border-radius:20px;box-shadow:5px 5px 0 var(--ink);padding:.9rem}}
.phone h3{{font-family:"HK Jua",sans-serif;font-weight:400;font-size:1.25rem;margin:0 0 .4rem}}
.phone ol{{margin:.2rem 0 0;padding-left:1.3rem}}
.phone li{{margin:.25rem 0}}
.ico{{display:inline-flex;vertical-align:middle;width:28px;height:28px;border:2px solid var(--ink);border-radius:8px;align-items:center;justify-content:center;background:#fff}}
.ring{{outline:3px solid #ff6f61;outline-offset:2px;border-radius:8px}}
.end{{text-align:center;background:#fff;border:4px solid var(--ink);border-radius:26px;box-shadow:6px 6px 0 var(--ink);padding:1.2rem;margin:2rem 0 1rem}}
.end .big{{width:110px;height:110px;margin:0 auto}}
.go{{display:inline-block;margin-top:.8rem;background:var(--sage);color:#fff;text-decoration:none;border:3px solid var(--ink);border-radius:999px;padding:.55rem 1.6rem;font-size:1.3rem;box-shadow:4px 4px 0 var(--ink)}}
footer{{text-align:center;color:#7a8274;font-size:.82rem}}
</style></head>
<body><div class="wrap">
<header class="cover">
  <div class="big">{MASCOT}</div>
  <h1>만화로 보는<br><em>한끼로그</em> 사용법</h1>
  <div class="hello">안녕! 나는 한끼예요. 같이 기록해 봐요!</div>
  <nav class="toc"><a href="#ep1">1화 처음 한 번</a>{toc}</nav>
</header>
<section class="ep butter" id="ep1"><h2><span class="no">1화</span>처음 한 번만, 홈 화면에 추가!</h2>
  <figure class="panel" style="--tilt:-.4deg;margin-bottom:1rem"><div class="talk" style="margin:0"><div class="face">{MASCOT}</div><div class="bubble">홈 화면에 나를 데려가면 진짜 앱처럼 열리고, 기록도 더 안전해요!</div></div></figure>
  <div class="home">
    <div class="phone"><h3>아이폰 (Safari)</h3><ol>
      <li>Safari로 한끼로그 주소를 열어요.</li>
      <li>아래쪽 <span class="ico ring"><svg width="16" height="18" viewBox="0 0 16 18"><path d="M8 1v11M4 5l4-4 4 4" stroke="#2f3a30" stroke-width="2" fill="none"/><path d="M3 8H1.5v9h13V8H13" stroke="#2f3a30" stroke-width="2" fill="none"/></svg></span> 공유 버튼을 눌러요.</li>
      <li><b>홈 화면에 추가</b> → <b>추가</b>!</li></ol></div>
    <div class="phone"><h3>안드로이드 (Chrome)</h3><ol>
      <li>Chrome으로 한끼로그 주소를 열어요.</li>
      <li>오른쪽 위 <span class="ico ring"><svg width="6" height="18" viewBox="0 0 6 18"><circle cx="3" cy="3" r="2" fill="#2f3a30"/><circle cx="3" cy="9" r="2" fill="#2f3a30"/><circle cx="3" cy="15" r="2" fill="#2f3a30"/></svg></span> 를 눌러요.</li>
      <li><b>홈 화면에 추가</b>(또는 앱 설치)!</li></ol></div>
  </div>
  <p class="jua" style="font-size:1.1rem;margin:.9rem 0 0">위에 ‘새 버전이 있어요’가 보이면 <span style="background:#6f8f72;color:#fff;border-radius:8px;padding:0 .4rem">적용</span>을 눌러 주세요!</p>
</section>
{''.join(body)}
<div class="end"><div class="big">{MASCOT}</div><p class="jua" style="font-size:1.4rem;margin:.3rem 0 0">오늘도 맛있게, 꾸준히 기록해요!</p><a class="go" href="./">한끼로그 열기</a></div>
<footer>영양 정보는 입력한 재료로 계산한 추정값이에요 · 영양 자료: USDA</footer>
</div></body></html>'''
open('guide.html', 'w', encoding='utf-8').write(HTML)
print('panels', k)
