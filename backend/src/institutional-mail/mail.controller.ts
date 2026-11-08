import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateMailRequestDto, MailActionDto, MailVersionDto, ReviseMailRequestDto, WorkspaceActivateDto, WorkspacePlanDto } from './mail.dto';
import { MailActor } from './mail.rules';
import { InstitutionalMailService } from './mail.service';
import { WorkspaceService } from './workspace.service';
import { WorkspaceProvisioningService } from './workspace-provisioning.service';
import { Public } from '../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
function pageNumber(value='1') { const n=Number(value); if (!Number.isSafeInteger(n)||n<1||n>100000) throw new BadRequestException('Página inválida.'); return n; }
@Controller({path:'institutional-mail',version:'1'})
export class InstitutionalMailController {
  constructor(private readonly service: InstitutionalMailService, private readonly workspace: WorkspaceService, private readonly provisioning:WorkspaceProvisioningService) {}
  @Get('workspace') workspaceStatus(@CurrentUser() u: MailActor) { return this.workspace.status(u); }
  @Post('workspace/check') checkWorkspace(@CurrentUser() u: MailActor) { return this.workspace.check(u); }
  @Get('workspace/groups') workspaceGroups(@CurrentUser() u:MailActor) {return this.workspace.groups(u);}
  @Public() @Throttle({default:{ttl:60000,limit:5}})
  @Post('workspace/activate') activate(@Body() dto:WorkspaceActivateDto) {return this.provisioning.activate(dto.token,dto.password);}
  @Post(':id/workspace/execute') execute(@Param('id',ParseUUIDPipe) id:string,@Body() dto:WorkspacePlanDto,@CurrentUser() u:MailActor) {return this.provisioning.execute(id,dto,u);}
  @Post(':id/workspace/invite') invite(@Param('id',ParseUUIDPipe) id:string,@Body() dto:MailVersionDto,@CurrentUser() u:MailActor) {return this.provisioning.invite(id,dto.version,u);}
  @Post(':id/workspace/complete') completeWorkspace(@Param('id',ParseUUIDPipe) id:string,@Body() dto:MailActionDto,@CurrentUser() u:MailActor) {return this.provisioning.complete(id,dto,u);}
  @Get('options') options(@CurrentUser() u: MailActor) { return this.service.options(u); }
  @Get('accounts') accounts(@CurrentUser() u: MailActor,@Query('due') due: string,@Query('page') page: string) { return this.service.accounts(u,due==='true',pageNumber(page)); }
  @Get() list(@CurrentUser() u: MailActor,@Query('view') view='mine',@Query('status') status='',@Query('page') page: string) { return this.service.list(u,view,status,pageNumber(page)); }
  @Post() create(@CurrentUser() u: MailActor,@Body() dto: CreateMailRequestDto) { return this.service.create(dto,u); }
  @Get(':id') detail(@Param('id',ParseUUIDPipe) id: string,@CurrentUser() u: MailActor) { return this.service.detail(id,u); }
  @Patch(':id') revise(@Param('id',ParseUUIDPipe) id: string,@CurrentUser() u: MailActor,@Body() dto: ReviseMailRequestDto) { return this.service.revise(id,dto,u); }
  @Post(':id/actions') action(@Param('id',ParseUUIDPipe) id: string,@CurrentUser() u: MailActor,@Body() dto: MailActionDto) { return this.service.action(id,dto,u); }
}
