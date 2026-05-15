import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';

@Injectable()
export class SearchService {
  constructor(private fb: FirebaseService) {}

  async globalSearch(query: string, _userId: number) {
    if (!query || query.trim().length < 2) return { users: [], content: [], documents: [] };
    const q = query.trim().toLowerCase();

    const [usersSnap, contentSnap, docsSnap] = await Promise.all([
      this.fb.db.collection('users').where('status', '==', 'active').get(),
      this.fb.db.collection('content').where('status', '==', 'published').get(),
      this.fb.db.collection('documents').where('status', '==', 'active').get(),
    ]);

    const users = this.fb.toDocs(usersSnap)
      .filter((u) =>
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q)  ||
        (u.jobTitles ?? []).some((jt: any) => jt.name?.toLowerCase().includes(q)),
      )
      .slice(0, 10)
      .map(({ id, firstName, lastName, avatarUrl, jobTitles }) => ({
        id, firstName, lastName, avatarUrl,
        jobTitle: jobTitles?.[0]?.name ?? null,
      }));

    const content = this.fb.toDocs(contentSnap)
      .filter((c) =>
        c.title?.toLowerCase().includes(q) ||
        c.excerpt?.toLowerCase().includes(q),
      )
      .slice(0, 10)
      .map(({ id, title, slug, excerpt, type, publishedAt }) => ({ id, title, slug, excerpt, type, publishedAt }));

    const documents = this.fb.toDocs(docsSnap)
      .filter((d) =>
        d.name?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q),
      )
      .slice(0, 10)
      .map(({ id, name, description, mimeType, sizeBytes }) => ({ id, name, description, mimeType, sizeBytes }));

    return { users, content, documents, query };
  }
}
