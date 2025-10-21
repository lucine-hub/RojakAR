/***********************
 * Firebase bootstrap
 ***********************/
const firebaseConfig = {
  apiKey: "AIzaSyDLJqq4ZQJBVtEvV-rKYmNpSDM9Mrdvhi4",
  authDomain: "ar-rojak.firebaseapp.com",
  databaseURL: "https://ar-rojak-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ar-rojak",
  storageBucket: "ar-rojak.appspot.com",
  messagingSenderId: "245111113",
  appId: "1:245111113:web:71b832644bd7ead054a298",
  measurementId: "G-2NJBXVY3Q9"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/***********************
 * Local ID helpers
 ***********************/
function getLocalId(){ return localStorage.getItem('playerId'); }
function setLocalId(id){ localStorage.setItem('playerId', String(id)); }

/** Reserve next numeric player id using /playerCount counter */
async function reserveNumericId(){
  const ref = db.ref('playerCount');
  const res = await ref.transaction(c => (c || 0) + 1);
  if (!res.committed) throw new Error('Could not reserve ID');
  return String(res.snapshot.val());
}

/***********************
 * Public API
 ***********************/
async function savePlayerName(name){
  if (!name || !name.trim()) throw new Error("Name required");
  const existingId = localStorage.getItem('playerId');

  // If we already have an id, just ensure the name is up to date.
  if (existingId) {
    await db.ref(`players/${existingId}`).update({
      name: name.trim(),
      // Ensure required fields exist
      score: firebase.database.ServerValue.increment(0),
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });
    return existingId;
  }

  // Create a new player
  const newRef = db.ref('players').push();
  await newRef.set({
    name: name.trim(),
    score: 0,
    found: { rice:false, sambal:false, ikan:false, daun:false },
    comboAwarded: false,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  });
  return newRef.key;
}

// ==============================
//  HELPER: CURRENT PLAYER
// ==============================
function getMyIds(){
  const playerId = localStorage.getItem('playerId');
  const playerName = localStorage.getItem('playerName');
  if (!playerId || !playerName) throw new Error("Not logged in");
  return { playerId, playerName };
}

// ==============================
//  SCORE HELPERS
// ==============================
function getMyScore(){
  const { playerId } = getMyIds();
  return db.ref(`players/${playerId}/score`).get()
    .then(snap => Number(snap.val() || 0));
}

// Award +10 once per item per player using a TRANSACTION guard.
function awardFound(itemKey){
  const { playerId, playerName } = getMyIds();
  const ref = db.ref(`players/${playerId}`);
  return ref.transaction(cur => {
    if (!cur) cur = {};
    if (!cur.name) cur.name = playerName;
    if (typeof cur.score !== 'number') cur.score = 0;
    if (!cur.found) cur.found = {};
    if (cur.found[itemKey]) return cur; // already awarded

    cur.found[itemKey] = true;
    cur.score += 10;
    return cur;
  });
}

// Award +20 once for the combo using a TRANSACTION guard.
function awardCombo(){
  const { playerId, playerName } = getMyIds();
  const ref = db.ref(`players/${playerId}`);
  return ref.transaction(cur => {
    if (!cur) cur = {};
    if (!cur.name) cur.name = playerName;
    if (typeof cur.score !== 'number') cur.score = 0;
    if (cur.comboAwarded) return cur; // already got it

    cur.comboAwarded = true;
    cur.score += 20;
    return cur;
  });
}

// ==============================
//  ITEMS LISTENER (for tooltip)
//  - calls cb({rice:bool,sambal:bool,ikan:bool,daun:bool})
//  - returns an unsubscribe function
// ==============================
function onFoundItems(cb){
  const { playerId } = getMyIds();
  const ref = db.ref(`players/${playerId}/found`);
  const handler = snap => {
    const v = snap.val() || { rice:false, sambal:false, ikan:false, daun:false };
    cb(v);
  };
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

// ==============================
//  ERROR TEXT
// ==============================
function cleanFirebaseError(err){
  return (err && err.message) ? err.message : String(err);
}

// Export to window for HTML pages
window.savePlayerName = savePlayerName;
window.getMyScore    = getMyScore;
window.awardFound    = awardFound;
window.awardCombo    = awardCombo;
window.onFoundItems  = onFoundItems;
window.cleanFirebaseError = cleanFirebaseError;
