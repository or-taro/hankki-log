'use strict';
/* 한끼로그 1단계 — 서버 없음. 데이터는 이 브라우저의 IndexedDB에만 저장한다. */
const VERSION = '0.2.0';
const MAX_PHOTOS = 10, MAX_BYTES = 30 * 1024 * 1024, LONG_EDGE = 1600, MAX_CAPTION = 2200, MAX_TAGS = 5;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const errors = [];
function logErr(where, e) { errors.push({ t: new Date().toISOString(), where, msg: String(e && (e.message || e)).slice(0, 300) }); if (errors.length > 20) errors.shift(); }
window.addEventListener('error', e => logErr('window', e.message));
window.addEventListener('unhandledrejection', e => logErr('promise', e.reason));

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2200); }
function msg(el, t, kind) { el.textContent = t || ''; el.className = 'msg' + (kind ? ' ' + kind : '') + (el.classList.contains('small') ? ' small' : ''); }
const norm = s => String(s || '').toLowerCase().replace(/[\s·,()（）\-_/]/g, '');
const fmt = (n, d = 0) => (n == null || isNaN(n)) ? '-' : Number(n).toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- IndexedDB ---------- */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('hankki-log', 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('entries', { keyPath: 'id' }); d.createObjectStore('photos', { keyPath: 'id' }); d.createObjectStore('meta', { keyPath: 'k' }); };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode); const s = t.objectStore(store); let out;
      const r = fn(s); if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('저장 공간이 부족할 수 있어요'));
    });
  },
  put(store, v) { return this.tx(store, 'readwrite', s => s.put(v)); },
  get(store, k) { return this.tx(store, 'readonly', s => s.get(k)); },
  del(store, k) { return this.tx(store, 'readwrite', s => s.delete(k)); },
  all(store) { return this.tx(store, 'readonly', s => s.getAll()); },
  clear(store) { return this.tx(store, 'readwrite', s => s.clear()); },
  async meta(k, v) { if (v === undefined) { const r = await this.get('meta', k); return r ? r.v : undefined; } return this.put('meta', { k, v }); }
};

/* ---------- 데이터 ---------- */
let ING = [], ING_BY_ID = {}, RECIPES = [], TIPS = { approved: false, tips: [] }, DATA_VER = '';
async function loadData() {
  const [a, b, c] = await Promise.all(['data/ingredients.json', 'data/recipes.json', 'data/tips.json'].map(u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); })));
  ING = a.items; ING.forEach(i => { ING_BY_ID[i.id] = i; i._keys = [i.ko, ...i.aliases].map(norm); });
  RECIPES = b.recipes; RECIPES.forEach(r => r._keys = [r.name, ...r.aliases].map(norm));
  TIPS = c; DATA_VER = a.version;
  $('#ingList').innerHTML = ING.map(i => `<option value="${esc(i.ko)}">`).join('');
  $('#dataInfo').textContent = `재료 ${ING.length}개 · 참고 레시피 ${RECIPES.length}개 (자료 ${DATA_VER})`;
}
function matchIng(name) {
  const k = norm(name); if (!k) return null;
  let hit = ING.find(i => i._keys.includes(k)); if (hit) return hit;
  // 손질 상태만 다른 이름(예: 다진 마늘, 삶은 달걀)은 같은 재료로 본다. 그 밖의 부분 일치는 쓰지 않는다(고추장≠고추).
  const k2 = norm(String(name).replace(/^(다진|썬|채썬|생|삶은|익힌|데친|볶은|구운|손질한|냉동|불린|말린)\s*/, ''));
  return (k2 && k2 !== k && ING.find(i => i._keys.includes(k2))) || null;
}

/* ---------- 현재 콘텐츠 상태 ---------- */
const UNITS = ['g', '개', '큰술', '작은술', 'ml', '컵'];
const MEALS = ['아침', '점심', '저녁', '간식'];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function guessMeal() { const h = new Date().getHours(); return h < 10 ? '아침' : h < 15 ? '점심' : h < 17 ? '간식' : h < 22 ? '저녁' : '간식'; }
let GOALS = { kcal: null, protein: null };
function blankEntry() { return { id: uid(), date: today(), meal: guessMeal(), eaten: 1, title: '', photos: [], cover: 0, servings: 1, ingredients: [{ name: '', amount: '', unit: 'g' }], steps: '', recipeDraft: false, example: false, tone: 'diet', inc: { ing: true, steps: true, nutri: true, tip: false }, tags: [], tagPool: [], post: '', created: Date.now(), updated: Date.now() }; }
let cur = blankEntry(), photoURLs = {}, dirty = false;

function grams(row, ing) {
  const a = parseFloat(row.amount); if (!(a > 0)) return { g: null, why: '양을 입력해 주세요' };
  switch (row.unit) {
    case 'g': return { g: a };
    case 'ml': return { g: a, est: true };
    case '컵': return { g: a * 200, est: true };
    case '개': return ing && ing.piece_g ? { g: a * ing.piece_g, est: true } : { g: null, why: '‘개’ 무게 정보가 없어요. g로 입력해 주세요' };
    case '큰술': return { g: a * (ing && ing.tbsp_g || 15), est: true };
    case '작은술': return { g: a * (ing && ing.tbsp_g || 15) / 3, est: true };
  }
  return { g: null, why: '단위를 확인해 주세요' };
}
function calc(e = cur) {
  const keys = ['kcal', 'carb', 'protein', 'fat', 'sugar', 'fiber', 'sodium'];
  const tot = Object.fromEntries(keys.map(k => [k, 0])); const rows = []; let missing = 0, est = false, used = 0;
  for (const r of e.ingredients) {
    if (!r.name.trim() && !r.amount) { rows.push({ st: '' }); continue; }
    const ing = matchIng(r.name);
    if (!ing) { missing++; rows.push({ st: '계산에서 제외됨 · 영양 자료에 없는 재료', miss: true }); continue; }
    const g = grams(r, ing);
    if (g.g == null) { missing++; rows.push({ st: '계산에서 제외됨 · ' + g.why, miss: true, ing }); continue; }
    used++; if (g.est) est = true;
    for (const k of keys) if (ing.per100[k] != null) tot[k] += ing.per100[k] * g.g / 100;
    rows.push({ st: `${ing.ko} · 약 ${fmt(g.g)}g${g.est ? ' (단위 환산 추정)' : ''}`, ing, g: g.g });
  }
  const sv = Math.max(1, parseInt(e.servings) || 1);
  const per = Object.fromEntries(keys.map(k => [k, tot[k] / sv]));
  const eaten = Math.max(0, parseFloat(e.eaten) || 1);
  const ate = Object.fromEntries(keys.map(k => [k, per[k] * eaten]));
  return { tot, per, ate, eaten, rows, missing, est, used, sv };
}

/* ---------- 화면: 단계 ---------- */
function setStep(n) {
  $('.cols').dataset.step = n;
  $$('.steps button').forEach(b => b.classList.toggle('on', b.dataset.step == n));
  if (matchMedia('(max-width:899px)').matches) window.scrollTo({ top: 0 });
}
function setView(v) {
  $$('.view').forEach(s => s.hidden = s.id !== 'view-' + v);
  $$('.nav button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  if (v === 'library') renderLibrary();
  if (v === 'settings') renderSettings();
  window.scrollTo({ top: 0 });
}

/* ---------- 사진 ---------- */
function loadImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => res({ img, url }); img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
    img.src = url;
  });
}
async function shrink(file) {
  let src, w, h, cleanup = () => { };
  try {
    if ('createImageBitmap' in window) {
      src = await createImageBitmap(file, { imageOrientation: 'from-image' }); w = src.width; h = src.height; cleanup = () => src.close && src.close();
    } else throw 0;
  } catch (e) {
    const r = await loadImage(file); src = r.img; w = r.img.naturalWidth; h = r.img.naturalHeight; cleanup = () => URL.revokeObjectURL(r.url);
  }
  const s = Math.min(1, LONG_EDGE / Math.max(w, h)); const cw = Math.round(w * s), ch = Math.round(h * s);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0, cw, ch); cleanup();
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
  if (!blob) throw new Error('encode');
  return { blob, w: cw, h: ch };
}
async function addFiles(files) {
  const el = $('#photoMsg'); msg(el, '');
  const room = MAX_PHOTOS - cur.photos.length;
  if (room <= 0) return msg(el, `사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요.`, 'err');
  const list = [...files]; const fails = [];
  if (list.length > room) fails.push(`${list.length - room}장은 ${MAX_PHOTOS}장 제한으로 빠졌어요.`);
  msg(el, '사진을 준비하는 중…');
  for (const f of list.slice(0, room)) {
    if (f.size > MAX_BYTES) { fails.push(`${f.name}: 30MB보다 커요.`); continue; }
    try {
      const { blob, w, h } = await shrink(f);
      const id = uid(); await DB.put('photos', { id, blob, w, h });
      cur.photos.push(id); photoURLs[id] = URL.createObjectURL(blob);
    } catch (e) {
      logErr('photo', (f.type || '?') + ' ' + e);
      const heic = /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
      fails.push(`${f.name}: 이 사진 형식은 열 수 없어요. 사진 앱에서 내보내기 → JPEG로 저장 후 다시 선택해 주세요.${heic ? ' (HEIC)' : ''}`);
    }
  }
  touch(); renderPhotos();
  msg(el, fails.join('\n'), fails.length ? 'err' : '');
}
async function photoURL(id) {
  if (photoURLs[id]) return photoURLs[id];
  const p = await DB.get('photos', id); if (!p) return '';
  return photoURLs[id] = URL.createObjectURL(p.blob);
}
async function renderPhotos() {
  const ul = $('#photos'); ul.innerHTML = '';
  if (cur.cover >= cur.photos.length) cur.cover = 0;
  for (let i = 0; i < cur.photos.length; i++) {
    const id = cur.photos[i]; const li = document.createElement('li'); if (i === cur.cover) li.className = 'cover';
    li.innerHTML = `<img alt="사진 ${i + 1}" src="${await photoURL(id)}">${i === cur.cover ? '<span class="tag">대표</span>' : ''}
      <div class="ctl"><button type="button" data-a="cover" aria-label="대표 사진으로">대표</button><button type="button" data-a="left" aria-label="앞으로" ${i === 0 ? 'disabled' : ''}>◀</button><button type="button" data-a="right" aria-label="뒤로" ${i === cur.photos.length - 1 ? 'disabled' : ''}>▶</button><button type="button" data-a="del" aria-label="삭제">삭제</button></div>`;
    li.querySelector('.ctl').addEventListener('click', e => { const a = e.target.dataset.a; if (a) photoAction(a, i); });
    ul.appendChild(li);
  }
  $('#uploadLabel').querySelector('.upload-sub').textContent = `${cur.photos.length} / ${MAX_PHOTOS}장 · 장당 30MB까지`;
}
function photoAction(a, i) {
  const p = cur.photos, coverId = p[cur.cover];
  if (a === 'cover') cur.cover = i;
  else if (a === 'left' && i > 0) [p[i - 1], p[i]] = [p[i], p[i - 1]];
  else if (a === 'right' && i < p.length - 1) [p[i + 1], p[i]] = [p[i], p[i + 1]];
  else if (a === 'del') { p.splice(i, 1); setTimeout(cleanPhotos, 0); }
  if (a !== 'cover') { const k = p.indexOf(coverId); cur.cover = k >= 0 ? k : 0; }
  touch(); renderPhotos();
}

/* ---------- 재료·영양 ---------- */
function renderIng() {
  const tb = $('#ingBody'); tb.innerHTML = '';
  cur.ingredients.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="text" list="ingList" aria-label="재료 이름" value="${esc(r.name)}" data-f="name" placeholder="재료"><span class="st"></span></td>
      <td><input type="number" inputmode="decimal" min="0" step="any" aria-label="양" value="${esc(r.amount)}" data-f="amount"></td>
      <td><select aria-label="단위" data-f="unit">${UNITS.map(u => `<option${u === r.unit ? ' selected' : ''}>${u}</option>`).join('')}</select></td>
      <td><button type="button" class="del" aria-label="재료 삭제">×</button></td>`;
    tr.addEventListener('input', e => { const f = e.target.dataset.f; if (f) { r[f] = e.target.value; touch(); renderNutri(); } });
    tr.querySelector('.del').addEventListener('click', () => { cur.ingredients.splice(i, 1); if (!cur.ingredients.length) cur.ingredients.push({ name: '', amount: '', unit: 'g' }); touch(); renderIng(); });
    tb.appendChild(tr);
  });
  renderNutri();
}
function renderNutri() {
  const c = calc(); const trs = $$('#ingBody tr');
  c.rows.forEach((r, i) => { const st = trs[i] && trs[i].querySelector('.st'); if (st) { st.textContent = r.st; st.className = 'st' + (r.miss ? ' miss' : ''); } });
  const has = c.used > 0;
  $('#nutri').innerHTML = `<div class="head"><strong>예상 영양 정보 · 먹은 양 ${fmt(c.eaten, 2)}인분${c.sv > 1 ? ` (레시피 ${c.sv}인분 중)` : ''}</strong>${c.missing ? `<span class="miss">계산에서 제외된 재료 ${c.missing}개</span>` : ''}</div>
   ${has ? `<div class="grid">
    <div><div class="k">열량</div><div class="v">약 ${fmt(c.ate.kcal)} kcal</div></div>
    <div><div class="k">탄수화물</div><div class="v">${fmt(c.ate.carb, 1)} g</div></div>
    <div><div class="k">단백질</div><div class="v">${fmt(c.ate.protein, 1)} g</div></div>
    <div><div class="k">지방</div><div class="v">${fmt(c.ate.fat, 1)} g</div></div>
    <div><div class="k">나트륨</div><div class="v">${fmt(c.ate.sodium)} mg</div></div>
    <div><div class="k">당류</div><div class="v">${fmt(c.ate.sugar, 1)} g</div></div></div>
    ${goalLine(c.ate)}
    <p class="small muted" style="margin:.4rem 0 0">${c.sv > 1 ? `전체 ${c.sv}인분 합계 약 ${fmt(c.tot.kcal)} kcal` : ''}${c.est ? ' · 개·큰술 등은 무게로 환산한 추정이에요' : ''}</p>` : '<p class="small muted" style="margin:0">재료와 양을 입력하면 계산돼요.</p>'}`;
  const seen = new Set(); $('#srcList').innerHTML = c.rows.filter(r => r.ing && !seen.has(r.ing.id) && seen.add(r.ing.id)).map(r =>
    `<p><b>${esc(r.ing.ko)}</b> — ${esc(r.ing.src.desc)} (USDA SR26 NDB ${esc(r.ing.src.ndb)}, 100g당 ${fmt(r.ing.per100.kcal)} kcal)</p>`).join('') || '<p>계산에 쓰인 재료가 아직 없어요.</p>';
  return c;
}
function goalLine(v) {
  const p = [];
  if (GOALS.kcal) p.push(`열량 ${fmt(v.kcal / GOALS.kcal * 100)}%`);
  if (GOALS.protein) p.push(`단백질 ${fmt(v.protein / GOALS.protein * 100)}%`);
  return p.length ? `<div class="goalbar">내 하루 목표의 ${p.join(' · ')}</div>` : '';
}
function findRecipes() {
  const k = norm(cur.title); const box = $('#recipeResults'); box.innerHTML = '';
  if (!k) { box.innerHTML = '<p class="msg err">먼저 메뉴 이름을 입력해 주세요.</p>'; return; }
  const score = r => { let best = 0; for (const x of r._keys) { if (x === k) best = Math.max(best, 100); else if (x.includes(k) || k.includes(x)) best = Math.max(best, 60 + Math.min(x.length, k.length)); else { let common = 0; for (const ch of new Set(k)) if (x.includes(ch)) common++; best = Math.max(best, common / Math.max(new Set(k).size, 1) * 40); } } return best; };
  const list = RECIPES.map(r => [score(r) + (r.diet ? 0.5 : 0), r]).filter(a => a[0] >= 30).sort((a, b) => b[0] - a[0]).slice(0, 5);
  if (!list.length) { box.innerHTML = '<p class="msg">맞는 참고 레시피가 없어요. 재료를 직접 입력해 주세요.</p>'; return; }
  list.forEach(([, r]) => {
    const b = document.createElement('button'); b.type = 'button'; b.innerHTML = `<b>${esc(r.name)}</b>${r.diet ? '<span class="badge diet">식단</span>' : ''} <span class="muted small">${r.servings}인분 · 재료 ${r.ingredients.length}개</span>`;
    b.addEventListener('click', () => applyRecipe(r)); box.appendChild(b);
  });
}
function applyRecipe(r) {
  const filled = cur.ingredients.some(x => x.name.trim()) || cur.steps.trim();
  if (filled && !confirm('입력한 재료와 만드는 법을 이 레시피로 바꿀까요?')) return;
  cur.servings = r.servings;
  cur.ingredients = r.ingredients.map(x => ({ name: x.id ? ING_BY_ID[x.id].ko : x.name, amount: String(x.g), unit: 'g' }));
  cur.steps = r.steps.join('\n'); cur.recipeDraft = true;
  if (!cur.title.trim()) cur.title = r.name;
  $('#recipeResults').innerHTML = ''; touch(); fillForm();
  toast('참고 레시피를 불러왔어요. 실제와 다르면 고쳐 주세요.');
}

/* ---------- 게시글 ---------- */
function tagPool() {
  const t = norm(cur.title); const pool = [];
  if (t) pool.push('#' + cur.title.replace(/\s/g, ''));
  const c = calc(); const main = c.rows.filter(r => r.ing && r.g).sort((a, b) => b.g - a.g).find(r => !['곡류', '양념', '기름'].includes(r.ing.cat));
  if (main) pool.push('#' + main.ing.ko.replace(/\(.*?\)/g, '').split('·')[0].replace(/\s/g, '') + '요리');
  pool.push('#집밥', '#오늘의한끼', '#홈쿡', '#레시피', '#집밥기록', '#요리기록');
  return [...new Set(['#다이어트식단', '#식단일기', ...pool.slice(0, 2), '#다이어트기록', `#${cur.meal}식단`, '#식단기록', ...pool.slice(2)])];
}
function renderTags() {
  const pool = [...new Set([...tagPool(), ...cur.tags, ...cur.tagPool])];
  if (!cur._tagsTouched) cur.tags = pool.slice(0, 3);
  $('#tagChips').innerHTML = pool.map(t => `<button type="button" class="${cur.tags.includes(t) ? 'on' : ''}" aria-pressed="${cur.tags.includes(t)}">${esc(t)}</button>`).join('');
  $('#tagCount').textContent = `${cur.tags.length} / ${MAX_TAGS}개 선택`;
}
function toggleTag(t) {
  cur._tagsTouched = true;
  if (cur.tags.includes(t)) cur.tags = cur.tags.filter(x => x !== t);
  else { if (cur.tags.length >= MAX_TAGS) return toast(`해시태그는 ${MAX_TAGS}개까지 고를 수 있어요.`); cur.tags.push(t); }
  touch(); renderTags();
}
function pickTip() {
  if (!TIPS.tips.length) return '';
  const k = [...(cur.id + cur.title)].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return TIPS.tips[k % TIPS.tips.length];
}
function buildPost() {
  const c = calc(); const name = cur.title.trim() || '오늘의 한 끼'; const L = [];
  const d = cur.date ? new Date(cur.date + 'T00:00') : new Date(); const md = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  const open = { diet: `${md} ${cur.meal} 식단 기록 · ${name}`, plain: `오늘의 한 끼, ${name}.`, friendly: `오늘은 ${name} 만들어 먹었어요!`, info: `[${name}] ${c.sv}인분 기록` }[cur.tone];
  L.push(open);
  if (cur.tone === 'friendly') L.push('집에 있는 재료로 편하게 만들었어요.');
  const ings = cur.ingredients.filter(r => r.name.trim());
  if (cur.inc.ing && ings.length) { L.push('', `재료 (${c.sv}인분)`); ings.forEach(r => L.push(`- ${r.name.trim()}${r.amount ? ' ' + r.amount + r.unit : ''}`)); }
  const steps = cur.steps.split('\n').map(s => s.trim()).filter(Boolean);
  if (cur.inc.steps && steps.length) { L.push('', '만드는 법'); steps.forEach((s, i) => L.push(`${i + 1}. ${s.replace(/^\d+[.)]\s*/, '')}`)); }
  if (cur.inc.nutri && c.used) {
    L.push('', `예상 영양 정보 (먹은 양 ${fmt(c.eaten, 2)}인분, 입력한 재료로 계산한 추정값)`);
    L.push(`열량 약 ${fmt(c.ate.kcal)}kcal · 탄수화물 ${fmt(c.ate.carb)}g · 단백질 ${fmt(c.ate.protein)}g · 지방 ${fmt(c.ate.fat)}g`);
    if (c.missing) L.push(`※ 재료 ${c.missing}개는 계산에서 빠졌어요.`);
  }
  if (cur.inc.tip) { const t = pickTip(); if (t) L.push('', t); }
  if (cur.tone === 'friendly') L.push('', '맛있게 잘 먹었습니다.');
  if (cur.tags.length) L.push('', cur.tags.slice(0, MAX_TAGS).join(' '));
  return L.join('\n');
}
function countChars() {
  const n = [...cur.post].length; const el = $('#charCount');
  el.textContent = `${fmt(n)} / 2,200자`; el.style.color = n > MAX_CAPTION ? 'var(--danger)' : '';
  const tags = (cur.post.match(/#[^\s#]+/g) || []).length;
  msg($('#postMsg'), n > MAX_CAPTION ? '인스타그램 글자 수(2,200자)를 넘었어요.' : tags > MAX_TAGS ? `해시태그가 ${tags}개예요. 인스타그램은 ${MAX_TAGS}개까지예요.` : '', (n > MAX_CAPTION || tags > MAX_TAGS) ? 'err' : '');
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, t.length); let ok = false; try { ok = document.execCommand('copy'); } catch (_) { } ta.remove(); if (!ok) logErr('copy', e); return ok;
  }
}
async function savePhotos() {
  if (!cur.photos.length) return toast('저장할 사진이 없어요.');
  const order = [cur.photos[cur.cover], ...cur.photos.filter((_, i) => i !== cur.cover)];
  const base = (cur.title.trim() || '한끼로그').replace(/[\\/:*?"<>|\s]+/g, '_');
  const files = []; for (let i = 0; i < order.length; i++) { const p = await DB.get('photos', order[i]); if (p) files.push(new File([p.blob], `${base}_${String(i + 1).padStart(2, '0')}.jpg`, { type: 'image/jpeg' })); }
  if (navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ files }); return; } catch (e) { if (e.name === 'AbortError') return; logErr('share', e); }
  }
  for (const f of files) { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); await new Promise(r => setTimeout(r, 300)); }
  toast(`사진 ${files.length}장을 내려받았어요.`);
}

/* ---------- 저장·보관함 ---------- */
async function cleanPhotos() {
  // 어떤 콘텐츠에도 쓰이지 않는 사진을 지운다(편집 중인 콘텐츠의 사진은 남긴다).
  try {
    const used = new Set(cur.photos); (await DB.all('entries')).forEach(e => e.photos.forEach(id => used.add(id)));
    for (const p of await DB.all('photos')) if (!used.has(p.id)) { await DB.del('photos', p.id); if (photoURLs[p.id]) { URL.revokeObjectURL(photoURLs[p.id]); delete photoURLs[p.id]; } }
  } catch (e) { logErr('clean', e); }
}
function touch() { dirty = true; cur.updated = Date.now(); $('#savedState').textContent = '저장 안 됨'; }
function snapshot() { const { _tagsTouched, ...e } = cur; return JSON.parse(JSON.stringify(e)); }
async function saveEntry(quiet) {
  if (cur.example) { toast('예시는 보관함에 저장하지 않아요.'); return false; }
  if (!cur.title.trim() && !cur.photos.length) { toast('메뉴 이름이나 사진을 먼저 넣어 주세요.'); return false; }
  try { await DB.put('entries', snapshot()); dirty = false; $('#savedState').textContent = '저장됨'; cleanPhotos(); if (!quiet) toast('보관함에 저장했어요.'); return true; }
  catch (e) { logErr('save', e); toast('저장하지 못했어요. 저장 공간을 확인해 주세요.'); return false; }
}
async function renderLibrary() {
  const mo = m => { const i = MEALS.indexOf(m); return i < 0 ? 9 : i; };
  const list = (await DB.all('entries')).sort((a, b) => (b.date || '').localeCompare(a.date || '') || mo(a.meal) - mo(b.meal) || a.created - b.created);
  const ul = $('#libList'); ul.innerHTML = ''; $('#libEmpty').hidden = list.length > 0;
  const days = {}; for (const e of list) (days[e.date || '날짜 없음'] = days[e.date || '날짜 없음'] || []).push(e);
  for (const [day, es] of Object.entries(days)) {
    const sum = { kcal: 0, carb: 0, protein: 0, fat: 0 }; let miss = 0;
    for (const e of es) { const c = calc(e); for (const k in sum) sum[k] += c.ate[k]; miss += c.missing; }
    const dd = day.includes('-') ? new Date(day + 'T00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) : day;
    const h = document.createElement('li'); h.className = 'day';
    h.innerHTML = `<b>${esc(dd)} · ${es.length}끼</b><span>하루 합계 약 ${fmt(sum.kcal)}kcal · 탄 ${fmt(sum.carb)}g · 단 ${fmt(sum.protein)}g · 지 ${fmt(sum.fat)}g${GOALS.kcal ? ` · 목표 열량의 ${fmt(sum.kcal / GOALS.kcal * 100)}%` : ''}${GOALS.protein ? ` · 목표 단백질의 ${fmt(sum.protein / GOALS.protein * 100)}%` : ''}${miss ? ` · 제외된 재료 ${miss}개` : ''}</span>`;
    ul.appendChild(h);
  for (const e of es) {
    const li = document.createElement('li'); const pid = e.photos[e.cover] || e.photos[0];
    const img = pid ? `<img alt="" src="${await photoURL(pid)}">` : '<div class="noimg">사진 없음</div>';
    li.innerHTML = `${img}<div class="body"><div class="name">${e.meal ? `<span class="badge meal">${esc(e.meal)}</span> ` : ''}${esc(e.title || '이름 없음')}</div><div class="muted small">약 ${fmt(calc(e).ate.kcal)}kcal · 사진 ${e.photos.length}장</div></div>
      <div class="ctl"><button type="button" data-a="open">열기</button><button type="button" data-a="dup">복제</button><button type="button" data-a="del" class="d">삭제</button></div>`;
    li.querySelector('.ctl').addEventListener('click', ev => libAction(ev.target.dataset.a, e));
    ul.appendChild(li);
  }
  }
  await renderLibInfo();
}
async function libAction(a, e) {
  if (a === 'open') { if (dirty && !confirm('지금 작업 중인 내용이 저장되지 않았어요. 열까요?')) return; cur = e; dirty = false; fillForm(); setView('make'); setStep(3); $('#savedState').textContent = '저장됨'; }
  if (a === 'dup') {
    const n = JSON.parse(JSON.stringify(e)); n.id = uid(); n.title = (e.title || '이름 없음') + ' (복사본)'; n.date = today(); n.meal = guessMeal(); n.created = n.updated = Date.now(); n.photos = [];
    for (const pid of e.photos) { const p = await DB.get('photos', pid); if (p) { const id = uid(); await DB.put('photos', { ...p, id }); n.photos.push(id); } }
    await DB.put('entries', n); toast('복제했어요.'); renderLibrary();
  }
  if (a === 'del') {
    if (!confirm(`‘${e.title || '이름 없음'}’을(를) 삭제할까요? 되돌릴 수 없어요.`)) return;
    await DB.del('entries', e.id); for (const pid of e.photos) { await DB.del('photos', pid); if (photoURLs[pid]) { URL.revokeObjectURL(photoURLs[pid]); delete photoURLs[pid]; } }
    if (cur.id === e.id) { cur = blankEntry(); fillForm(); }
    toast('삭제했어요.'); renderLibrary();
  }
}
function isIOS() { return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function standalone() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
async function backupDays() { const t = await DB.meta('lastBackup'); return t ? Math.floor((Date.now() - t) / 86400000) : null; }
async function renderLibInfo() {
  const box = $('#libInfo'); const d = await backupDays(); const n = (await DB.all('entries')).length; const parts = [];
  if (n) parts.push(`<div class="note">${d == null ? '아직 백업한 적이 없어요.' : `마지막 백업 후 ${d}일`}${(d == null || d >= 14) ? ' · <b>설정·백업에서 백업해 주세요.</b>' : ''}</div>`);
  if (isIOS() && !standalone()) parts.push('<div class="note">아이폰에서는 Safari 공유 버튼 → ‘홈 화면에 추가’로 설치하면 더 안정적으로 보관돼요.</div>');
  box.innerHTML = parts.join('');
}
async function updateBackupBar() {
  const n = (await DB.all('entries')).length; const d = await backupDays(); const bar = $('#backupBar');
  if (n && (d == null ? n >= 3 : d >= 14)) { bar.innerHTML = `${d == null ? '아직 백업한 적이 없어요.' : `마지막 백업 후 ${d}일이 지났어요.`} <button type="button" class="btn small ghost" id="goBackup">백업하기</button>`; bar.hidden = false; $('#goBackup').onclick = () => setView('settings'); }
  else bar.hidden = true;
}

/* ---------- 백업 ---------- */
const b64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
async function backupSize() { const ps = await DB.all('photos'); const es = await DB.all('entries'); const bytes = ps.reduce((a, p) => a + p.blob.size, 0) * 4 / 3 + JSON.stringify(es).length; return { bytes, n: es.length, p: ps.length }; }
const mb = b => (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + 'MB';
async function exportBackup() {
  const el = $('#backupMsg'); msg(el, '백업 파일을 만드는 중…');
  try {
    const entries = await DB.all('entries'); const need = new Set(entries.flatMap(e => e.photos)); const photos = [];
    for (const id of need) { const p = await DB.get('photos', id); if (p) photos.push({ id, w: p.w, h: p.h, type: p.blob.type, data: await b64(p.blob) }); }
    const json = JSON.stringify({ app: 'hankki-log', format: 1, version: VERSION, exported: new Date().toISOString(), goals: GOALS, entries, photos });
    const blob = new Blob([json], { type: 'application/json' }); const d = new Date();
    const name = `hankki-log-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    const file = new File([blob], name, { type: 'application/json' });
    let done = false;
    if (isIOS() && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); done = true; } catch (e) { if (e.name === 'AbortError') return msg(el, '취소했어요.'); logErr('shareBackup', e); } }
    if (!done) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
    await DB.meta('lastBackup', Date.now());
    msg(el, `백업 파일을 만들었어요 (${mb(blob.size)}, 콘텐츠 ${entries.length}개). 파일을 안전한 곳에 보관해 주세요.`, 'ok'); updateBackupBar();
  } catch (e) { logErr('export', e); msg(el, '백업 파일을 만들지 못했어요. 오류 정보를 복사해 관리자에게 보내 주세요.', 'err'); }
}
async function importBackup(file) {
  const el = $('#backupMsg');
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'hankki-log' || !Array.isArray(data.entries)) throw new Error('형식이 달라요');
    if (!confirm(`백업의 콘텐츠 ${data.entries.length}개를 가져올까요? 같은 콘텐츠가 있으면 백업 내용으로 바뀌어요.`)) return;
    msg(el, '가져오는 중…');
    for (const p of data.photos || []) { const bin = Uint8Array.from(atob(p.data), c => c.charCodeAt(0)); await DB.put('photos', { id: p.id, w: p.w, h: p.h, blob: new Blob([bin], { type: p.type || 'image/jpeg' }) }); }
    for (const e of data.entries) await DB.put('entries', e);
    if (data.goals && (data.goals.kcal || data.goals.protein) && !(GOALS.kcal || GOALS.protein)) { GOALS = data.goals; await DB.meta('goals', GOALS); }
    msg(el, `콘텐츠 ${data.entries.length}개, 사진 ${(data.photos || []).length}장을 가져왔어요.`, 'ok'); renderSettings();
  } catch (e) { logErr('import', e); msg(el, '이 파일은 가져올 수 없어요. 한끼로그에서 내보낸 백업 파일인지 확인해 주세요.', 'err'); }
}

/* ---------- 설정 ---------- */
async function renderSettings() {
  $('#ver').textContent = VERSION; $('#goalKcal').value = GOALS.kcal || ''; $('#goalProtein').value = GOALS.protein || '';
  const s = await backupSize(); $('#backupSize').textContent = `예상 백업 파일 크기 약 ${mb(s.bytes)} (콘텐츠 ${s.n}개, 사진 ${s.p}장)`;
  let t = '';
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); t += `사용 ${mb(e.usage || 0)}${e.quota ? ` / 사용 가능 약 ${mb(e.quota)}` : ''}. `; } } catch (e) { }
  try { if (navigator.storage && navigator.storage.persisted) t += (await navigator.storage.persisted()) ? '‘지우지 않기’ 저장이 허용됐어요.' : '‘지우지 않기’ 저장이 아직 허용되지 않았어요.'; else t += '이 브라우저는 ‘지우지 않기’ 저장 요청을 지원하지 않아요.'; } catch (e) { }
  $('#storageInfo').textContent = t;
}
async function diagText() {
  const s = await backupSize().catch(() => ({}));
  let persisted = 'unknown'; try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : 'unsupported'; } catch (e) { }
  return ['[한끼로그 오류 정보]', `버전: ${VERSION} / 자료 ${DATA_VER}`, `시간: ${new Date().toISOString()}`, `브라우저: ${navigator.userAgent}`, `화면: ${innerWidth}x${innerHeight} @${devicePixelRatio}`, `홈 화면 실행: ${standalone()}`, `저장: 콘텐츠 ${s.n}개, 사진 ${s.p}장, persisted=${persisted}`,
    `기능: share=${!!navigator.share}, canShareFiles=${!!(navigator.canShare)}, createImageBitmap=${'createImageBitmap' in window}, VideoEncoder=${'VideoEncoder' in window}, MediaRecorder=${'MediaRecorder' in window}`,
    `최근 오류 ${errors.length}건:`, ...errors.map(e => `- ${e.t} [${e.where}] ${e.msg}`)].join('\n');
}

/* ---------- 폼 채우기 ---------- */
function fillForm() {
  cur.date = cur.date || today(); cur.meal = cur.meal || guessMeal(); cur.eaten = cur.eaten || 1;
  $('#mealDate').value = cur.date; $('#eaten').value = cur.eaten; $$('#mealChips button').forEach(b => b.classList.toggle('on', b.dataset.meal === cur.meal));
  $('#title').value = cur.title; $('#servings').value = cur.servings; $('#stepsText').value = cur.steps; $('#postText').value = cur.post;
  $('#exampleBadge').hidden = !cur.example; $('#draftBadge').hidden = !cur.recipeDraft;
  $$('#toneChips button').forEach(b => b.classList.toggle('on', b.dataset.tone === cur.tone));
  $('#incIng').checked = cur.inc.ing; $('#incSteps').checked = cur.inc.steps; $('#incNutri').checked = cur.inc.nutri; $('#incTip').checked = cur.inc.tip;
  cur._tagsTouched = cur.tags.length > 0;
  renderPhotos(); renderIng(); renderTags(); countChars();
}
function loadExample() {
  if (dirty && !confirm('지금 작업 중인 내용이 저장되지 않았어요. 예시를 열까요?')) return;
  const r = RECIPES.find(x => x.name === '닭가슴살 샐러드볼') || RECIPES[0];
  cur = blankEntry(); cur.example = true; cur.title = r.name; cur.servings = r.servings; cur.recipeDraft = true;
  cur.ingredients = r.ingredients.map(x => ({ name: x.id ? ING_BY_ID[x.id].ko : x.name, amount: String(x.g), unit: 'g' })); cur.steps = r.steps.join('\n');
  dirty = false; fillForm(); cur.post = buildPost(); $('#postText').value = cur.post; countChars(); setStep(2);
  toast('예시 콘텐츠예요. 사진은 직접 올려 보세요.');
}

/* ---------- 이벤트 ---------- */
function bind() {
  $$('.nav button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $$('.steps button').forEach(b => b.addEventListener('click', () => setStep(b.dataset.step)));
  $$('[data-go]').forEach(b => b.addEventListener('click', () => setStep(b.dataset.go)));
  $('#fileInput').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
  $('#mealDate').addEventListener('change', e => { cur.date = e.target.value || today(); touch(); });
  $('#mealChips').addEventListener('click', e => { const m = e.target.dataset.meal; if (!m) return; cur.meal = m; $$('#mealChips button').forEach(b => b.classList.toggle('on', b === e.target)); touch(); renderTags(); });
  $('#eaten').addEventListener('input', e => { const v = parseFloat(e.target.value); cur.eaten = v > 0 ? Math.min(10, v) : 1; touch(); renderNutri(); });
  $('#saveGoals').addEventListener('click', async () => {
    const k = parseFloat($('#goalKcal').value), p = parseFloat($('#goalProtein').value);
    GOALS = { kcal: k > 0 ? Math.round(k) : null, protein: p > 0 ? Math.round(p) : null };
    try { await DB.meta('goals', GOALS); msg($('#goalMsg'), GOALS.kcal || GOALS.protein ? '목표를 저장했어요.' : '목표를 지웠어요.', 'ok'); renderNutri(); } catch (e) { logErr('goals', e); msg($('#goalMsg'), '저장하지 못했어요.', 'err'); }
  });
  $('#title').addEventListener('input', e => { cur.title = e.target.value; touch(); renderTags(); });
  $('#servings').addEventListener('input', e => { cur.servings = Math.min(20, Math.max(1, parseInt(e.target.value) || 1)); touch(); renderNutri(); });
  $('#stepsText').addEventListener('input', e => { cur.steps = e.target.value; touch(); });
  $('#addIng').addEventListener('click', () => { cur.ingredients.push({ name: '', amount: '', unit: 'g' }); touch(); renderIng(); const ins = $$('#ingBody input[data-f=name]'); ins[ins.length - 1].focus(); });
  $('#findRecipe').addEventListener('click', findRecipes);
  $('#exampleBtn').addEventListener('click', loadExample);
  $('#tabPost').addEventListener('click', () => { $('#tabPost').classList.add('on'); $('#tabReel').classList.remove('on'); $('#panePost').hidden = false; $('#paneReel').hidden = true; $('#tabPost').setAttribute('aria-selected', 'true'); $('#tabReel').setAttribute('aria-selected', 'false'); });
  $('#tabReel').addEventListener('click', () => { $('#tabReel').classList.add('on'); $('#tabPost').classList.remove('on'); $('#panePost').hidden = true; $('#paneReel').hidden = false; $('#tabReel').setAttribute('aria-selected', 'true'); $('#tabPost').setAttribute('aria-selected', 'false'); });
  $('#toneChips').addEventListener('click', e => { const t = e.target.dataset.tone; if (!t) return; cur.tone = t; $$('#toneChips button').forEach(b => b.classList.toggle('on', b === e.target)); touch(); });
  [['incIng', 'ing'], ['incSteps', 'steps'], ['incNutri', 'nutri'], ['incTip', 'tip']].forEach(([id, k]) => $('#' + id).addEventListener('change', e => { cur.inc[k] = e.target.checked; touch(); }));
  $('#tagChips').addEventListener('click', e => { if (e.target.tagName === 'BUTTON') toggleTag(e.target.textContent); });
  const addTag = () => { let v = $('#tagInput').value.trim().replace(/\s+/g, ''); if (!v) return; if (!v.startsWith('#')) v = '#' + v; v = '#' + v.replace(/#/g, ''); if (v.length < 2) return; if (!cur.tagPool.includes(v)) cur.tagPool.push(v); $('#tagInput').value = ''; if (!cur.tags.includes(v)) toggleTag(v); else renderTags(); };
  $('#tagAdd').addEventListener('click', addTag); $('#tagInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } });
  $('#genPost').addEventListener('click', () => { if (cur.post.trim() && !confirm('직접 고친 글이 있으면 새 글로 바뀌어요. 계속할까요?')) return; cur.post = buildPost(); $('#postText').value = cur.post; touch(); countChars(); });
  $('#postText').addEventListener('input', e => { cur.post = e.target.value; touch(); countChars(); });
  $('#copyPost').addEventListener('click', async () => { if (!cur.post.trim()) return toast('먼저 게시글을 만들어 주세요.'); toast(await copyText(cur.post) ? '게시글을 복사했어요.' : '복사하지 못했어요. 글을 길게 눌러 직접 복사해 주세요.'); });
  $('#savePhotos').addEventListener('click', savePhotos);
  $('#saveEntry').addEventListener('click', () => saveEntry());
  $('#exportBtn').addEventListener('click', exportBackup);
  $('#importInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBackup(f); });
  $('#copyDiag').addEventListener('click', async () => { msg($('#diagMsg'), await copyText(await diagText()) ? '오류 정보를 복사했어요. 메시지 앱에 붙여 넣어 보내 주세요.' : '복사하지 못했어요.', 'ok'); });
  $('#wipeBtn').addEventListener('click', async () => { if (!confirm('이 기기에 저장된 콘텐츠와 사진을 모두 지울까요? 되돌릴 수 없어요.')) return; await DB.clear('entries'); await DB.clear('photos'); cur = blankEntry(); photoURLs = {}; dirty = false; fillForm(); toast('모두 지웠어요.'); renderSettings(); updateBackupBar(); });
  window.addEventListener('beforeunload', e => { if (dirty && !cur.example) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && dirty && !cur.example && (cur.title.trim() || cur.photos.length)) saveEntry(true); });
}
function checkSupport() {
  const ok = [];
  ok.push('VideoEncoder' in window ? 'WebCodecs 있음' : 'WebCodecs 없음');
  ok.push('MediaRecorder' in window ? 'MediaRecorder 있음' : 'MediaRecorder 없음');
  $('#reelSupport').textContent = '이 기기 확인 결과(참고): ' + ok.join(' · ');
  $('#tipState').textContent = TIPS.approved ? '' : '(문구 승인 전 초안)';
}

/* ---------- 서비스 워커(오프라인·새 버전 안내) ---------- */
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const show = w => { $('#updateBar').hidden = false; $('#applyUpdate').onclick = () => w.postMessage('skip'); };
    if (reg.waiting && navigator.serviceWorker.controller) show(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) show(w); }); });
    setInterval(() => reg.update().catch(() => { }), 60 * 60 * 1000);
  }).catch(e => logErr('sw', e));
  // 처음 설치될 때는 다시 읽지 않는다. ‘적용’을 눌러 새 버전으로 바뀔 때만 다시 읽는다.
  const hadController = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}

(async function init() {
  bind(); setStep(1);
  try { await DB.open(); } catch (e) { logErr('db', e); toast('이 브라우저에서는 저장 기능을 쓸 수 없어요(개인정보 보호 모드인지 확인해 주세요).'); }
  try { await loadData(); } catch (e) { logErr('data', e); toast('재료 자료를 불러오지 못했어요. 인터넷 연결 후 다시 열어 주세요.'); }
  try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) { }
  try { if (DB.db) GOALS = (await DB.meta('goals')) || GOALS; } catch (e) { }
  checkSupport(); fillForm(); registerSW();
  if (DB.db) { updateBackupBar(); cleanPhotos(); }
})();
