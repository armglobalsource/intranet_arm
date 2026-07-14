import {
  IsBoolean, IsInt, IsOptional, IsString, MaxLength,
  ValidateNested, IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SlotSubmitDto {
  @IsString()
  scheduleKey: string;

  @IsBoolean()
  available: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;
}

export class BulkSubmitDto {
  @IsInt()
  campusId: number;

  @IsString()
  weekLabel: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotSubmitDto)
  slots: SlotSubmitDto[];
}
