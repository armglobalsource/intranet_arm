import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /** GET /api/v1/events?year=2026 */
  @Get()
  findAll(@Query('year') year?: string) {
    return this.eventsService.findAll(year);
  }

  /** GET /api/v1/events/:id */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  /** POST /api/v1/events  (solo admin) */
  @Post()
  create(@Body() dto: CreateEventDto, @Request() req: any) {
    return this.eventsService.create(dto, req.user.id, req.user.role?.name ?? '');
  }

  /** PATCH /api/v1/events/:id  (solo admin) */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @Request() req: any,
  ) {
    return this.eventsService.update(id, dto, req.user.role?.name ?? '');
  }

  /** DELETE /api/v1/events/:id  (solo admin) */
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.eventsService.remove(id, req.user.role?.name ?? '');
  }
}
