import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Search')
@ApiBearerAuth()
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Búsqueda global en usuarios, contenido y documentos' })
  @ApiQuery({ name: 'q', description: 'Texto a buscar (mínimo 2 caracteres)' })
  search(@Query('q') q: string, @CurrentUser() user: any) {
    return this.searchService.globalSearch(q, user.sub);
  }
}
