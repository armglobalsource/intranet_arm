import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EventActor } from './event-program.rules';
import { RegistrationAccessDto, RegistrationDto, SelfCancelDto, TicketsLinkDto, TicketsTokenDto, TransferDto } from './event-registration.dto';
import { EventRegistrationService } from './event-registration.service';
import { EventInsightsService } from './event-insights.service';
import { EventWalletService } from './event-wallet.service';
@Controller()
export class EventRegistrationController {
 constructor(private readonly service:EventRegistrationService,private readonly insights:EventInsightsService,private readonly wallet:EventWalletService){}
 /** Pase de Apple Wallet (.pkpass). El enlace firmado viene en el comprobante y en el correo. */
 @Public() @Get('event-wallet/:ticketId/apple') @Throttle({default:{limit:20,ttl:60000}})
 async applePass(@Param('ticketId',ParseUUIDPipe) id:string,@Query('s') s:string,@Res() res:Response){
  const pass=await this.wallet.apple(id,s??'');
  res.set({'Content-Type':'application/vnd.apple.pkpass','Content-Disposition':`attachment; filename="${pass.name}"`,'Cache-Control':'no-store'}).send(pass.file);
 }
 /** Lleva a «Guardar en Google Wallet» con el pase recién firmado. */
 @Public() @Get('event-wallet/:ticketId/google') @Throttle({default:{limit:20,ttl:60000}})
 async googlePass(@Param('ticketId',ParseUUIDPipe) id:string,@Query('s') s:string,@Res() res:Response){
  res.set('Cache-Control','no-store').redirect(302,await this.wallet.google(id,s??''));
 }
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
 async daily(@Headers('authorization') auth:string){this.service.assertCron(auth);const daily=await this.service.runDaily();const surveys=await this.insights.dailySurveys().catch(()=>({surveys:0,surveyEmails:0}));return {...daily,...surveys};}
}
