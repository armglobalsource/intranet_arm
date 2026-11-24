import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { EventActor } from './event-program.rules';
import { EventCategoryDto, EventDiscountCodeDto, SaveEventProgramDto } from './event-program.dto';
import { CodeLookupDto } from './event-registration.dto';
import { Throttle } from '@nestjs/throttler';
import { EventProgramService } from './event-program.service';
@Controller('event-management')
export class EventProgramController {
 constructor(private readonly service:EventProgramService){}
 @Get('options') options(@CurrentUser() u:EventActor){return this.service.options(u);}
 @Get() list(@CurrentUser() u:EventActor){return this.service.list(u);}
 @Post('categories') category(@CurrentUser() u:EventActor,@Body() d:EventCategoryDto){return this.service.category(u,d);}
 @Patch('categories/:id') editCategory(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string,@Body() d:EventCategoryDto){return this.service.category(u,d,id);}
 @Get(':id') get(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string){return this.service.get(u,id);}
 @Post() create(@CurrentUser() u:EventActor,@Body() d:SaveEventProgramDto){return this.service.save(u,d);}
 @Patch(':id') update(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string,@Body() d:SaveEventProgramDto){return this.service.save(u,d,id);}
 @Post(':id/duplicate') duplicate(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string){return this.service.duplicate(u,id);}
 @Get(':id/codes') codes(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string){return this.service.codes(u,id);}
 @Post(':id/codes') addCode(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string,@Body() d:EventDiscountCodeDto){return this.service.saveCode(u,id,d);}
 @Patch(':id/codes/:codeId') editCode(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string,@Param('codeId',ParseUUIDPipe) codeId:string,@Body() d:EventDiscountCodeDto){return this.service.saveCode(u,id,d,codeId);}
}
@Controller('public-events')
export class PublicEventProgramController {
 constructor(private readonly service:EventProgramService){}
 @Public() @Get() list(){return this.service.publicList();}
 @Public() @Get(':slug') get(@Param('slug') slug:string){return this.service.publicEvent(slug);}
 @Public() @Post(':slug/code') @Throttle({default:{limit:10,ttl:60000}}) code(@Param('slug') slug:string,@Body() d:CodeLookupDto){return this.service.lookupCode(slug,d.code);}
}
