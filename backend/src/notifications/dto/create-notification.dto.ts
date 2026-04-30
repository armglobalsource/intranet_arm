import { IsString, IsOptional, MinLength, MaxLength, IsEnum, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty() @IsInt() userId: number;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(255) title: string;
  @ApiProperty() @IsOptional() @IsString() body?: string;
  @ApiProperty() @IsOptional() @IsString() link?: string;
  @ApiProperty() @IsOptional() @IsEnum(['in_app','email','both']) channel?: string;
}
