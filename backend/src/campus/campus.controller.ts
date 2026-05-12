import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CampusService } from './campus.service';
import { CreateCampusDto, UpdateCampusDto } from './dto/campus.dto';

@UseGuards(JwtAuthGuard)
@Controller('campus')
export class CampusController {
  constructor(private readonly campusService: CampusService) {}

  @Get()
  findAll() { return this.campusService.findAll(); }

  @Get('active')
  findActive() { return this.campusService.findActive(); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.campusService.findOne(id); }

  @Post()
  create(@Body() dto: CreateCampusDto) { return this.campusService.create(dto); }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCampusDto) {
    return this.campusService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.campusService.remove(id); }
}
