// ===== eliminarSalas.js =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-app.js";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";

// ⚙️ Reemplazá estos valores con los de tu Firebase actual
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🔥 Función para eliminar todas las salas en la colección "rooms"
async function eliminarTodasLasSalas() {
  try {
    const querySnapshot = await getDocs(collection(db, "rooms"));
    let total = 0;

    for (const sala of querySnapshot.docs) {
      await deleteDoc(doc(db, "rooms", sala.id));
      console.log(`✅ Eliminada sala: ${sala.id}`);
      total++;
    }

    console.log(`🔥 Proceso completo. ${total} salas eliminadas.`);
    alert(`Se eliminaron ${total} salas correctamente.`);
  } catch (error) {
    console.error("❌ Error al eliminar las salas:", error);
    alert("Ocurrió un error al eliminar las salas. Revisá la consola.");
  }
}

// Ejecutar automáticamente al abrir el archivo
eliminarTodasLasSalas();
