import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async globalSearch(query: string, userId: number) {
    if (!query || query.trim().length < 2) return { users: [], content: [], documents: [] };

    const tsQuery = query.trim().split(/\s+/).join(' & ');

    const [users, content, documents] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT id, first_name, last_name, job_title, avatar_url
        FROM users
        WHERE status = 'active'
          AND to_tsvector('spanish', coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(job_title,''))
              @@ to_tsquery('spanish', ${tsQuery})
        LIMIT 10
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT id, title, slug, excerpt, type, published_at
        FROM content
        WHERE status = 'published'
          AND search_vector @@ to_tsquery('spanish', ${tsQuery})
        ORDER BY ts_rank(search_vector, to_tsquery('spanish', ${tsQuery})) DESC
        LIMIT 10
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT id, name, description, mime_type, size_bytes
        FROM documents
        WHERE status = 'active'
          AND search_vector @@ to_tsquery('spanish', ${tsQuery})
        ORDER BY ts_rank(search_vector, to_tsquery('spanish', ${tsQuery})) DESC
        LIMIT 10
      `,
    ]);

    return { users, content, documents, query };
  }
}
