import { Injectable, OnModuleInit } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CreatePaletaDto } from './dto/paleta.dto';

const COL = 'paletas';

// ── Paletas iniciales (seed) ───────────────────────────────────────────────────
// Extraídas del PDF de outfits ARW. Se crean automáticamente si la colección
// está vacía en el primer arranque.

const SEED_PALETAS = [
  {
    id: 'navy',
    name: 'Navy',
    colors: [
      { name: 'Deep Cove',    hex: '#0B0E2A' },
      { name: 'Cadet Blue',   hex: '#8A8FAA' },
      { name: 'Biscay',       hex: '#263B6D' },
      { name: 'Akaroa',       hex: '#BDA98C' },
      { name: 'Orange White', hex: '#FEF9EC' },
    ],
    order:  0,
    active: true,
  },
  {
    id: 'tierra',
    name: 'Tierra / Coral',
    colors: [
      { name: 'Domino',      hex: '#8A6045' },
      { name: 'Stark White', hex: '#EBE5D8' },
      { name: 'Coral',       hex: '#E85D2A' },
      { name: 'Cod Gray',    hex: '#111111' },
      { name: 'Zorba',       hex: '#9B9170' },
    ],
    order:  1,
    active: true,
  },
  {
    id: 'verde',
    name: 'Verde',
    colors: [
      { name: 'Watercourse',  hex: '#3B7B8D' },
      { name: 'Peat',         hex: '#7A6342' },
      { name: 'Nomad',        hex: '#B3A99A' },
      { name: 'Cabbage Pont', hex: '#2E5C3E' },
      { name: 'Stark White',  hex: '#EBE5D8' },
    ],
    order:  2,
    active: true,
  },
  {
    id: 'gris',
    name: 'Neutros / Gris',
    colors: [
      { name: 'Cape Cod',      hex: '#3D3F40' },
      { name: 'Rolling Stone', hex: '#686F70' },
      { name: 'Pumice',        hex: '#C0C0C0' },
      { name: 'Mine Shaft',    hex: '#222222' },
      { name: 'Desert Storm',  hex: '#F0F0EE' },
    ],
    order:  3,
    active: true,
  },
];

@Injectable()
export class PaletasService implements OnModuleInit {
  constructor(private fb: FirebaseService) {}

  /** Auto-seed: si la colección está vacía, carga las paletas iniciales */
  async onModuleInit() {
    try {
      const snap = await this.fb.db.collection(COL).limit(1).get();
      if (snap.empty) {
        const batch = this.fb.db.batch();
        for (const p of SEED_PALETAS) {
          const ref = this.fb.db.collection(COL).doc(p.id);
          batch.set(ref, { ...p, createdAt: this.fb.now() });
        }
        await batch.commit();
      }
    } catch {
      // No bloquear el arranque si Firestore falla
    }
  }

  /** GET /paletas — devuelve paletas activas ordenadas */
  async findAll() {
    // Sin compound query para evitar requerir índice compuesto en Firestore.
    const snap = await this.fb.db.collection(COL).get();
    const all = this.fb.toDocs(snap) as any[];
    return all
      .filter((p) => p.active !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  /** POST /paletas — crea una nueva paleta */
  async create(dto: CreatePaletaDto) {
    // Calcular el siguiente order
    const snap = await this.fb.db.collection(COL).get();
    const maxOrder = snap.docs.reduce((max, d) => Math.max(max, d.data().order ?? 0), -1);

    // Generar id desde el nombre (slug)
    const id = dto.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36); // sufijo para evitar colisiones

    const data = {
      id,
      name:      dto.name,
      colors:    dto.colors,
      order:     maxOrder + 1,
      active:    true,
      createdAt: this.fb.now(),
    };

    await this.fb.db.collection(COL).doc(id).set(data);
    return data;
  }
}
