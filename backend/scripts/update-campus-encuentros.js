/**
 * update-campus-encuentros.js
 * Actualiza el campo `encuentrosConfig` de los 8 campus en Firestore
 * con la estructura correcta extraída de las fichas PDF reales.
 *
 * Ejecutar desde /backend:
 *   node scripts/update-campus-encuentros.js
 */

const admin = require('firebase-admin');
const path  = require('path');

const SA = path.resolve(__dirname, '../service-account.json');
admin.initializeApp({ credential: admin.credential.cert(SA) });
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────────────────────
// Colores por slot de encuentro (consistentes con el editor)
// ─────────────────────────────────────────────────────────────────────────────
const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

function mkEncuentro(id, label, time, color, isLive = false) {
  return { id, label, time, isLive, color };
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuración real de cada campus (basada en los 13 PDFs reales)
// ─────────────────────────────────────────────────────────────────────────────
const campusConfig = {
  // Firestore document ID : 1  (campus "Santiago")
  '1': {
    encuentrosConfig: [
      {
        dia:  'Miércoles',
        tipo: 'unico',
        encuentros: [
          mkEncuentro('unico', 'Miércoles EN VIVO · 20:00', '20:00', COLORS[0], true),
        ],
      },
      {
        dia:  'Domingo Bloque I',
        tipo: 'multi',
        encuentros: [
          mkEncuentro('e1', 'Encuentro I · 9:00',   '09:00', COLORS[0]),
          mkEncuentro('e2', 'Encuentro II · 11:00', '11:00', COLORS[1]),
          mkEncuentro('e3', 'Encuentro III · 13:00','13:00', COLORS[2]),
        ],
      },
      {
        dia:  'Domingo Bloque II',
        tipo: 'multi',
        encuentros: [
          mkEncuentro('e1', 'Encuentro IV · 17:00', '17:00', COLORS[3]),
          mkEncuentro('e2', 'Encuentro V · 19:00',  '19:00', COLORS[4]),
        ],
      },
    ],
  },

  // '2' = Puente Alto
  '2': {
    encuentrosConfig: [
      {
        dia:  'Domingo Bloque I',
        tipo: 'unico',
        encuentros: [
          mkEncuentro('unico', 'Encuentro I · 11:00', '11:00', COLORS[0]),
        ],
      },
      {
        dia:  'Domingo Bloque II',
        tipo: 'unico',
        encuentros: [
          mkEncuentro('unico', 'Encuentro II · 18:00', '18:00', COLORS[1]),
        ],
      },
      {
        dia:  'Jueves',
        tipo: 'unico',
        encuentros: [
          mkEncuentro('unico', 'Jueves EN VIVO · 20:00', '20:00', COLORS[2], true),
        ],
      },
    ],
  },

  // '3' = Concepción
  '3': {
    encuentrosConfig: [
      {
        dia:  'Sábado',
        tipo: 'unico',
        encuentros: [
          mkEncuentro('unico', 'Sábado · 17:30', '17:30', COLORS[0]),
        ],
      },
    ],
  },

  // '4' = Punta Arenas
  '4': {
    encuentrosConfig: [
      {
        dia:  'Domingo Bloque I',
        tipo: 'unico',
        encuentros: [
          mkEncuentro('unico', 'Encuentro I · 11:00', '11:00', COLORS[0]),
        ],
      },
      {
        dia:  'Domingo Bloque II',
        tipo: 'unico',
        encuentros: [
          mkEncuentro('unico', 'Encuentro II · 18:00', '18:00', COLORS[1]),
        ],
      },
      {
        dia:  'Jueves',
        tipo: 'unico',
        encuentros: [
          mkEncuentro('unico', 'Jueves EN VIVO · 19:30', '19:30', COLORS[2], true),
        ],
      },
    ],
  },

  // '5' = La Plata
  '5': {
    encuentrosConfig: [
      {
        dia:  'Domingo',
        tipo: 'unico',
        encuentros: [
          mkEncuentro('unico', 'Domingo · 11:00', '11:00', COLORS[0]),
        ],
      },
    ],
  },

  // '6' = Montevideo
  '6': {
    encuentrosConfig: [
      {
        dia:  'Domingo Bloque I',
        tipo: 'unico',
        encuentros: [
          mkEncuentro('unico', 'Encuentro I · 11:00', '11:00', COLORS[0]),
        ],
      },
      {
        dia:  'Domingo Bloque II',
        tipo: 'unico',
        encuentros: [
          mkEncuentro('unico', 'Encuentro II · 18:00', '18:00', COLORS[1]),
        ],
      },
      {
        dia:  'Jueves',
        tipo: 'unico',
        encuentros: [
          mkEncuentro('unico', 'Jueves EN VIVO · 20:00', '20:00', COLORS[2], true),
        ],
      },
    ],
  },

  // '7' = Katy
  '7': {
    encuentrosConfig: [
      {
        dia:  'Domingo',
        tipo: 'unico',
        encuentros: [
          mkEncuentro('unico', 'Domingo · 11:30', '11:30', COLORS[0]),
        ],
      },
    ],
  },

  // '8' = Maracaibo
  '8': {
    encuentrosConfig: [
      {
        dia:  'Domingo Bloque I',
        tipo: 'unico',
        encuentros: [
          mkEncuentro('unico', 'Encuentro I · 11:00', '11:00', COLORS[0]),
        ],
      },
      {
        dia:  'Domingo Bloque II',
        tipo: 'unico',
        encuentros: [
          mkEncuentro('unico', 'Encuentro II · 18:00', '18:00', COLORS[1]),
        ],
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  const col = db.collection('campuses');
  const snap = await col.get();

  for (const doc of snap.docs) {
    const id  = doc.id;
    const cfg = campusConfig[id];
    if (!cfg) {
      console.log(`⚠️  Campus ${id} (${doc.data().name}) — sin config, se omite`);
      continue;
    }
    await doc.ref.update({ encuentrosConfig: cfg.encuentrosConfig });
    console.log(`✅ Campus ${id} (${doc.data().name}) actualizado — ${cfg.encuentrosConfig.length} día(s)`);
  }

  console.log('\n🎉 Actualización completa.');
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
