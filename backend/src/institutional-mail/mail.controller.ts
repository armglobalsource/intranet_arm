import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateMailRequestDto, MailActionDto, ReviseMailRequestDto } from './mail.dto';
import { MailActor } from './mail.rules';
import { InstitutionalMailService } from './mail.service';
function pageNumber(value='1') { const n=Number(value); if (!Number.isSafeInteger(n)||n<1||n>100000) throw new BadRequestException('Página inválida.'); return n; }
@Controller({path:'institutional-mail',version:'1'})
export class InstitutionalMailController {
  constructor(private readonly service: InstitutionalMailService) {}
  @Get('options') options(@CurrentUser() u: MailActor) { return this.service.options(u); }
  @Get('accounts') accounts(@CurrentUser() u: MailActor,@Query('due') due: string,@Query('page') page: string) { return this.service.accounts(u,due==='true',pageNumber(page)); }
  @Get() list(@CurrentUser() u: MailActor,@Query('view') view='mine',@Query('status') status='',@Query('page') page: string) { return this.service.list(u,view,status,pageNumber(page)); }
  @Post() create(@CurrentUser() u: MailActor,@Body() dto: CreateMailRequestDto) { return this.service.create(dto,u); }
  @Get(':id') detail(@Param('id',ParseUUIDPipe) id: string,@CurrentUser() u: MailActor) { return this.service.detail(id,u); }
  @Patch(':id') revise(@Param('id',ParseUUIDPipe) id: string,@CurrentUser() u: MailActor,@Body() dto: ReviseMailRequestDto) { return this.service.revise(id,dto,u); }
  @Post(':id/actions') action(@Param('id',ParseUUIDPipe) id: string,@CurrentUser() u: MailActor,@Body() dto: MailActionDto) { return this.service.action(id,dto,u); }
}
