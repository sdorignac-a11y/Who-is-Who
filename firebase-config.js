// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ⚠️ Reemplazá por tu config si cambia
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

// Persistencia en el navegador
await setPersistence(auth, browserLocalPersistence);

// Garantiza que siempre haya un usuario anónimo
export async function ensureAuth(){
  const user = await new Promise((resolve) => {
    const un = onAuthStateChanged(auth, (u) => { un(); resolve(u); });
  });
  return user || (await signInAnonymously(auth)).user;
}

export { app, auth, db };
