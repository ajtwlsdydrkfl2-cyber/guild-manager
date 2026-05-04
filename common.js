// ========== GUILD MANAGER v2 - common.js ==========

// ===== 기본 설정 =====
const DEFAULT_CONFIG = {
  superAdminPw: 'super1234',
  servers: [
    {id:1, name:'1서버', memberPw:'1111', adminPw:'admin1'},
    {id:2, name:'2서버', memberPw:'2222', adminPw:'admin2'},
    {id:3, name:'3서버', memberPw:'3333', adminPw:'admin3'},
    {id:4, name:'4서버', memberPw:'4444', adminPw:'admin4'},
    {id:5, name:'5서버', memberPw:'5555', adminPw:'admin5'},
  ]
};

function getConfig() {
  const s = localStorage.getItem('gm_config');
  if (!s) { localStorage.setItem('gm_config', JSON.stringify(DEFAULT_CONFIG)); return DEFAULT_CONFIG; }
  return JSON.parse(s);
}
function saveConfig(cfg) { localStorage.setItem('gm_config', JSON.stringify(cfg)); }

// ===== 세션 =====
function getSession() {
  const s = sessionStorage.getItem('gm_session');
  return s ? JSON.parse(s) : null;
}
function setSession(data) { sessionStorage.setItem('gm_session', JSON.stringify(data)); }
function clearSession() { sessionStorage.removeItem('gm_session'); }
function isAdmin() { const s=getSession(); return s && (s.role==='admin'||s.role==='super'); }
function isSuperAdmin() { const s=getSession(); return s && s.role==='super'; }

function requireLogin() {
  const s = getSession();
  if (!s) { location.href='index.html'; return null; }
  return s;
}
function doLogout() { clearSession(); location.href='index.html'; }

// ===== 서버별 데이터 =====
function sk(key) {
  const s = getSession();
  const sid = s ? s.serverId : 0;
  return `s${sid}_${key}`;
}
function getData(key, def=null) {
  const v = localStorage.getItem(sk(key));
  if (v===null) return def;
  try { return JSON.parse(v); } catch { return def; }
}
function setData(key, val) { localStorage.setItem(sk(key), JSON.stringify(val)); }

function getDataS(sid, key, def=null) {
  const v = localStorage.getItem(`s${sid}_${key}`);
  if (v===null) return def;
  try { return JSON.parse(v); } catch { return def; }
}
function setDataS(sid, key, val) { localStorage.setItem(`s${sid}_${key}`, JSON.stringify(val)); }

// ===== 서버 이름 =====
function getServerName() {
  const s = getSession();
  if (!s) return '길드';
  if (s.role==='super') return '총관리자';
  // Firebase config에서 최신 이름 읽기
  const cfg = getConfig();
  const sv = cfg.servers.find(x=>x.id===s.serverId);
  return sv ? sv.name : '길드';
}

// Firebase config 변경 감지해서 사이드바 이름 업데이트
function watchServerName() {
  if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
  const sess = getSession();
  if (!sess) return;
  firebaseDB.ref('config').on('value', snap => {
    const cfg = snap.val();
    if (!cfg) return;
    // localStorage 업데이트
    localStorage.setItem('gm_config', JSON.stringify(cfg));
    // 사이드바 이름 업데이트
    const sv = cfg.servers.find(x=>x.id===sess.serverId);
    const name = sv ? sv.name : '길드';
    const el = document.getElementById('sideServerName');
    if (el) el.textContent = name;
    // 세션도 업데이트
    if (sv) {
      sess.serverName = sv.name;
      setSession(sess);
    }
  });
}

// ===== 주간 키 (일요일 23:59 초기화) =====
function getWeekKey() {
  const now = new Date();
  const day = now.getDay();
  const h = now.getHours(), m = now.getMinutes();
  let monday = new Date(now);
  let diff;
  if (day===0 && (h<23||(h===23&&m<59))) diff=-6;
  else if (day===0) diff=1;
  else diff=1-day;
  monday.setDate(now.getDate()+diff);
  return `${monday.getFullYear()}${String(monday.getMonth()+1).padStart(2,'0')}${String(monday.getDate()).padStart(2,'0')}`;
}

// ===== 새벽 보너스 =====
function isNightBonus() { const h=new Date().getHours(); return h>=0&&h<7; }

// ===== 포인트 계산 =====
function calcPoints(memberId) {
  const wk = getWeekKey();
  const attend = getData('attend', {});
  const bosses = getData('bosses', DEFAULT_BOSSES);
  const wkData = attend[wk]||{};
  let total = 0;
  for (const bname in wkData) {
    for (const rKey in wkData[bname]) {
      const r = wkData[bname][rKey];
      const boss = bosses.find(b=>b.name===bname);
      const pts = boss ? boss.pts : 1;
      const bonus = r.nightBonus ? 1.2 : 1.0;
      const st = r.attendance?.[memberId];
      if (st==='참여') total += pts*bonus;
      else if (st==='늦참') total += pts*0.5*bonus;
    }
  }
  return Math.round(total*10)/10;
}

// ===== 참여율 계산 =====
function calcRate(memberId) {
  const wk = getWeekKey();
  const attend = getData('attend', {});
  const wkData = attend[wk]||{};
  let total=0, joined=0;
  for (const bname in wkData) {
    for (const rKey in wkData[bname]) {
      total++;
      const st = wkData[bname][rKey].attendance?.[memberId];
      if (st==='참여'||st==='늦참') joined++;
    }
  }
  return total>0 ? Math.round((joined/total)*1000)/10 : 0;
}

// ===== 멤버 통계 =====
function getMemberStats() {
  const members = getData('members', []);
  return members.map(m => ({
    ...m,
    pts: calcPoints(m.id),
    rate: calcRate(m.id)
  })).sort((a,b)=>b.pts-a.pts||b.rate-a.rate);
}

// ===== 날짜 포맷 =====
function fmtDT(ts) {
  const d=new Date(ts);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ===== 토스트 =====
function showToast(msg, type='', dur=2500) {
  let el = document.getElementById('gToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'gToast';
    el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%) translateY(-80px);background:#0e1520;border:1px solid #1e2d45;border-radius:10px;padding:11px 22px;font-size:13px;font-weight:500;z-index:9999;transition:transform .3s;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.5);color:#e2e8f0;font-family:"Noto Sans KR",sans-serif;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  if (type==='success') { el.style.borderColor='#22c55e'; el.style.color='#22c55e'; }
  else if (type==='error') { el.style.borderColor='#ef4444'; el.style.color='#ef4444'; }
  else { el.style.borderColor='#1e2d45'; el.style.color='#e2e8f0'; }
  el.style.transform = 'translateX(-50%) translateY(0)';
  setTimeout(()=>{ el.style.transform='translateX(-50%) translateY(-80px)'; }, dur);
}

// ===== 푸시 알림 =====
function sendPush(title, body) {
  if (Notification.permission==='granted') {
    new Notification(title, {body, icon:'https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/2694.png'});
  }
}

// ===== 보스 기본 데이터 =====
const DEFAULT_BOSSES = [
  {name:'가레스',pts:1,records:['영혼','메이스']},
  {name:'네루카스',pts:2,records:['심장','뿔']},

  {name:'네스트라',pts:2,records:['심장','날개']},
  {name:'네우트로',pts:2,records:['심장','등껍질']},
  {name:'달리아',pts:1,records:['심장','투구']},
  {name:'두멘타',pts:2,records:['영혼','깃털']},
  {name:'듀플리칸',pts:1,records:['영혼','검']},
  {name:'라르바',pts:1,records:['영혼','정수']},
  {name:'라카제스',pts:2,records:['영혼','척추']},
  {name:'로데릭',pts:2,records:['영혼','갑옷']},
  {name:'링고르',pts:2,records:['심장','발톱']},
  {name:'리베라',pts:1,records:['심장','펜던트']},
  {name:'리비티나',pts:2,records:['심장','날개']},
  {name:'밀라베',pts:2,records:['심장','집게']},
  {name:'남작',pts:1,records:['심장','마검']},
  {name:'메투스',pts:1,records:['영혼','마갑']},
  {name:'모티',pts:3,records:['얼음 조각','천 조각']},
  {name:'바헬',pts:2,records:['심장','뼈조각','발톱']},
  {name:'벤지',pts:2,records:['심장','혈액']},
  {name:'사피루스',pts:2,records:['심장','팬던트']},
  {name:'샤이프락',pts:2,records:['심장','벨트']},
  {name:'세크레타',pts:1,records:['심장','뿔']},
  {name:'수포르',pts:1,records:['심장','지팡이']},
  {name:'슈라이어',pts:1,records:['심장','장갑']},
  {name:'아라네오',pts:1,records:['심장','독샘']},
  {name:'아멘티스',pts:1,records:['심장','발']},
  {name:'아스타',pts:1,records:['심장','벨트']},
  {name:'아우라크',pts:2,records:['심장','세포']},
  {name:'알시',pts:3,records:['얼음 조각','천 조각']},
  {name:'에고',pts:1,records:['심장','꼬리']},
  {name:'언두미엘',pts:1,records:['심장','쇠사슬']},
  {name:'오르도',pts:1,records:['심장','투구']},
  {name:'와니타스',pts:1,records:['영혼','검자루']},
  {name:'익시온',pts:3,records:['뿔','검파편']},
  {name:'이카루시아',pts:3,records:['얼음 조각','천 조각']},
  {name:'장군 아쿨레우스',pts:1,records:['심장','다리']},
  {name:'카말리아',pts:2,records:['심장','날개']},
  {name:'카테나',pts:1,records:['영혼','파편']},
  {name:'클레멘티스',pts:2,records:['심장','뿔']},
  {name:'투미어',pts:2,records:['심장','두건']},
  {name:'튀멜레',pts:2,records:['심장','등불']},
  {name:'티토르',pts:1,records:['심장','외피']},
  {name:'포가르',pts:3,records:['심장','세포']},
  {name:'헬레나',pts:2,records:['심장','날개']},
  {name:'루쿠스',pts:3,records:['루쿠스의 핵','루쿠스의 오른팔','루쿠스의 왼팔']},
];

// ===== 필수 장비 =====
const REQUIRED_ITEMS = [
  {name:'크란시아',sub:'목걸이'},
  {name:'검은가시',sub:'귀걸이'},
  {name:'검은 오르의',sub:'목걸이'},
  {name:'검은 오르의',sub:'귀걸이'},
  {name:'붉은 태양의',sub:'목걸이'},
  {name:'붉은 태양의',sub:'귀걸이'},
  {name:'붉은 태양의',sub:'허리띠'},
  {name:'계승자의',sub:'목걸이'},
  {name:'계승자의',sub:'귀걸이'},
  {name:'계승자의',sub:'반지'},
  {name:'계승자의',sub:'팔찌'},
  {name:'계승자의',sub:'허리띠'},
];

// ===== 이동석 설정 =====
const STONE_LIST = [
  {name:'실험실', max:5},
  {name:'티리오사무덤', max:7},
  {name:'죽은자의대지', max:7},
];

// ===== 직업 목록 =====
const JOB_LIST = {
  hidden: ['디스트로이어','혹한의기사','고대수호자','축복의여신','폭풍의인도자','대부호','공포의군주','미스트로어','뇌신'],
  normal: ['크루세이더','바스티온','세레니티','데몬','다크나이트','파이어로드','디펜드소서러','거울방패조'],
};

// ===== 다이아 등급 =====
const DEFAULT_GRADES = [
  {g:1,label:'1등급',ratio:1.4},
  {g:2,label:'2등급',ratio:1.3},
  {g:3,label:'3등급',ratio:1.0},
  {g:4,label:'4등급',ratio:0.8},
  {g:5,label:'5등급 (20%미만)',ratio:0},
  {g:6,label:'6등급 (10%미만)',ratio:0},
];

// ===== 사이드바 렌더 =====
function renderSidebar(activePage) {
  const sess = getSession();
  const sname = getServerName();
  const admin = isAdmin();

  const onDash = activePage==='dashboard'||activePage==='boss';
  const pages = [
    {id:'dashboard', label:'대시보드', icon:'🏠', href:'dashboard.html', oc:''},
    {id:'boss', label:'보스 포인트', icon:'⚔️', href:'#', oc:onDash?"switchTab('boss',document.querySelector('.tab:nth-child(2)'));closeSb();return false;":"location.href='dashboard.html?tab=boss';return false;"},
    {id:'equipment', label:'장비 기록', icon:'🛡️', href:'equipment.html', oc:''},
    {id:'items', label:'아이템 분배', icon:'📦', href:'items.html', oc:''},
    {id:'guide', label:'사용 설명서', icon:'📖', href:'guide.html', oc:''},
  ];
  if (admin) pages.push({id:'admin', label:'관리자', icon:'⚙️', href:'admin.html', oc:''});

  const el = document.getElementById('sidebar');
  if (!el) return;
  el.innerHTML = `
    <div class="sb-header">
      <div class="sb-logo">⚔️ <span>${sname}</span></div>
      <div class="sb-sub">GUILD MANAGER</div>
      <div class="sb-role">${sess?.role==='super'?'🔓 총관리자':admin?'🔑 서버관리자':'👤 길드원'}</div>
    </div>
    <nav class="sb-nav">
      ${pages.map(p=>`<a href="${p.href}" class="sb-item${activePage===p.id||activePage==='boss'&&p.id==='boss'?' active':''}" onclick="${p.oc}">${p.icon} ${p.label}</a>`).join('')}
    </nav>
    <div class="sb-footer">
      <button onclick="doLogout()" class="sb-logout">🚪 로그아웃</button>
    </div>
  `;
}

// ===== 공통 스타일 =====
const COMMON_CSS = `
*{margin:0;padding:0;box-sizing:border-box;}
:root{
  --bg:#080c14;--bg2:#0e1520;--bg3:#141d2e;
  --border:#1e2d45;--accent:#f0a500;--accent2:#14b8a6;
  --text:#e2e8f0;--text2:#64748b;
  --red:#ef4444;--green:#22c55e;--yellow:#eab308;
  --radius:10px;
}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:'Noto Sans KR',sans-serif;overflow:hidden;}
body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(240,165,0,.02)1px,transparent 1px),linear-gradient(90deg,rgba(240,165,0,.02)1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0;}
.app{display:flex;height:100vh;position:relative;z-index:1;}
#sidebar{width:220px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;overflow-y:auto;}
.sb-header{padding:18px 16px;border-bottom:1px solid var(--border);}
.sb-logo{font-size:16px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:8px;}
.sb-sub{font-size:10px;color:var(--text2);margin-top:3px;letter-spacing:.5px;}
.sb-role{font-size:11px;color:var(--accent2);margin-top:6px;font-weight:500;}
.sb-nav{padding:10px 8px;flex:1;}
.sb-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;font-size:13px;color:var(--text2);text-decoration:none;transition:all .15s;margin-bottom:2px;}
.sb-item:hover{background:var(--bg3);color:var(--text);}
.sb-item.active{background:rgba(240,165,0,.12);color:var(--accent);border:1px solid rgba(240,165,0,.2);}
.sb-footer{padding:12px 16px;border-top:1px solid var(--border);}
.sb-logout{width:100%;padding:8px;border-radius:6px;background:transparent;color:var(--text2);border:1px solid var(--border);font-size:12px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;transition:all .15s;}
.sb-logout:hover{border-color:var(--red);color:var(--red);}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.topbar{padding:14px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--bg2);flex-shrink:0;}
.topbar-title{font-size:18px;font-weight:700;}
.tab-bar{display:flex;gap:4px;padding:14px 24px 0;border-bottom:1px solid var(--border);flex-shrink:0;overflow-x:auto;}
.tab{padding:8px 14px;border-radius:8px 8px 0 0;font-size:13px;color:var(--text2);cursor:pointer;border:1px solid transparent;border-bottom:none;transition:all .15s;white-space:nowrap;}
.tab.active{background:var(--bg2);color:var(--accent);border-color:var(--border);}
.content{flex:1;overflow-y:auto;padding:20px 24px;}
.card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:16px;}
.card-head{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--border);}
.card-title{font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.07em;}
.card-body{padding:16px;}
.btn{padding:7px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:'Noto Sans KR',sans-serif;display:inline-flex;align-items:center;gap:5px;transition:all .15s;}
.btn-p{background:var(--accent);color:#000;}.btn-p:hover{background:#fbbf24;}
.btn-s{background:var(--bg3);color:var(--text);border:1px solid var(--border);}.btn-s:hover{background:#1a2a40;}
.btn-d{background:rgba(239,68,68,.15);color:var(--red);border:1px solid rgba(239,68,68,.3);}
.btn-sm{padding:4px 10px;font-size:12px;border-radius:6px;}
table{width:100%;border-collapse:collapse;font-size:13px;}
th{text-align:center;padding:7px 8px;font-size:10px;color:var(--text2);font-weight:600;border-bottom:1px solid var(--border);background:var(--bg3);white-space:nowrap;}
th.tl{text-align:left;}
td{padding:8px;border-bottom:1px solid rgba(30,45,69,.5);text-align:center;white-space:nowrap;}
tr:hover td{background:rgba(255,255,255,.02);}
.sc{position:sticky;background:var(--bg2);z-index:2;}
tr:hover .sc{background:#101c2e;}
.badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:20px;font-size:11px;font-weight:600;}
.b-gold{background:rgba(240,165,0,.2);color:var(--accent);}
.b-silver{background:rgba(148,163,184,.2);color:#94a3b8;}
.b-bronze{background:rgba(180,120,60,.2);color:#cd7f32;}
.b-green{background:rgba(34,197,94,.15);color:#22c55e;}
.b-blue{background:rgba(59,130,246,.15);color:#60a5fa;}
.b-teal{background:rgba(20,184,166,.15);color:#14b8a6;}
.b-red{background:rgba(239,68,68,.15);color:#ef4444;}
.b-purple{background:rgba(168,85,247,.15);color:#a855f7;}
.inp{background:var(--bg3);border:1px solid var(--border);border-radius:7px;color:var(--text);padding:7px 10px;font-size:13px;font-family:'Noto Sans KR',sans-serif;}
.inp:focus{outline:none;border-color:var(--accent);}
.sel{background:var(--bg3);border:1px solid var(--border);border-radius:7px;color:var(--text);padding:6px 10px;font-size:13px;font-family:'Noto Sans KR',sans-serif;cursor:pointer;}
.sel:focus{outline:none;border-color:var(--accent);}
.modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.75);display:none;align-items:center;justify-content:center;z-index:200;padding:16px;}
.modal-ov.open{display:flex;}
.modal{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:22px;width:100%;max-width:440px;max-height:88vh;overflow-y:auto;}
.modal-title{font-size:15px;font-weight:700;margin-bottom:18px;}
.modal-footer{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;}
.fg{margin-bottom:12px;}
.fg label{font-size:12px;color:var(--text2);display:block;margin-bottom:4px;}
.fg .inp,.fg .sel{width:100%;}
.ham{display:none;background:none;border:none;color:var(--text);font-size:22px;cursor:pointer;padding:4px;}
.sb-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:49;}
@media(max-width:768px){
  #sidebar{position:fixed;left:-220px;top:0;bottom:0;z-index:50;transition:left .3s;}
  #sidebar.open{left:0;}
  .sb-ov.open{display:block;}
  .ham{display:block;}
  .main{width:100%;}
}
`;
