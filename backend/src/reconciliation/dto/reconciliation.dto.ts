import {
  IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ExcelRowDto {
  @ApiProperty() @IsString() @IsNotEmpty() rowKey: string;
  @ApiProperty() @IsString() @IsNotEmpty() nombreCompleto: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() area?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() correo?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() fechaNacimiento?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() campus?: string;
}

export class MatchRequestDto {
  @ApiProperty({ type: [ExcelRowDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => ExcelRowDto)
  rows: ExcelRowDto[];
}

export interface MatchCandidate {
  userId: number;
  name:   string;
  email:  string;
  score:  number;
  campus: string | null;
  area:   string | null;
}

export interface MatchResult {
  rowKey: string;
  excelRow: {
    nombreCompleto:  string;
    area?:           string;
    correo?:         string;
    fechaNacimiento?: string;
    campus?:         string;
  };
  parsedBirthDate:  string | null;
  resolvedCampusId: number | null;
  suggestedUserId:  number | null;
  confidence:       number;
  topCandidates:    MatchCandidate[];
}

export class ApplyMatchDto {
  @ApiProperty() @IsString() @IsNotEmpty() rowKey: string;
  @ApiProperty({ enum: ['update', 'create'] }) @IsIn(['update', 'create']) action: 'update' | 'create';
  @ApiProperty({ required: false, description: 'Requerido cuando action=update' })
  @IsOptional() @IsInt() userId?: number;
  @ApiProperty({ required: false, description: 'Requerido cuando action=create' })
  @IsOptional() @IsString() nombreCompleto?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() birthDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() campusId?: number;
}

export class ApplyRequestDto {
  @ApiProperty({ type: [ApplyMatchDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => ApplyMatchDto)
  matches: ApplyMatchDto[];
}

export interface ApplyResult {
  rowKey:   string;
  userId?:  number;
  status:   'success' | 'skipped' | 'error';
  message?: string;
}
