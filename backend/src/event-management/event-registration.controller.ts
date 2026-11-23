import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EventActor } from './event-program.rules';
import { RegistrationAccessDto, RegistrationDto } from './event-registration.dto';
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
 @Get('event-management/:id/registrations')
 list(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string){return this.service.list(u,id);}
}
