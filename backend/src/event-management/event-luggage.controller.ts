import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EventActor } from './event-program.rules';
import { EventLuggageService, MAX_BAGS } from './event-luggage.service';

export class AddLuggageDto {
  @IsUUID() registrationId: string;
  @IsInt() @Min(1) @Max(MAX_BAGS) count: number;
  @IsOptional() @IsString() @MaxLength(80) description?: string;
}
export class LuggageLookupDto {
  @IsString() @MinLength(1) @MaxLength(300) code: string;
}
export class DeliverLuggageDto {
  @IsString() @MinLength(1) @MaxLength(300) bagCode: string;
  @IsOptional() @IsString() @MaxLength(300) ticketCode?: string;
  @IsOptional() @IsUUID() registrationId?: string;
  @IsOptional() @IsBoolean() idChecked?: boolean;
}

// Mesa de equipaje y puerta comparten red: límite holgado, como el escáner de ingreso.
const DESK = { default: { limit: 600, ttl: 60000 } };
@Controller('event-management/:id/luggage')
export class EventLuggageController {
  constructor(private readonly service: EventLuggageService) {}
  @Get() @Throttle(DESK)
  list(@CurrentUser() u: EventActor, @Param('id', ParseUUIDPipe) id: string) { return this.service.list(u, id); }
  @Get('registrations/:registrationId') @Throttle(DESK)
  forRegistration(@CurrentUser() u: EventActor, @Param('id', ParseUUIDPipe) id: string, @Param('registrationId', ParseUUIDPipe) r: string) { return this.service.forRegistration(u, id, r); }
  @Post() @Throttle(DESK)
  add(@CurrentUser() u: EventActor, @Param('id', ParseUUIDPipe) id: string, @Body() d: AddLuggageDto) { return this.service.add(u, id, d); }
  @Post('lookup') @Throttle(DESK)
  lookup(@CurrentUser() u: EventActor, @Param('id', ParseUUIDPipe) id: string, @Body() d: LuggageLookupDto) { return this.service.lookup(u, id, d.code); }
  @Post('deliver') @Throttle(DESK)
  deliver(@CurrentUser() u: EventActor, @Param('id', ParseUUIDPipe) id: string, @Body() d: DeliverLuggageDto) { return this.service.deliver(u, id, d); }
  @Post(':bagId/void') @Throttle(DESK)
  void(@CurrentUser() u: EventActor, @Param('id', ParseUUIDPipe) id: string, @Param('bagId', ParseUUIDPipe) bagId: string) { return this.service.void(u, id, bagId); }
}
