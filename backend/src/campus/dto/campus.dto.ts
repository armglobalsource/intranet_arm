import {
  IsArray, IsBoolean, IsNotEmpty, IsOptional,
  IsString, MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ScheduleDto {
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(50)  dia:          string;
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(20)  hora:         string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(200) descripcion?: string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(20)  fichaType?:   string; // 'unico' | 'multi' | 'oracion'
}

export class CreateCampusDto {
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(150) name:      string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(20)  siglas?:   string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(255) address?:  string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100) city?:     string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100) country?:  string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(50)  phone?:    string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(150) email?:    string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(255) website?:  string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(500) description?: string;

  @ApiProperty({ type: [Number] })
  @IsOptional() @IsArray() pastorIds?: number[];

  @ApiProperty({ type: [Number] })
  @IsOptional() @IsArray() adminIds?: number[];

  @ApiProperty({ type: [ScheduleDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ScheduleDto)
  schedules?: ScheduleDto[];
}

export class UpdateCampusDto {
  @ApiProperty() @IsOptional() @IsString() @MaxLength(150) name?:        string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(20)  siglas?:      string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(255) address?:     string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100) city?:        string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100) country?:     string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(50)  phone?:       string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(150) email?:       string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(255) website?:     string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiProperty() @IsOptional() @IsBoolean()                isActive?:    boolean;

  @ApiProperty({ type: [Number] })
  @IsOptional() @IsArray() pastorIds?: number[];

  @ApiProperty({ type: [Number] })
  @IsOptional() @IsArray() adminIds?: number[];

  @ApiProperty({ type: [ScheduleDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ScheduleDto)
  schedules?: ScheduleDto[];
}
