import subprocess, sys, time, json
from playwright.sync_api import sync_playwright
from PIL import Image
OUT='/home/claude/hankki-log/guide/'
srv = subprocess.Popen([sys.executable,'-m','http.server','8772','--bind','127.0.0.1','-d','/home/claude/hankki-log'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
CSS='''@font-face{font-family:"HK Jua";src:url(fonts/Jua.woff)}
.toast{display:none!important}
.hk-ring{position:absolute;z-index:9999;border:4px solid #ff6f61;border-radius:14px;box-shadow:0 0 0 5px rgba(255,111,97,.28);pointer-events:none}
.hk-bub{position:absolute;z-index:10000;background:#fff;border:3px solid #2f3a30;border-radius:16px;padding:6px 12px;font:20px/1.3 "HK Jua",sans-serif;color:#2f3a30;box-shadow:3px 3px 0 #2f3a30;white-space:nowrap;pointer-events:none}
.hk-bub.pink{background:#ffe3dd}
.hk-bub::after{content:"";position:absolute;left:var(--tx,24px);width:14px;height:14px;background:inherit;border:3px solid #2f3a30;transform:rotate(45deg)}
.hk-bub.down::after{bottom:-10px;border-top:0;border-left:0}
.hk-bub.up::after{top:-10px;border-bottom:0;border-right:0}
.hk-num{position:absolute;z-index:10001;width:30px;height:30px;border-radius:50%;background:#ff6f61;color:#fff;font:18px/30px "HK Jua",sans-serif;text-align:center;border:2px solid #fff;pointer-events:none}
'''
JS='''([marks])=>{document.querySelectorAll('.hk-ring,.hk-bub,.hk-num').forEach(e=>e.remove());
 marks.forEach(([sel,text,side,n,pink],i)=>{const el=document.querySelector(sel); if(!el) throw new Error('no '+sel); const r=el.getBoundingClientRect(); const sx=scrollX, sy=scrollY; const P=6;
  const ring=document.createElement('div'); ring.className='hk-ring'; Object.assign(ring.style,{left:(r.left+sx-P)+'px',top:(r.top+sy-P)+'px',width:(r.width+2*P)+'px',height:(r.height+2*P)+'px'}); document.body.appendChild(ring);
  if(n){const b=document.createElement('div'); b.className='hk-num'; b.textContent=n; Object.assign(b.style,{left:(r.left+sx-P-14)+'px',top:(r.top+sy-P-14)+'px'}); document.body.appendChild(b);}
  if(text){const b=document.createElement('div'); b.className='hk-bub '+(side==='above'?'down':'up')+(pink?' pink':''); b.textContent=text; document.body.appendChild(b);
   const bw=b.offsetWidth,bh=b.offsetHeight; let x=r.left+sx+r.width/2-bw/2; x=Math.max(8,Math.min(innerWidth-bw-8,x));
   const y= side==='above' ? r.top+sy-P-bh-16 : r.bottom+sy+P+16; Object.assign(b.style,{left:x+'px',top:y+'px'}); b.style.setProperty('--tx',Math.max(14,Math.min(bw-30,(r.left+sx+r.width/2)-x-9))+'px');}
 });}'''
def shot(pg,name,marks,center=None,h=560):
    sel=center or marks[0][0]
    pg.locator(sel).first.scroll_into_view_if_needed()
    pg.evaluate(f"(()=>{{const r=document.querySelector({json.dumps(sel)}).getBoundingClientRect(); scrollBy(0, r.top + r.height/2 - innerHeight/2);}})()")
    pg.wait_for_timeout(120)
    pg.evaluate(JS,[marks])
    rect=pg.evaluate(f"(()=>{{const r=document.querySelector({json.dumps(sel)}).getBoundingClientRect(); return [r.top,r.bottom]}})()")
    top=max(0,min(844-h,(rect[0]+rect[1])/2-h/2))
    pg.screenshot(path='/tmp/_s.png',clip={'x':0,'y':top,'width':390,'height':h})
    pg.evaluate("document.querySelectorAll('.hk-ring,.hk-bub,.hk-num').forEach(e=>e.remove())")
    Image.open('/tmp/_s.png').convert('RGB').save(OUT+name+'.jpg',quality=80,optimize=True); print(name)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    pg.on('dialog',lambda d:d.accept())
    pg.goto('http://127.0.0.1:8772/'); pg.wait_for_function("document.querySelector('#dataInfo').textContent.length>0")
    pg.add_style_tag(content=CSS); pg.evaluate("document.fonts.load('20px \"HK Jua\"')"); pg.wait_for_timeout(300)
    pg.evaluate("cur.meal='점심';fillForm()")
    shot(pg,'01_settings',[('.nav [data-view=settings]','먼저 여기를 눌러요!','below',None,1)],center='.top',h=360)
    pg.click('.nav [data-view=settings]')
    pg.fill('#goalKcal','1500'); pg.fill('#goalProtein','90')
    shot(pg,'02_goal',[('#goalKcal','내 목표 열량','above',1,0),('#saveGoals','다 넣었으면 저장!','below',2,1)],center='#goalKcal',h=460)
    pg.click('#saveGoals'); pg.wait_for_timeout(200)
    pg.click('.nav [data-view=make]'); pg.evaluate("scrollTo(0,0)")
    shot(pg,'03_title',[('#title','메뉴 이름을 적어요','below',1,0)],center='#title',h=380)
    pg.fill('#title','닭가슴살 현미덮밥')
    shot(pg,'04_meal',[('#mealChips','언제 먹었나요?','below',2,0),('#eaten','반만 먹었으면 0.5','below',None,1)],center='#mealChips',h=420)
    shot(pg,'05_upload',[('#uploadLabel','여기를 눌러 사진 고르기!','above',3,1)],center='#uploadLabel',h=480)
    pg.set_input_files('#fileInput',[sys.argv[1] if len(sys.argv)>1 else 'dish.jpg']); pg.wait_for_function("document.querySelectorAll('#photos li').length===1")
    shot(pg,'06_next',[('[data-col="1"] [data-go="2"]','다 올렸으면 다음!','above',None,1)],center='[data-col="1"] [data-go="2"]',h=520)
    pg.click('[data-col="1"] [data-go="2"]'); pg.evaluate("scrollTo(0,0)")
    shot(pg,'07_find',[('#findRecipe','레시피 찾기를 눌러요','below',1,1)],center='#findRecipe',h=440)
    pg.click('#findRecipe'); pg.wait_for_timeout(150)
    shot(pg,'08_pick',[('#recipeResults button','맞는 걸 골라요','below',2,0)],center='#recipeResults',h=440)
    pg.locator('#recipeResults button').first.click(); pg.wait_for_timeout(150)
    pg.click('#addIng'); last=pg.locator('#ingBody tr').last; last.locator('input[data-f=name]').fill('고추장'); last.locator('input[data-f=amount]').fill('10'); pg.evaluate("document.activeElement.blur()")
    shot(pg,'09_amount',[('#ingBody tr:nth-child(2) input[data-f=amount]','실제로 먹은 양으로 고쳐요','above',None,0)],center='#ingBody tr:nth-child(2)',h=420)
    shot(pg,'10_excluded',[('#ingBody tr:last-child .st','자료에 없는 재료는 빠져요','above',None,1)],center='#ingBody tr:last-child',h=380)
    shot(pg,'11_nutri',[('#nutri .goalbar','내 목표의 몇 %인지 나와요','above',None,1)],center='#nutri',h=520)
    shot(pg,'12_tomake',[('[data-col="2"] [data-go="3"]','이제 만들기로!','above',None,0)],center='[data-col="2"] [data-go="3"]',h=420)
    pg.click('[data-col="2"] [data-go="3"]'); pg.evaluate("scrollTo(0,0)")
    shot(pg,'13_tags',[('#tagChips','해시태그는 5개까지','above',None,0),('#genPost','게시글 만들기!','below',1,1)],center='#genPost',h=600)
    pg.click('#genPost'); pg.wait_for_timeout(150)
    shot(pg,'14_copy',[('#copyPost','복사해서 인스타에 붙여넣기','above',2,1)],center='#copyPost',h=520)
    shot(pg,'15_save',[('#saveEntry','기록 저장은 여기!','below',None,0)],center='#saveEntry',h=420)
    pg.click('#saveEntry'); pg.wait_for_timeout(200); pg.evaluate("scrollTo(0,0)")
    shot(pg,'16_cardtab',[('#tabCards','사진 한 장으로 여러 장!','below',1,1)],center='#tabCards',h=420)
    pg.click('#tabCards'); pg.wait_for_timeout(300)
    shot(pg,'17_style',[('#fontChips','글씨체 고르기','above',2,0),('#themeChips','색감 고르기','below',3,0)],center='#fontChips',h=480)
    pg.click('#makeCards'); pg.wait_for_function("!document.querySelector('#makeCards').disabled && document.querySelectorAll('#cardsOut img').length>0"); pg.wait_for_timeout(500)
    shot(pg,'18_cards',[('#makeCards','사진 만들기!','above',4,0)],center='#makeCards',h=640)
    shot(pg,'18b_save',[('#saveCards','마음에 들면 모두 저장','above',5,1)],center='#saveCards',h=640)
    pg.evaluate("(async()=>{const e=JSON.parse(JSON.stringify(cur));e.id='b';e.meal='아침';e.title='그릭요거트 볼';e.photos=[];e.ingredients=[{name:'그릭 요거트(무지방 플레인)',amount:'150',unit:'g'},{name:'블루베리',amount:'50',unit:'g'}];await DB.put('entries',e)})()")
    pg.click('.nav [data-view=library]'); pg.wait_for_selector('#libList li.day'); pg.evaluate("scrollTo(0,0)")
    shot(pg,'19_library',[('#libList li.day','오늘 먹은 걸 모두 더해요','below',None,1)],center='#libList li.day',h=440)
    pg.click('.nav [data-view=settings]'); pg.evaluate("scrollTo(0,0)")
    shot(pg,'20_backup',[('#exportBtn','2주에 한 번 꾹!','above',None,1)],center='#exportBtn',h=440)
    shot(pg,'21_diag',[('#copyDiag','문제가 생기면 여기','above',None,0)],center='#copyDiag',h=400)
    b.close()
finally: srv.terminate()
