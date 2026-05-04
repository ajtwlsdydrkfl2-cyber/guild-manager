// ========== FIREBASE 설정 ==========
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA8g79nQxW9mDVhvudBq9DTnPq7_thk0FA",
  authDomain: "bosssv-9c939.firebaseapp.com",
  databaseURL: "https://bosssv-9c939-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bosssv-9c939",
  storageBucket: "bosssv-9c939.firebasestorage.app",
  messagingSenderId: "290600826819",
  appId: "1:290600826819:web:a7275a6173acc5b8e2ef76"
};

// Firebase SDK 로드 (CDN)
// firebase-app, firebase-database 사용

let firebaseDB = null;
let firebaseApp = null;

function initFirebase() {
  if (firebaseApp) return;
  try {
    firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    firebaseDB = firebase.database();
    console.log('Firebase 연결 성공!');
  } catch(e) {
    console.error('Firebase 연결 실패:', e);
  }
}

// ===== 서버별 Firebase 경로 =====
function fbPath(key) {
  const sess = getSession();
  const sid = sess ? sess.serverId : 0;
  return `servers/server${sid}/${key}`;
}

// ===== Firebase 데이터 읽기 =====
function fbGet(key, callback) {
  if (!firebaseDB) { callback(null); return; }
  firebaseDB.ref(fbPath(key)).once('value', snap => {
    callback(snap.val());
  });
}

// ===== Firebase 데이터 쓰기 =====
function fbSet(key, value) {
  if (!firebaseDB) return;
  firebaseDB.ref(fbPath(key)).set(value);
}

// ===== Firebase 실시간 감지 =====
function fbListen(key, callback) {
  if (!firebaseDB) return;
  firebaseDB.ref(fbPath(key)).on('value', snap => {
    callback(snap.val());
  });
}

function fbOff(key) {
  if (!firebaseDB) return;
  firebaseDB.ref(fbPath(key)).off();
}

// ===== config 읽기/쓰기 (전역) =====
function fbGetConfig(callback) {
  if (!firebaseDB) { callback(getConfig()); return; }
  firebaseDB.ref('config').once('value', snap => {
    const v = snap.val();
    if (v) { callback(v); }
    else {
      const def = getConfig();
      firebaseDB.ref('config').set(def);
      callback(def);
    }
  });
}

function fbSetConfig(cfg) {
  if (!firebaseDB) { saveConfig(cfg); return; }
  firebaseDB.ref('config').set(cfg);
  saveConfig(cfg);
}
