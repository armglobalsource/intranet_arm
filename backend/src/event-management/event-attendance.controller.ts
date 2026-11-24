import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EventActor } from './event-program.rules';
import { CheckInDto, ManualRegistrationDto } from './event-attendance.dto';
import { EventAttendanceService } from './event-attendance.service';

// Varias puertas pueden compartir la misma red: el escáner y la lista tienen un límite holgado.
const DOOR={default:{limit:600,ttl:60000}};
@Controller()
export class EventAttendanceController {
 constructor(private readonly service:EventAttendanceService){}
 @Get('event-door/events') @Throttle(DOOR)
 events(@CurrentUser() u:EventActor){return this.service.doorEvents(u);}
 @Get('event-management/:id/attendees') @Throttle(DOOR)
 attendees(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string){return this.service.attendees(u,id);}
 @Post('event-management/:id/check-in') @Throttle(DOOR)
 checkIn(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string,@Body() d:CheckInDto){return this.service.checkIn(u,id,d.code);}
 @Post('event-management/:id/registrations/:registrationId/undo-check-in') @Throttle(DOOR)
 undo(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string,@Param('registrationId',ParseUUIDPipe) r:string){return this.service.undoCheckIn(u,id,r);}
 @Post('event-management/:id/registrations') @Throttle({default:{limit:60,ttl:60000}})
 add(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string,@Body() d:ManualRegistrationDto){return this.service.addManual(u,id,d);}
 @Post('event-management/:id/registrations/:registrationId/cancel')
 cancel(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string,@Param('registrationId',ParseUUIDPipe) r:string){return this.service.cancel(u,id,r);}
 @Post('event-management/:id/registrations/:registrationId/resend') @Throttle({default:{limit:10,ttl:60000}})
 resend(@CurrentUser() u:EventActor,@Param('id',ParseUUIDPipe) id:string,@Param('registrationId',ParseUUIDPipe) r:string){return this.service.resend(u,id,r);}
}
