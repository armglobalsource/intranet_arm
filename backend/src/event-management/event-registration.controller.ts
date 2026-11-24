import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EventActor } from './event-program.rules';
import { RegistrationAccessDto, RegistrationDto, SelfCancelDto, TicketsLinkDto, TicketsTokenDto, TransferDto } from './event-registration.dto';
import { EventRegistrationService } from './event-registration.service';
@Controller()
export class EventRegistrationController {
 constructor(private readonly service:EventRegistrationService){}
 @Post('event-management/payments/check') @Throttle({default:{limit:5,ttl:60000}})
 check(@CurrentUser() u:EventActor){return this.service.checkPayments(u);}
 @Public() @Post('public-events/:slug/registrations') @Throttle({default:{limit:5,ttl:60000}})
 register(@Param('slug') slug:string,@Body() dto:RegistrationDto){return this.service.register(slug,dto);}
 @Public() @Post('event-registrations/:id/status')
 status(@Param('id',ParseUUIDPipe) id:string,@Body() d:RegistrationAccessDto){return this.service.get(id,d.token);}
 @Public() @Post('event-registrations/:id/checkout') @Throttle({default:{limit:5,ttl:60000}})
 checkout(@Param('id',ParseUUIDPipe) id:string,@Body() d:RegistrationAccessDto){return this.service.checkout(id,d.token);}
 @Public() @Post('event-registrations/:id/email') @Throttle({default:{limit:2,ttl:60000}})
 email(@Param('id',ParseUUIDPipe) id:string,@Body() d:RegistrationAccessDto){return this.service.resend(id,d.token);}
 @Public() @Post('event-payments/webhook')
 webhook(@Query('data.id') id:string,@Headers('x-request-id') requestId:string,@Headers('x-signature') signature:string){return this.service.webhook(id??'',requestId??'',signature??'');}
 @Post('event-management/:id/registrations/:registrationId/verify-payment') @Throttle({default:{limit:10,ttl:60000}})
 verify(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string,@Param('registrationId',ParseUUIDPipe) registrationId:string){return this.service.verifyPayment(u,id,registrationId);}
 @Public() @Post('event-registrations/:id/tickets/:ticketId/transfer') @Throttle({default:{limit:5,ttl:60000}})
 transfer(@Param('id',ParseUUIDPipe) id:string,@Param('ticketId',ParseUUIDPipe) ticketId:string,@Body() d:TransferDto){return this.service.transfer(id,d.token,ticketId,d);}
 @Public() @Post('event-registrations/:id/cancel') @Throttle({default:{limit:5,ttl:60000}})
 cancel(@Param('id',ParseUUIDPipe) id:string,@Body() d:SelfCancelDto){return this.service.cancelBySelf(id,d.token,d.ticketId);}
 @Public() @Post('my-tickets/link') @Throttle({default:{limit:3,ttl:60000}})
 ticketsLink(@Body() d:TicketsLinkDto){return this.service.sendTicketsLink(d.email);}
 @Public() @Post('my-tickets') @Throttle({default:{limit:20,ttl:60000}})
 myTickets(@Body() d:TicketsTokenDto){return this.service.myTickets(d.token);}
 /** Vercel Cron: lista de espera y recordatorios, una vez al día. */
 @Public() @Get('event-reminders/run') @Throttle({default:{limit:5,ttl:60000}})
 daily(@Headers('authorization') auth:string){this.service.assertCron(auth);return this.service.runDaily();}
}
