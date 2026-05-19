import { IsString, IsOptional, MinLength, MaxLength, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContentDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(255) title: string;
  @ApiProperty() @IsString() body: string;
  @ApiProperty() @IsOptional() @IsString() excerpt?: string;
  @ApiProperty() @IsOptional() @IsEnum(['news', 'page', 'announcement']) type?: string;
  @ApiProperty() @IsOptional() @IsBoolean() pinned?: boolean;
  /** null = global, string = campusId específico */
  @ApiProperty() @IsOptional() @IsString() campusId?: string | null;
  @ApiProperty() @IsOptional() @IsEnum(['draft', 'published']) status?: string;
  @ApiProperty() @IsOptional() @IsString() imageUrl?: string;
}
