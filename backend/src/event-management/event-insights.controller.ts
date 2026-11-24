import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { EventActor } from './event-program.rules';
import { EventMessageDto, RefundDto, SurveyAccessDto, SurveyAnswerDto } from './event-insights.dto';
import { EventInsightsService } from './event-insights.service';

@Controller()
export class EventInsightsController {
 constructor(private readonly service:EventInsightsService){}
 @Get('event-management/:id/sales')
 sales(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string){return this.service.sales(u,id);}
 @Post('event-management/:id/registrations/:registrationId/refund') @Throttle({default:{limit:10,ttl:60000}})
 refund(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string,@Param('registrationId',ParseUUIDPipe) r:string,@Body() d:RefundDto){return this.service.refund(u,id,r,d.wholeOrder);}
 @Get('event-management/:id/messages')
 messages(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string){return this.service.messages(u,id);}
 @Post('event-management/:id/messages') @Throttle({default:{limit:20,ttl:60000}})
 send(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string,@Body() d:EventMessageDto){return this.service.sendMessage(u,id,d);}
 @Get('event-management/:id/survey')
 survey(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string){return this.service.surveyResults(u,id);}
 @Post('event-management/:id/survey/send') @Throttle({default:{limit:3,ttl:60000}})
 sendSurvey(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string){return this.service.sendSurvey(id,u);}
 @Public() @Post('public-events/:slug/survey/check') @Throttle({default:{limit:20,ttl:60000}})
 check(@Param('slug') slug:string,@Body() d:SurveyAccessDto){return this.service.surveyInfo(slug,d.e,d.t);}
 @Public() @Post('public-events/:slug/survey') @Throttle({default:{limit:10,ttl:60000}})
 answer(@Param('slug') slug:string,@Body() d:SurveyAnswerDto){return this.service.answerSurvey(slug,d);}
}
