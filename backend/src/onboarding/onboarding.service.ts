import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CreateOnboardingDto, UpdateOnboardingDto } from './dto/onboarding.dto';

const COL = 'onboarding';

@Injectable()
export class OnboardingService {
  constructor(private fb: FirebaseService) {}

  async findAll(roleName?: string, isAdmin = false) {
    const snap = await this.fb.db.collection(COL).get();
    let docs = this.fb.toDocs(snap).filter((d: any) => d.isActive !== false);

    if (!isAdmin && roleName) {
      docs = docs.filter((d: any) =>
        Array.isArray(d.roleNames) && d.roleNames.includes(roleName),
      );
    }

    return docs.sort((a: any, b: any) => a.teamName.localeCompare(b.teamName));
  }

  async findAllAdmin() {
    const snap = await this.fb.db.collection(COL).get();
    return this.fb.toDocs(snap).sort((a: any, b: any) => a.teamName.localeCompare(b.teamName));
  }

  async findBySlug(slug: string) {
    const snap = await this.fb.db.collection(COL).where('slug', '==', slug).limit(1).get();
    if (snap.empty) throw new NotFoundException(`Onboarding "${slug}" no encontrado`);
    return this.fb.toObj(snap.docs[0]);
  }

  async create(dto: CreateOnboardingDto) {
    const snap = await this.fb.db.collection(COL).where('slug', '==', dto.slug).limit(1).get();
    if (!snap.empty) throw new ConflictException(`Ya existe un onboarding con slug "${dto.slug}"`);

    const id = await this.fb.nextId(COL);
    const doc = {
      id,
      teamName:     dto.teamName,
      slug:         dto.slug,
      welcomeTitle: dto.welcomeTitle  ?? null,
      welcomeText:  dto.welcomeText   ?? null,
      videoUrl:     dto.videoUrl      ?? null,
      emoji:        dto.emoji         ?? null,
      color:        dto.color         ?? null,
      roleNames:    dto.roleNames     ?? [],
      steps:        dto.steps         ?? [],
      isActive:     dto.isActive      ?? true,
      createdAt:    this.fb.now(),
      updatedAt:    this.fb.now(),
    };
    await this.fb.db.collection(COL).doc(String(id)).set(doc);
    return doc;
  }

  async update(id: number, dto: UpdateOnboardingDto) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Onboarding ${id} no encontrado`);

    const data: any = { updatedAt: this.fb.now() };
    const fields = ['teamName','slug','welcomeTitle','welcomeText','videoUrl','emoji','color','roleNames','steps','isActive'];
    for (const f of fields) {
      if ((dto as any)[f] !== undefined) data[f] = (dto as any)[f];
    }
    await this.fb.db.collection(COL).doc(String(id)).update(data);
    return this.fb.toObj(await this.fb.db.collection(COL).doc(String(id)).get());
  }

  async remove(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Onboarding ${id} no encontrado`);
    await this.fb.db.collection(COL).doc(String(id)).delete();
    return { id };
  }
}
