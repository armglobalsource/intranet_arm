import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// El config del Client SDK de Firebase es público por diseño (se embebe en el bundle JS
// del cliente). Los valores de env tienen prioridad; los literales son el fallback para
// builds de Docker donde las NEXT_PUBLIC_* no se pasan como ARG.
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? 'AIzaSyDEKvQ-XzSPA1JMhQMq_phXKxqvXqPcEVM',
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? 'intranet-arm-dev-70a30.firebaseapp.com',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? 'intranet-arm-dev-70a30',
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? 'intranet-arm-dev-70a30.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '1065052048117',
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? '1:1065052048117:web:c9dfa55f1949126fa7d3bc',
};

// Evitar inicializar múltiples veces en hot-reload de Next.js
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const clientDb = getFirestore(app);
