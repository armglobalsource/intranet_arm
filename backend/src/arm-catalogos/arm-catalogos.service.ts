import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { ArmCatalogoTipo, CreateArmCatalogoDto, UpdateArmCatalogoDto } from './dto/arm-catalogo.dto';

const COL = 'arm_catalogos';

@Injectable()
export class ArmCatalogosService {
  constructor(private fb: FirebaseService) {}

  async findAll(tipo: ArmCatalogoTipo) {
    const snap = await this.fb.db.collection(COL).where('tipo', '==', tipo).get();
    return this.fb.toDocs(snap)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  }

  async findActive(tipo: ArmCatalogoTipo): Promise<{ key: string; label: string }[]> {
    const snap = await this.fb.db.collection(COL)
      .where('tipo', '==', tipo).where('isActive', '==', true).get();
    return this.fb.toDocs(snap)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
      .map((r) => ({ key: r.key, label: r.label }));
  }

  async findOne(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Catálogo con id ${id} no encontrado`);
    return this.fb.toObj(snap);
  }

  async create(dto: CreateArmCatalogoDto) {
    const key = dto.key.trim();
    const keyLower = key.toLowerCase();
    const snap = await this.fb.db.collection(COL)
      .where('tipo', '==', dto.tipo).where('keyLower', '==', keyLower).limit(1).get();
    if (!snap.empty) throw new ConflictException(`Ya existe la clave "${key}" en este catálogo`);

    const id = await this.fb.nextId(COL);
    const doc = {
      id,
      tipo:       dto.tipo,
      key,
      keyLower,
      label:      dto.label.trim(),
      sortOrder:  dto.sortOrder ?? 0,
      isActive:   true,
      createdAt:  this.fb.now(),
      updatedAt:  this.fb.now(),
    };
    await this.fb.db.collection(COL).doc(String(id)).set(doc);
    return this.fb.toObj(await this.fb.db.collection(COL).doc(String(id)).get());
  }

  async update(id: number, dto: UpdateArmCatalogoDto) {
    await this.findOne(id);
    const data: any = { updatedAt: this.fb.now() };
    if (dto.label     !== undefined) data.label     = dto.label.trim();
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive  !== undefined) data.isActive  = dto.isActive;

    await this.fb.db.collection(COL).doc(String(id)).update(data);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.fb.db.collection(COL).doc(String(id)).delete();
    return { id };
  }
}
