<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
  import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, getDocs, writeBatch, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

  import {
  getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, getDocs,
  writeBatch, serverTimestamp, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

    
  const firebaseConfig = {
    apiKey: "AIzaSyAegeue7A8qFFW4IScFFgtvT4P1g2GLkCM",
    authDomain: "who-is-who-6ea99.firebaseapp.com",
    projectId: "who-is-who-6ea99",
    storageBucket: "who-is-who-6ea99.firebasestorage.app",
    messagingSenderId: "718537140049",
    appId: "1:718537140049:web:7400ec7e5467b387f8d570",
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  await setPersistence(auth, browserLocalPersistence);
  async function ensureAuth(){
    const u = await new Promise(r=>{ const un = onAuthStateChanged(auth,(x)=>{un(); r(x);}); });
    return u || (await signInAnonymously(auth)).user;
  }
  await ensureAuth();

const AVATAR_MAP = {
  cristiano:  "avatars/cristiano.png",
  lamine:     "avatars/lamine.png",
  odegar:     "avatars/odegar.png",   // coincide con tu archivo
  ronaldinho: "avatars/ronaldinho.png",
  ronaldo:    "avatars/ronaldo.png"
};

const AVATAR_ALIASES = {
  odegaard: "odegar",   // si en algún lado lo escribiste con 2 "a"
  diego:    "maradona"  // sólo si tenés maradona.png
};

function normalizeAvatarKey(k){
  const key = (k||"").toLowerCase();
  if (AVATAR_MAP[key]) return key;
  if (AVATAR_ALIASES[key] && AVATAR_MAP[AVATAR_ALIASES[key]]) return AVATAR_ALIASES[key];
  return "";
}


  const $ = s => document.querySelector(s);
  const roomCodeEl  = $("#roomCode");
  const meNameEl    = $("#meName");
  const playersWrap = $("#players");
  const leaveBtn = document.getElementById("leaveBtn");
  const deleteRoomBtn = document.getElementById("deleteRoomBtn");
  const togglePrivacyBtn = document.getElementById("togglePrivacyBtn");
  const toggleCodeBtn = document.getElementById("toggleCodeBtn");
  const privacyHint = document.getElementById("privacyHint");

  function icon(id){
  return `<svg class="icon"><use href="#${id}"></use></svg>`;
}

  /* ======= TOAST simple ======= */
  function showToast(msg, ms=1400){
    const t = document.getElementById("toast");
    if(!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(showToast._h);
    showToast._h = setTimeout(()=> t.classList.remove("show"), ms);
  }

  /* ======= PRIVACIDAD & VISIBILIDAD DE CÓDIGO ======= */
  let showCode = false;      // oculto por defecto
  let isPublic = false;      // privada por defecto

  function updatePrivacyUI(){
  togglePrivacyBtn.innerHTML = isPublic
    ? `${icon("i-globe")} Pública`
    : `${icon("i-lock")} Privada`;
  privacyHint.textContent = isPublic ? "Aparece en listado público" : "Solo con código";
  togglePrivacyBtn.style.background = isPublic
    ? "linear-gradient(180deg,#22c55e,#16a34a)"
    : "linear-gradient(180deg,#1e68d6,#184fa5)";
}

  function updateCodeVisibility(){
  roomCodeEl.textContent = showCode ? (state.code || "—") : "••••••";
  toggleCodeBtn.innerHTML = showCode
    ? `${icon("i-eye-off")} Ocultar código`
    : `${icon("i-eye")} Mostrar código`;
}


  togglePrivacyBtn.addEventListener("click", async ()=>{
    if(!isHost){ alert("Solo el host puede cambiar esto."); return; }
    isPublic = !isPublic;
    updatePrivacyUI();
    try{ await updateDoc(roomRef,{ isPublic }); }catch(e){ console.warn(e); }
    showToast(isPublic ? "🌍 Sala pública" : "🔒 Sala privada");
  });
  toggleCodeBtn.addEventListener("click", ()=>{
    showCode = !showCode; updateCodeVisibility();
    showToast(showCode ? "👁️ Código visible" : "🙈 Código oculto");
  });

  function getStoredName(){
    const qp = new URLSearchParams(location.search);
    const qName = qp.get("name");
    if (qName && qName.trim()) localStorage.setItem("displayName", qName.trim());
    const s = localStorage.getItem("displayName") || "";
    return (s.trim().length>=2 && s.trim().length<=16) ? s.trim() : "Jugador";
  }
  function getStoredAvatar(){
  const qp = new URLSearchParams(location.search);
  const qAvatar = normalizeAvatarKey(qp.get("avatar")); // viene de index/ingresar
  if (qAvatar) localStorage.setItem("avatarKey", qAvatar);

  const saved = normalizeAvatarKey(localStorage.getItem("avatarKey"));
  return saved || ""; // si queda vacío => placeholder
}


  async function editAndSaveName(playerRef){
    const prev = getStoredName();
    const nuevo = prompt("Tu nombre para mostrar (2–16 chars):", prev) ?? "";
    const v = nuevo.trim();
    if (v.length<2 || v.length>16) return;
    localStorage.setItem("displayName", v);
    meNameEl.textContent = v;
    try{ if(playerRef) await updateDoc(playerRef, { name: v }); }catch{}
  }

  function genCode(len=6){const A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let s="";for(let i=0;i<len;i++) s+=A[Math.floor(Math.random()*A.length)];return s;}
  async function createUniqueRoomCode(db,tries=10){
    for(let i=0;i<tries;i++){const c=genCode(6);const ref=doc(db,"rooms",c);if(!(await getDoc(ref)).exists()) return c;}
    return genCode(8);
  }

  let lastPlayers=[];
  let hostUid = null; // <<< NUEVO: guardamos uid del host

  function drawPlayers(maxCount,list){
    const ordered=(list||[]).slice().sort((a,b)=>(a.slot||0)-(b.slot||0));
    playersWrap.innerHTML="";
    for(let i=0;i<maxCount;i++){
      const p=ordered[i];
      const card=document.createElement("div"); card.className="player";
      const av=document.createElement("div"); const label=document.createElement("small");
      if(p){
        if(p.avatarKey && AVATAR_MAP[p.avatarKey]){
          av.className="avatar";
          const img=document.createElement("img"); img.className="avatar-img"; img.src=AVATAR_MAP[p.avatarKey]; img.alt=p.name||"avatar"; av.appendChild(img);
        }else{ av.className="avatar placeholder"; }
        const isMe = p.uid===(auth.currentUser&&auth.currentUser.uid);
const isCap = hostUid && p.uid===hostUid;

if(isCap){
  const cap = document.createElement("div");
  cap.className = "badge-captain";
  cap.innerHTML = `<svg class="icon" style="width:16px;height:16px"><use href="#i-crown"></use></svg>`;
  card.append(cap);
}

if(isMe){
  card.classList.add("me-outline");
  label.innerHTML = `${p.name||`Jugador ${i+1}`} <span class="me-badge">(yo)</span>`;
}else{
  label.textContent = p.name || `Jugador ${i+1}`;
  if(isHost){
    const kick=document.createElement("button");
    kick.className="kick-btn";
    kick.title="Expulsar";
    kick.innerHTML = `<svg class="icon"><use href="#i-x"></use></svg>`;
    kick.onclick=async()=>{
      if(confirm(`Expulsar a ${p.name||'Jugador'}?`)){
        try{ await deleteDoc(doc(db,"rooms",state.code,"players",p.uid)); }catch(e){ console.warn(e); }
      }
    };
    label.append(kick);
  }
}
      }else{ av.className="avatar placeholder"; label.textContent=`Jugador ${i+1}`; }
      card.append(av,label); playersWrap.append(card);
    }
  }

  const impostoresEl = document.getElementById("impostoresVal");
  const jugadoresEl  = document.getElementById("jugadoresVal");
  const temaEl       = document.getElementById("temaVal");
  const tiempoEl     = document.getElementById("tiempoVal");

  // Estado
  const state={ 
    code:"",
    impostores:1, 
    jugadores:8, 
    temas:["Clubes","Jugadores","Mundiales"], 
    temaIndex:0,
    tiempos:[30,45,60,90,120],
    tiempoIndex:2 // 60s
  };

  function render(){
    roomCodeEl.textContent = showCode ? (state.code || "—") : "••••••";
    impostoresEl.textContent = state.impostores;
    jugadoresEl.textContent  = state.jugadores;
    temaEl.textContent       = state.temas[state.temaIndex];
    tiempoEl.textContent     = state.tiempos[state.tiempoIndex] + "s";
    drawPlayers(state.jugadores, lastPlayers);
  }

  // Reusar sala
  const lsKey="lastRoomCode"; let isHost=false;
  function putCodeInUrl(code){ try{ history.replaceState(null,"",`?code=${code}`);}catch{} }
  let urlCode=new URLSearchParams(location.search).get("code");
  if(urlCode && urlCode.trim()){ state.code=urlCode.trim().toUpperCase(); isHost=false; }
  else{
    const prev=localStorage.getItem(lsKey);
    if(prev){
      const prevSnap=await getDoc(doc(db,"rooms",prev));
      if(prevSnap.exists()){ state.code=prev; isHost=(prevSnap.data().hostUid===(auth.currentUser&&auth.currentUser.uid)); putCodeInUrl(state.code); }
    }
    if(!state.code){ state.code=await createUniqueRoomCode(db); isHost=true; localStorage.setItem(lsKey,state.code); putCodeInUrl(state.code); }
  }
  render();

  const roomRef = doc(db,"rooms",state.code);

  const firstSnap = await getDoc(roomRef);
  if(!firstSnap.exists() && isHost){
    await setDoc(roomRef,{ hostUid:auth.currentUser.uid, status:"lobby", isPublic:false, createdAt:Date.now(), settings:{maxPlayers:state.jugadores,impostors:state.impostores,tema:state.temas[state.temaIndex], timeSec: state.tiempos[state.tiempoIndex]} },{merge:true});
  }
  if(firstSnap.exists()) isHost = firstSnap.data().hostUid === auth.currentUser.uid;
  if(isHost){ localStorage.setItem(lsKey,state.code); putCodeInUrl(state.code); }

  const myName=getStoredName(); const myAvatar=getStoredAvatar();
  meNameEl.textContent=myName;
  await setDoc(doc(db,"rooms",state.code,"players",auth.currentUser.uid),{ uid:auth.currentUser.uid, name:myName, avatarKey:myAvatar||null, slot:isHost?1:Date.now(), online:true },{merge:true});
  const playerRef = doc(db,"rooms",state.code,"players",auth.currentUser.uid);
  document.getElementById("editName")?.addEventListener("click", ()=> editAndSaveName(playerRef));

  function setArrowsEnabled(en){ document.querySelectorAll(".arrow").forEach(b=>{ b.style.pointerEvents=en?"auto":"none"; b.style.opacity=en?"1":".55"; }); }
  setArrowsEnabled(isHost);

  function setHostControlsVisible(on){
    leaveBtn.style.display = on ? "inline-block" : "none";
    deleteRoomBtn.style.display = on ? "inline-block" : "none";
  }
  setHostControlsVisible(isHost);

  document.querySelectorAll(".arrow").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const inc=btn.dataset.inc, dec=btn.dataset.dec;
      if(inc==="impostores") state.impostores=Math.min(3,state.impostores+1);
      if(dec==="impostores") state.impostores=Math.max(1,state.impostores-1);
      if(inc==="jugadores") state.jugadores=Math.min(10,state.jugadores+1);
      if(dec==="jugadores") state.jugadores=Math.max(4,state.jugadores-1);
      if(inc==="tema") state.temaIndex=(state.temaIndex+1)%state.temas.length;
      if(dec==="tema") state.temaIndex=(state.temaIndex-1+state.temas.length)%state.temas.length;
      if(inc==="tiempo") state.tiempoIndex = (state.tiempoIndex+1) % state.tiempos.length;
      if(dec==="tiempo") state.tiempoIndex = (state.tiempoIndex-1+state.tiempos.length) % state.tiempos.length;

      if(state.impostores>=state.jugadores) state.impostores=Math.max(1,state.jugadores-1);
      state.jugadores=Math.max(state.jugadores,lastPlayers.length);
      render();

      if(isHost){ 
        await setDoc(roomRef,{ 
          settings:{
            maxPlayers:state.jugadores,
            impostors: state.impostores,
            tema:      state.temas[state.temaIndex],
            timeSec:   state.tiempos[state.tiempoIndex]
          } 
        },{merge:true}); 
      }
    });
  });

  /* ======= SNAPSHOT PRINCIPAL (ajusta host, settings, privacidad) ======= */
  let roomSettings = null; // cache de settings para fallback
  onSnapshot(roomRef,s=>{
    if(!s.exists()) return;
    const data=s.data();

    // host
    const before=isHost; isHost=(data.hostUid===auth.currentUser.uid);
    hostUid = data.hostUid || null; // <<< NUEVO: guardamos host uid
    if(before!==isHost){ setArrowsEnabled(isHost); setHostControlsVisible(isHost); }

    // settings
    roomSettings = data.settings || roomSettings;
    const st=data.settings||{};
    state.jugadores=st.maxPlayers??state.jugadores;
    state.impostores=st.impostors??state.impostores;
    if(st.tema){ const idx=state.temas.indexOf(st.tema); state.temaIndex = idx>=0?idx:0; }
    if(st.timeSec){ const tidx = state.tiempos.indexOf(st.timeSec); state.tiempoIndex = tidx>=0 ? tidx : state.tiempoIndex; }

    // privacidad
    isPublic = !!data.isPublic;
    updatePrivacyUI();
    updateCodeVisibility();

    render();
  });

  onSnapshot(collection(db,"rooms",state.code,"players"), snap=>{ lastPlayers=snap.docs.map(d=>d.data()); drawPlayers(state.jugadores,lastPlayers); });

  /* ======= SOLICITUDES DE UNIÓN (solo host) ======= */
  onSnapshot(collection(db, "rooms", state.code, "requests"), snap=>{
    if(!isHost) return;
    snap.docChanges().forEach(async change=>{
      if(change.type === "added"){
        const req = change.doc.data();
        const ok = confirm(`${req.name || "Jugador"} quiere unirse a la sala. ¿Aceptar?`);
        try{
          if(ok){
            await setDoc(doc(db,"rooms",state.code,"players",req.uid),{
              uid:req.uid,
              name:req.name || "Jugador",
              avatarKey:req.avatarKey||null,
              online:true,
              slot:Date.now()
            },{merge:true});
          }
        }finally{
          try{ await deleteDoc(change.doc.ref); }catch{}
        }
      }
    });
  });

  const POOLS={ 
    Clubes:["Real Madrid","Barcelona","Boca Juniors","River Plate","PSG","Manchester City","Inter","AC Milan","Liverpool","Chelsea"], 
    Jugadores:["Lionel Messi","Cristiano Ronaldo","Diego Maradona","Pelé","Kylian Mbappé","Erling Haaland","Neymar","Zinedine Zidane","Ronaldinho","Ronaldo Nazário"], 
    Mundiales:["Mundial 2002","Mundial 2006","Mundial 2010","Mundial 2014","Mundial 2018","Mundial 2022"] 
  };

  function pickWord(tema){ const pool=POOLS[tema]||["Balón"]; return pool[Math.floor(Math.random()*pool.length)]; }
  function shuffleInPlace(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }

  // START
  let starting=false;
  document.getElementById("startBtn").addEventListener("click", async ()=>{
    if(!isHost){ alert("Solo el host puede iniciar"); return; }
    if(starting) return; starting=true;
    try{
      const roomSnap=await getDoc(roomRef);
      if(!roomSnap.exists()){ alert("Sala no encontrada."); starting=false; return; }
      const room=roomSnap.data(); const st=room.settings||{};
      if(room.status==="playing"){ alert("La partida ya está en curso."); starting=false; return; }
      const ps=await getDocs(collection(db,"rooms",state.code,"players"));
      const players=ps.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.id&&p.online!==false);
      const K=st.impostors||1; const tema=st.tema||"Clubes";
      const timeSec = st.timeSec || state.tiempos[state.tiempoIndex];
      if(players.length<3){ alert("Se necesitan al menos 3 jugadores."); starting=false; return; }
      if(K>=players.length){ alert("Impostores debe ser menor que jugadores."); starting=false; return; }
      const palabra=pickWord(tema);
      const order=shuffleInPlace(players.map(p=>p.id));
      const impostorIds=new Set(order.slice(0,K));
      const nextRound=(room.round||0)+1;
      const batch=writeBatch(db);
      // GUARDAMOS ORDEN MAESTRO (fijo para toda la partida)
      batch.update(roomRef,{
        status:"playing",
        round:nextRound,
        startedAt:serverTimestamp(),
        settings:{...st, timeSec},
        orderMaster: order
      });
      players.forEach(p=>{
        const aRef=doc(db,"rooms",state.code,"assignments",p.id);
        batch.set(aRef,{round:nextRound,uid:p.id,name:p.name||"Jugador",avatarKey:p.avatarKey||null,role:impostorIds.has(p.id)?"IMPOSTOR":"CIVIL",word:impostorIds.has(p.id)?null:palabra,tema,alive:true,vote:null,revealedAt:null});
      });
      const roundRef=doc(db,"rooms",state.code,"rounds",String(nextRound));
      batch.set(roundRef,{status:"reveal",createdAt:serverTimestamp(),order,turnIndex:0, timeSec});
      await batch.commit();
      setTimeout(async()=>{ try{ await updateDoc(roundRef,{status:"draw",drawStartedAt:serverTimestamp()}); }catch{} },10000);
    }catch(e){ console.error(e); alert(e.message||"No pude iniciar la partida."); } finally{ starting=false; }
  });

  // ABANDONAR (solo host)
  leaveBtn.addEventListener("click", async ()=>{
    if (!isHost){
      alert("Solo el host puede abandonar y resetear la sala.");
      return;
    }
    if (!confirm("¿Seguro que querés abandonar la partida actual? Esto limpia la ronda.")) return;

    try {
      const batchDel = writeBatch(db);
      const assignsSnap = await getDocs(collection(db,"rooms",state.code,"assignments"));
      assignsSnap.forEach(d => batchDel.delete(d.ref));
      const roundsSnap = await getDocs(collection(db,"rooms",state.code,"rounds"));
      roundsSnap.forEach(d => batchDel.delete(d.ref));
      await batchDel.commit();

      await updateDoc(doc(db,"rooms",state.code), {
        status: "lobby",
        round: 0,
        startedAt: null
      });

      document.getElementById("phaseDiscuss").style.display = "none";
      alert("Sesión abandonada. Ya podés iniciar otra partida.");

    } catch(e){
      console.error(e);
      alert("Error al abandonar: " + (e?.message || e));
    }
  });

  // ===== ELIMINAR SALA =====
  async function deleteCollection(collRef){
    const snap = await getDocs(collRef);
    const batchLimit = 400;
    let i = 0, batch = writeBatch(db);
    for (const d of snap.docs){
      batch.delete(d.ref);
      i++;
      if(i % batchLimit === 0){ await batch.commit(); batch = writeBatch(db); }
    }
    if(i % batchLimit !== 0) await batch.commit();
  }

  async function deleteRoomDeep(){
    if(!isHost){ alert("Solo el host puede eliminar la sala."); return; }
    const ok = confirm("⚠️ Esto eliminará la SALA completa (jugadores, rondas, chat, votos). ¿Continuar?");
    if(!ok) return;

    try{
      await deleteCollection(collection(db,"rooms",state.code,"assignments"));
      const roundsSnap = await getDocs(collection(db,"rooms",state.code,"rounds"));
      for(const rdoc of roundsSnap.docs){
        const rid = rdoc.id;
        await deleteCollection(collection(db,"rooms",state.code,"rounds",rid,"chat"));
        await deleteCollection(collection(db,"rooms",state.code,"rounds",rid,"firstWords"));
        await deleteCollection(collection(db,"rooms",state.code,"rounds",rid,"votes"));
        await deleteDoc(rdoc.ref);
      }
      await deleteCollection(collection(db,"rooms",state.code,"players"));
      await deleteCollection(collection(db,"rooms",state.code,"requests"));
      await deleteDoc(doc(db,"rooms",state.code));

      localStorage.removeItem("lastRoomCode");
      location.replace("/index.html");

    }catch(e){
      console.error(e);
      alert("Error al eliminar la sala: " + (e?.message || e));
    }
  }
  deleteRoomBtn.addEventListener("click", deleteRoomDeep);

  // Overlay rol — SOLO 1ª RONDA y 1 vez por dispositivo
  onSnapshot(doc(db,"rooms",state.code,"assignments",auth.currentUser.uid), async s=>{
    if(!s.exists()) return;
    const a=s.data();
    const currentR = a.round || 0;
    const already = localStorage.getItem("roleShownOnce")==="1";
    if (currentR > 1 || already) return;

    const overlay=document.getElementById("reveal"); const box=document.getElementById("revContent");
    let avatarHtml=""; if(a.avatarKey && AVATAR_MAP[a.avatarKey]) avatarHtml=`<div class="rev-avatar"><img src="${AVATAR_MAP[a.avatarKey]}" alt="${a.name||'avatar'}"></div>`;
    const nameHtml=`<div class="rev-name">${a.name||"Jugador"}</div>`;
    overlay.style.display="grid";
    if(a.role==="IMPOSTOR"){ box.innerHTML=`${avatarHtml}${nameHtml}<div style="font-size:clamp(24px,7vw,38px);font-weight:900;color:#ff6b6b;margin:6px 0 8px">IMPOSTOR</div><div style="opacity:.85">Tu objetivo es camuflarte. No conocés la palabra.</div>`; }
    else{ box.innerHTML=`${avatarHtml}${nameHtml}<div style="opacity:.75;font-size:clamp(12px,3.8vw,14px);margin:6px 0">Palabra secreta (${a.tema})</div><div style="font-size:clamp(22px,7vw,34px);font-weight:900;color:#7cf062">${a.word}</div>`; }
    let secs=10; const countdownEl=document.getElementById("countdown");
    countdownEl.textContent=`Pasando en ${secs}s...`; const interval=setInterval(()=>{ secs--; countdownEl.textContent=`Pasando en ${secs}s...`; if(secs<=0){ clearInterval(interval); overlay.style.display="none"; localStorage.setItem("roleShownOnce","1"); } },1000);
  });

  // Utils
  function sanitize(str){ return (str||"").replace(/[<>&]/g, s=>({ '<':'&lt;','>':'&gt;','&':'&amp;' }[s])); }
  async function nameOf(uid){ try{ const snap=await getDoc(doc(db,"rooms",state.code,"players",uid)); return (snap.exists()&&(snap.data().name||"Jugador"))||"Jugador"; }catch{ return "Jugador"; } }
  const timerEl = document.getElementById("timer");
  function toMillis(ts){ return ts?.toMillis?.() ?? (ts?.seconds ? ts.seconds*1000 : (typeof ts==="number" ? ts : 0)); }
  function fmtClock(ms){ const s=Math.max(0,Math.ceil(ms/1000)); const mm=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${mm}:${ss}`; }

// === helpers de chat (debate) ===
function createMsgRow(mine, name, text){
  const row = document.createElement('div');
  row.className = `chat-row ${mine?'mine':'other'}`;
  row.dataset.msgId = m.id || ''; // opcional
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = `<div class="name">${sanitize(name)||'Jugador'}</div><div class="text">${sanitize(text||'')}</div>`;
  row.appendChild(bubble);
  return row;
}

function appendChatMessage(container, msg, isMine){
  const wasAtBottom = (container.scrollTop + container.clientHeight + 8) >= container.scrollHeight;
  const node = createMsgRow(isMine, msg.name, msg.text);
  container.appendChild(node);
  if (wasAtBottom) container.scrollTop = container.scrollHeight;
}

  
  // Sorteo animación — SOLO ronda 1
  async function startDrawAnimation(order){
    const draw=document.getElementById("drawOverlay"); const slip=document.getElementById("slip"); const list=document.getElementById("orderList");
    list.innerHTML=""; draw.style.display="grid";
    const names=await Promise.all(order.map(uid=>nameOf(uid)));
    names.forEach((n,i)=>{ const item=document.createElement("div"); item.className="order-item"; item.innerHTML=`<div class="order-badge">${i+1}</div><div class="order-name" id="ord-${i}">—</div>`; list.appendChild(item); });
    for(let i=0;i<order.length;i++){ const n=names[i]; slip.textContent=n; slip.classList.remove("reveal"); void slip.offsetWidth; slip.classList.add("reveal"); await new Promise(r=>setTimeout(r,900)); const slot=document.getElementById(`ord-${i}`); if(slot) slot.textContent=n; await new Promise(r=>setTimeout(r,450)); }
    const roomSnap=await getDoc(roomRef); const roundId=String(roomSnap.data().round||0);
    if(isHost && roundId!=="0"){ await updateDoc(doc(db,"rooms",state.code,"rounds",roundId),{status:"prompt",promptStartedAt:serverTimestamp(),turnIndex:0}); }
    setTimeout(()=>{ draw.style.display="none"; },600);
  }

  // === RESULTADOS / SIGUIENTE RONDA ===
  async function tallyVotes(roundId){
    const votesSnap = await getDocs(collection(db,"rooms",state.code,"rounds",String(roundId),"votes"));
    const counts = new Map();
    for (const d of votesSnap.docs){
      const v = d.data()?.target;
      if(!v) continue;
      counts.set(v, (counts.get(v)||0)+1);
    }
    if(counts.size===0) return { expelledUid:null, tie:false, counts:{} };

    let max = 0, winners = [];
    for (const [uid,c] of counts){
      if (c>max){ winners=[uid]; max=c; }
      else if (c===max){ winners.push(uid); }
    }
    const tie = winners.length!==1;
    const expelledUid = tie ? null : winners[0];

    const countsObj = {};
    for (const [k,v] of counts) countsObj[k]=v;
    return { expelledUid, tie, counts:countsObj, max };
  }

  async function getAssignment(uid){
    try{
      const a = await getDoc(doc(db,"rooms",state.code,"assignments",uid));
      return a.exists()? a.data() : null;
    }catch{ return null; }
  }

  function showResultsOverlayUI({ title, subtitle, color="#cfe4ff" }){
    const ov = document.getElementById("resultsOverlay");
    const box = document.getElementById("resultsBox");
    const sub = document.getElementById("resultsSub");
    box.innerHTML = `<div style="font-weight:900;font-size:clamp(20px,6.5vw,28px);color:${color}">${title}</div>`;
    sub.textContent = subtitle || "";
    ov.style.display = "grid";
  }
  function hideResultsOverlayUI(){ document.getElementById("resultsOverlay").style.display="none"; }

  // ⬇️ Rondas siguientes: mantener orden maestro, sin reveal/draw
  async function startNextRoundKeepingRoles(){
    const roomSnap = await getDoc(roomRef);
    const room = roomSnap.data()||{};
    const st = room.settings || roomSettings || {};
    const tema = st.tema || state.temas[state.temaIndex];
    const timeSec = st.timeSec || state.tiempos[state.tiempoIndex];

    const asgSnap = await getDocs(collection(db,"rooms",state.code,"assignments"));
    const all = asgSnap.docs.map(d=>d.data());
    const alive = all.filter(p => p.alive!==false);

    if (alive.length < 3){
      showResultsOverlayUI({
        title: "No hay suficientes jugadores vivos para continuar",
        subtitle: "Volvé al lobby y creá una nueva partida.",
        color:"#ffd166"
      });
      return;
    }

    // Orden fijo de la sala, filtrado por vivos
    const master = Array.isArray(room.orderMaster) ? room.orderMaster : alive.map(p=>p.uid);
    const aliveSet = new Set(alive.map(p=>p.uid));
    const order = master.filter(uid => aliveSet.has(uid));

    const palabra = pickWord(tema);
    const nextRound = (room.round||0) + 1;

    const batch = writeBatch(db);
    batch.update(roomRef,{
      round: nextRound,
      status: "playing",
      startedAt: serverTimestamp(),
      settings:{...st, timeSec}
      // orderMaster se mantiene
    });

    for (const p of all){
      const ref = doc(db,"rooms",state.code,"assignments",p.uid);
      const word = (p.alive!==false && p.role!=="IMPOSTOR") ? palabra : null;
      batch.set(ref,{ ...p, round: nextRound, word, tema, vote:null }, { merge:true });
    }

    const roundRef = doc(db,"rooms",state.code,"rounds",String(nextRound));
    batch.set(roundRef,{
      status:"prompt",                // ⬅️ directo a PROMPT
      createdAt: serverTimestamp(),
      promptStartedAt: serverTimestamp(),
      order,
      turnIndex:0,
      timeSec
    });

    await batch.commit();
    // Nada de reveal/draw en rondas siguientes
  }

  // Estado de ronda
  let currentRound=0;
  let roundState=null;
  let drawPlayedForRound=0;

  let unsubscribeRoundHint=null;
  let unsubscribeChat=null;
  let unsubscribeFirstWords=null;
  let unsubscribeRoundPhase=null;

  let _turnBannerTimer=null;
  function showTurnBanner(name){
    const banner=document.getElementById("turnBanner");
    const who=document.getElementById("turnName");
    who.textContent=name||"alguien";
    banner.classList.remove("hide"); banner.classList.add("show"); banner.style.display="block";
    if(_turnBannerTimer) clearTimeout(_turnBannerTimer);
    _turnBannerTimer=setTimeout(()=>{ banner.classList.remove("show"); banner.classList.add("hide"); setTimeout(()=>{ banner.style.display="none"; },350); },2200);
  }

  // === Cartel estilo graffiti cuando le toca a alguien ===
function showGraffitiTurn(name){
  const banner=document.getElementById("graffitiBanner");
  const text=document.getElementById("graffitiText");
  text.textContent = `Le toca verdulear a ${name || "alguien"}!`;
  banner.style.display="block";
  banner.style.animation="none"; void banner.offsetWidth; banner.style.animation="";
  banner.style.animation="popGraffiti 0.6s ease-out";
  setTimeout(()=>{ banner.style.display="none"; },2500);
}


  let firstWordsMap = new Set();
  function subscribeFirstWords(roundId){
    if(unsubscribeFirstWords) unsubscribeFirstWords();
    firstWordsMap = new Set();
    unsubscribeFirstWords = onSnapshot(
      collection(db,"rooms",state.code,"rounds",String(roundId),"firstWords"),
      snap=>{
        firstWordsMap = new Set(snap.docs.map(d=>d.id));
        advanceIfReadyByHost();
      }
    );
  }

  async function advanceIfReadyByHost(){
    if(!isHost || !roundState || roundState.status!=="prompt") return;
    const order = roundState.order || [];
    const idx   = roundState.turnIndex ?? 0;
    const uidTurno = order[idx];
    if(!uidTurno) return;
    if(firstWordsMap.has(uidTurno)){
      const roundId = String(currentRound);
      const nextIdx = idx + 1;
      if(nextIdx < order.length){
        try{ await updateDoc(doc(db,"rooms",state.code,"rounds",roundId),{turnIndex:nextIdx}); }catch(e){ console.warn(e); }
      }else{
        const tSec = roundState?.timeSec || roomSettings?.timeSec || state.tiempos[state.tiempoIndex];
        try{ await updateDoc(doc(db,"rooms",state.code,"rounds",roundId),{status:"discuss",discussStartedAt:serverTimestamp(), timeSec: tSec}); }catch(e){ console.warn(e); }
      }
    }
  }

  let discussTicker = null;
  const timerBox = document.getElementById("timer");
  function startDiscussCountdown(roundDocData, isHostNow){
    if(discussTicker) { clearInterval(discussTicker); discussTicker=null; }
    const startMs = toMillis(roundDocData?.discussStartedAt);
    const totalSec = roundDocData?.timeSec || roomSettings?.timeSec || state.tiempos[state.tiempoIndex];
    const totalMs = (totalSec||60)*1000;
    if(!startMs){ timerBox.textContent=""; return; }

    discussTicker = setInterval(async ()=>{
      const now = Date.now();
      const left = (startMs + totalMs) - now;
      timerBox.textContent = fmtClock(left);

      if(left <= 0){
        clearInterval(discussTicker); discussTicker=null;
        timerBox.textContent = "00:00";
        if(isHostNow){
          try{
            const roomSnap = await getDoc(roomRef);
            const roundId = String(roomSnap.data().round||0);
            await updateDoc(doc(db,"rooms",state.code,"rounds",roundId),{
              status:"vote",
              voteStartedAt: serverTimestamp()
            });
          }catch(e){ console.warn(e); }
        }
      }
    }, 250);
  }

 function subscribeChat(roundId){
  if (unsubscribeChat) unsubscribeChat();

  // Consulta ordenada por 'at' ascendente para tener orden estable y nanosegundos
  const q = query(
    collection(db,"rooms",state.code,"rounds",String(roundId),"chat"),
    orderBy('at','asc')
  );

  // Limpiá una sola vez al iniciar la ronda
  ui.chatList.innerHTML = '';

  unsubscribeChat = onSnapshot(q, (snap)=>{
    snap.docChanges().forEach(change=>{
      const d = change.doc;
      const m = { id:d.id, ...d.data() };

      if (change.type === 'added'){
        const isMine = m.uid === (auth.currentUser && auth.currentUser.uid);
        appendChatMessage(ui.chatList, m, isMine);
      }
      else if (change.type === 'removed'){
        const el = ui.chatList.querySelector(`[data-msg-id="${m.id}"]`);
        if (el) el.remove();
      }
      else if (change.type === 'modified'){
        // si querés, podrías actualizar el texto; lo usual es no modificar mensajes
      }
    });
  });
}


  function subscribeRoundPhase(roundId){
    if (unsubscribeRoundPhase) unsubscribeRoundPhase();

    const rRef = doc(db,"rooms",state.code,"rounds",String(roundId));
    unsubscribeRoundPhase = onSnapshot(rRef, async (rdoc)=>{
      if(!rdoc.exists()) return;

      roundState = rdoc.data();
      const phase = roundState.status;
      const discussPanel = document.getElementById("phaseDiscuss");

      if(phase==="reveal"){
        discussPanel.style.display="none";
      }

      if(phase==="results"){
        document.getElementById("phaseDiscuss").style.display="block";
        ui.turnHint.textContent = "Resultados";
        timerBox.textContent = "";

        const rRef2 = doc(db,"rooms",state.code,"rounds",String(currentRound));
        const roundId2 = String(currentRound);

        if(isHost && !roundState.resultsComputed){
          try{
            const { expelledUid, tie, counts } = await tallyVotes(roundId2);
            await updateDoc(rRef2, { resultsComputed: true, expelledUid: expelledUid || null, tie: !!tie, counts });
            if(expelledUid){
              await updateDoc(doc(db,"rooms",state.code,"assignments",expelledUid), { alive:false });
            }
          }catch(e){ console.warn("Error al computar resultados:", e); }
        }

        setTimeout(async ()=>{
          try{
            const rDoc = await getDoc(rRef2);
            const rData = rDoc.data()||{};
            const tie = !!rData.tie;
            const expelledUid = rData.expelledUid || null;

            if(tie || !expelledUid){
              showResultsOverlayUI({
                title: "Empate — Nadie fue expulsado",
                subtitle: "Se jugará otra ronda con nueva palabra.",
                color: "#ffd166"
              });
            }else{
              const asg = await getAssignment(expelledUid);
              const nombre = asg?.name || "Jugador";
              const rol = asg?.role || "—";
              showResultsOverlayUI({
                title: `Eliminado: ${nombre}`,
                subtitle: `Rol: ${rol}`,
                color: rol==="IMPOSTOR" ? "#ff6b6b" : "#cfe4ff"
              });
            }
          }catch(e){ console.warn(e); }
        }, 250);

        setTimeout(async ()=>{
          hideResultsOverlayUI();
          if(isHost){
            try{ await startNextRoundKeepingRoles(); }catch(e){ console.warn(e); }
          }
        }, 6000);
      }

      if(phase==="draw"){
        // SOLO mostramos sorteo en ronda 1
        if(currentRound===1 && drawPlayedForRound!==roundId){
          drawPlayedForRound=roundId;
          startDrawAnimation(roundState.order||[]);
        }
      }

      if(phase==="prompt"){
        discussPanel.style.display="block";
        document.getElementById("firstWordTip").style.display="none"; /* oculto tip si no lo usás */
        ui.chatInput.placeholder="Primero UNA palabra (2–24 letras)…";
        const idx=roundState.turnIndex??0;
        const uidTurno=(roundState.order||[])[idx];
        ui.turnHint.textContent = uidTurno ? `Turno de: ${await nameOf(uidTurno)}` : "";
        if(uidTurno){
  const nombreTurno = await nameOf(uidTurno);
  showGraffitiTurn(nombreTurno);
}

        timerBox.textContent = "";
      }

      if(phase==="discuss"){
        discussPanel.style.display="block";
        document.getElementById("firstWordTip").style.display="none";
        ui.turnHint.textContent="Chat libre";
        ui.chatInput.placeholder="Decí tu pista/suspecha (3s cooldown)";
        startDiscussCountdown(roundState, isHost);
      }

      if(phase==="vote"){
        discussPanel.style.display="block";
        ui.turnHint.textContent="Votación";
        timerBox.textContent = "";
        renderVoteBar();
      }
    });
  }

  // Detectar cambio de ronda desde rooms y enganchar suscripciones de la ronda
  onSnapshot(roomRef, async s=>{
    if(!s.exists()) return;
    const data = s.data();
    const newRound = data.round || 0;

    if(newRound && newRound !== currentRound){
      currentRound = newRound;
      subscribeChat(currentRound);
      subscribeFirstWords(currentRound);
      subscribeRoundPhase(currentRound);
      subscribeSidePlayers(); 
    }else{
      currentRound = newRound;
    }
  });

  // Fallbacks de fase (host) — SOLO ronda 1
  onSnapshot(roomRef, async (snap)=>{
    if(!snap.exists()||!isHost) return;
    const data=snap.data(); const rId=data.round||0; if(!rId) return;
    const rRef=doc(db,"rooms",state.code,"rounds",String(rId)); const rDoc=await getDoc(rRef); if(!rDoc.exists()) return;
    const r=rDoc.data();
    const toMs=(ts)=>ts?.toMillis?.()??(ts?.seconds?ts.seconds*1000:(typeof ts==="number"?ts:0));
    const now=Date.now(), createdMs=toMs(r.createdAt), drawMs=toMs(r.drawStartedAt);
    if (rId===1){
      if(r.status==="reveal" && createdMs && now-createdMs>11000) { try{ await updateDoc(rRef,{status:"draw",drawStartedAt:serverTimestamp()}); }catch{} }
      if(r.status==="draw" && drawMs && now-drawMs>20000) { try{ await updateDoc(rRef,{status:"prompt",promptStartedAt:serverTimestamp(),turnIndex:0}); }catch{} }
    }
  });

  // UI chat
  const ui={
    chatForm:document.getElementById("chatForm"),
    chatInput:document.getElementById("chatInput"),
    chatList:document.getElementById("chatList"),
    voteBar:document.getElementById("voteBar"),
    cooldownHint:document.getElementById("cooldownHint"),
    turnHint:document.getElementById("turnHint"),
  };

  // ===== LATERAL DE JUGADORES (debate): vivo / eliminado =====
const sidePlayersEl = document.getElementById("sidePlayers");
let unsubSidePlayers = null;

function renderSidePlayers(assignments){
  if(!sidePlayersEl) return;
  // Orden por nombre (vivos arriba)
  const ordered = assignments
    .slice()
    .sort((a,b)=>{
      const av = (a.alive!==false), bv=(b.alive!==false);
      if(av!==bv) return av? -1 : 1;
      return (a.name||"").localeCompare(b.name||"");
    });

  sidePlayersEl.innerHTML = ordered.map(p=>{
    const alive = p.alive !== false;
    const src = (p.avatarKey && AVATAR_MAP[p.avatarKey]) ? AVATAR_MAP[p.avatarKey] : "";
    return `
      <div class="side-player ${alive?'':'dead'}">
        <div class="ava">${src?`<img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover">`:''}</div>
        <div style="display:flex;flex-direction:column;gap:2px">
          <div class="name" title="${(p.role||'')}">
            <span class="dot ${alive?'alive':'dead'}"></span>${sanitize(p.name)||'Jugador'}
          </div>
          <div class="state-badge ${alive?'alive':'dead'}">
            ${alive ? 'Vivo' : 'Eliminado'}
          </div>
        </div>
      </div>`;
  }).join("");
}

// Suscripción en tiempo real a los assignments (roles/estado)
function subscribeSidePlayers(){
  if(unsubSidePlayers) unsubSidePlayers();
  unsubSidePlayers = onSnapshot(
    collection(db,"rooms",state.code,"assignments"),
    snap=>{
      const arr = snap.docs.map(d=>d.data());
      renderSidePlayers(arr);
    }
  );
}


  let cooldownUntil=0;
  function canSendNow(){
    const now=Date.now();
    if(roundState?.status==="prompt") return true;
    if(now<cooldownUntil){ const left=Math.ceil((cooldownUntil-now)/1000); ui.cooldownHint.textContent=`Esperá ${left}s para volver a enviar`; return false; }
    ui.cooldownHint.textContent=""; return true;
  }
  function isOneWordLatin(str){ return /^\p{L}{2,24}$/u.test(str); }
  function showError(msg){
    ui.cooldownHint.textContent=msg; ui.cooldownHint.style.color="#ff7b7b";
    ui.chatInput.style.outline="2px solid #ff7b7b";
    setTimeout(()=>{ ui.cooldownHint.style.color=""; ui.chatInput.style.outline=""; },1800);
  }

  document.getElementById("chatForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    if(!roundState) { showError("No hay ronda activa."); return; }
    const raw=(ui.chatInput.value||"").trim(); if(!raw) return;
    const myUid=auth.currentUser?.uid;
    const roundId=String(currentRound);

    try{
      if(roundState.status==="prompt"){
        const idx=roundState.turnIndex??0; const order=roundState.order||[]; const uidTurno=order[idx];

        if(!myUid || !uidTurno || String(myUid)!==String(uidTurno)){
          const name = uidTurno ? await nameOf(uidTurno) : "alguien";
          showError(`Esperá tu turno. Ahora: ${name}.`); return;
        }
        if(!isOneWordLatin(raw)){ showError("Enviá UNA sola palabra (2–24 letras, sin espacios)."); return; }

        if(firstWordsMap.has(myUid)){ showError("Ya enviaste tu palabra. Esperá que avance el turno."); return; }

        await setDoc(doc(db,"rooms",state.code,"rounds",roundId,"firstWords",myUid),{
          uid:myUid, name:getStoredName(), text:raw, at:serverTimestamp()
        });
        const msgRef=doc(collection(db,"rooms",state.code,"rounds",roundId,"chat"));
        await setDoc(msgRef,{ uid:myUid, name:getStoredName(), text:raw, at:serverTimestamp(), kind:"firstword" });
        ui.chatInput.value="";
        return;
      }

      if(roundState.status==="discuss"){
        if(!canSendNow()) return;
        const msgRef=doc(collection(db,"rooms",state.code,"rounds",roundId,"chat"));
        await setDoc(msgRef,{ uid:myUid, name:getStoredName(), text:raw, at:serverTimestamp(), kind:"chat" });
        ui.chatInput.value=""; cooldownUntil=Date.now()+3000; canSendNow(); return;
      }

      showError("No podés enviar ahora.");

    }catch(e){
      console.error(e);
      showError(`Error al enviar: ${e?.message||e}`);
    }
  });

  // Votación
 async function renderVoteBar(){
  const myUid = auth.currentUser?.uid;
  const asgSnap = await getDocs(collection(db,"rooms",state.code,"assignments"));
  const players = asgSnap.docs
    .map(d=>d.data())
    .filter(p => p.alive !== false && p.uid !== myUid); // ⬅️ no me incluyo

  const bar = document.getElementById("voteBar");
  if(!bar) return;

  // Leo si ya voté para resaltar
  const roomSnap = await getDoc(roomRef);
  const roundId = String(roomSnap.data().round || 0);
  let chosen = null;
  try{
    const myVoteDoc = await getDoc(doc(db,"rooms",state.code,"rounds",roundId,"votes",myUid));
    chosen = myVoteDoc.exists() ? (myVoteDoc.data()?.target || null) : null;
  }catch{}

  bar.innerHTML = players.map(p=>{
    const src = (p.avatarKey && AVATAR_MAP[p.avatarKey]) ? AVATAR_MAP[p.avatarKey] : "";
    const cls = `btn vote-item ${chosen===p.uid ? 'chosen' : ''}`;
    return `
      <button class="${cls}" data-vote="${p.uid}">
        <span class="vote-avatar">
          ${src ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover">` : `${icon("i-ball")}`}
        </span>
        ${sanitize(p.name)||"Jugador"}
      </button>`;
  }).join("");

  // Listeners
  bar.querySelectorAll("[data-vote]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const targetUid = btn.getAttribute("data-vote");
      try{
        const myVoteRef = doc(db,"rooms",state.code,"rounds",roundId,"votes",myUid);
        await setDoc(myVoteRef, { voter: myUid, target: targetUid, at: serverTimestamp() });
        // feedback inmediato
        bar.querySelectorAll(".vote-item").forEach(b=>b.classList.remove("chosen"));
        btn.classList.add("chosen");
      }catch(e){ console.warn(e); }
    });
  });
}


  // Cierre auto de votación cuando todos votan
  onSnapshot(roomRef, async s=>{
    if(!s.exists()) return;
    const data = s.data();
    const roundId = data.round || 0;

    onSnapshot(collection(db,"rooms",state.code,"rounds",String(roundId),"votes"), async snap=>{
        try{ await renderVoteBar(); }catch{}
      const voted = new Set(snap.docs.map(d=>d.id));
      const asgSnap = await getDocs(collection(db,"rooms",state.code,"assignments"));
      const aliveVoters = asgSnap.docs
        .map(d=>d.data())
        .filter(p => p.alive !== false)
        .map(p => p.uid)
        .filter(Boolean);

      if (isHost && aliveVoters.length > 0 && aliveVoters.every(id => voted.has(id))){
        await updateDoc(doc(db,"rooms",state.code,"rounds",String(roundId)),{
          status:"results",
          resultsAt: serverTimestamp()
        });
      }
    });
  });

  document.getElementById("copyBtn").addEventListener("click", async ()=>{
  try{ await navigator.clipboard.writeText(state.code); showToast("Código copiado"); }
  catch{ showToast("No pude copiar"); }
});


  document.getElementById("shareBtn").addEventListener("click", async ()=>{
    const joinUrl=`${location.origin}/ingresar.html?code=${state.code}`;
    if(navigator.share){ try{ await navigator.share({title:"Unite a mi sala", text:`Código ${state.code}`, url:joinUrl}); }catch{} }
    else { try{ await navigator.clipboard.writeText(joinUrl); showToast("🔗 Enlace copiado"); }catch{ alert(joinUrl); } }
  });
// =======================
//  LOBBY CHAT (Realtime)
// =======================
const lobbyUI = {
  list: document.getElementById("lobbyChatList"),
  form: document.getElementById("lobbyChatForm"),
  input: document.getElementById("lobbyChatInput"),
};

let unsubLobbyChat = null;
let lobbyCooldownUntil = 0;

function canSendLobbyNow(){
  const now = Date.now();
  if (now < lobbyCooldownUntil) return false;
  return true;
}

function renderLobbyMessages(items){
  lobbyUI.list.innerHTML = items.map(m => {
    const mine = m.uid === (auth.currentUser && auth.currentUser.uid);
    return `
      <div class="msg-row" style="${mine ? 'justify-content:flex-end' : 'justify-content:flex-start'}">
        <div class="msg ${mine ? 'mine' : ''}">
          <div class="name">${sanitize(m.name) || "Jugador"}</div>
          <div>${sanitize(m.text || "")}</div>
        </div>
      </div>`;
  }).join("");
  lobbyUI.list.scrollTop = lobbyUI.list.scrollHeight;
}

function subscribeLobbyChat(){
  if (unsubLobbyChat) unsubLobbyChat();

  const q = query(collection(db, "rooms", state.code, "lobbyChat"), orderBy('at','asc'));
  lobbyUI.list.innerHTML = '';

  unsubLobbyChat = onSnapshot(q, (snap)=>{
    snap.docChanges().forEach(change=>{
      const d = change.doc;
      const m = { id:d.id, ...d.data() };

      if (change.type === 'added'){
        const mine = m.uid === (auth.currentUser && auth.currentUser.uid);
        const row = document.createElement('div');
        row.className = 'msg-row';
        row.style.justifyContent = mine ? 'flex-end' : 'flex-start';
        row.dataset.msgId = m.id || '';

        const bubble = document.createElement('div');
        bubble.className = `msg ${mine ? 'mine' : ''}`;
        bubble.innerHTML = `<div class="name">${sanitize(m.name)||'Jugador'}</div><div>${sanitize(m.text||'')}</div>`;
        row.appendChild(bubble);

        const wasAtBottom = (lobbyUI.list.scrollTop + lobbyUI.list.clientHeight + 8) >= lobbyUI.list.scrollHeight;
        lobbyUI.list.appendChild(row);
        if (wasAtBottom) lobbyUI.list.scrollTop = lobbyUI.list.scrollHeight;
      }
      else if (change.type === 'removed'){
        lobbyUI.list.querySelector(`[data-msg-id="${m.id}"]`)?.remove();
      }
    });
  });
}


lobbyUI.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = (lobbyUI.input.value || "").trim();
  if (!raw) return;

  // Anti-spam suave: 1.5s entre mensajes por usuario
  if (!canSendLobbyNow()){
    // feedback mínimo en el placeholder
    const ph = lobbyUI.input.placeholder;
    lobbyUI.input.placeholder = "Esperá un toque…";
    setTimeout(()=> lobbyUI.input.placeholder = ph, 1200);
    return;
  }

  // Longitud y sanitización básica
  if (raw.length > 180){
    alert("Máximo 180 caracteres.");
    return;
  }

  try{
    const myUid = auth.currentUser?.uid;
    const msgRef = doc(collection(db, "rooms", state.code, "lobbyChat"));
    await setDoc(msgRef, {
      uid: myUid || "anon",
      name: getStoredName(),
      text: raw,
      at: serverTimestamp(),
      kind: "chat"
    });
    lobbyUI.input.value = "";
    lobbyCooldownUntil = Date.now() + 1500;
  }catch(e){
    console.warn("Error enviando lobby msg:", e);
    alert("No pude enviar el mensaje.");
  }
});

// arrancamos la suscripción cuando ya tenemos código de sala
subscribeLobbyChat();
</script>
