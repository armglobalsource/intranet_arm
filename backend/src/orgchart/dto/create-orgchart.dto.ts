import { IsString, IsOptional, IsInt, IsEnum, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrgAreaDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(50) slug: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(150) name: string;
  @ApiProperty() @IsString() @MaxLength(20) color: string;
  @ApiProperty() @IsString() @MaxLength(10) icon: string;
  @ApiPropertyOptional() @IsOptional() @IsString() desc?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class CreateOrgNodeDto {
  @ApiProperty() @IsInt() areaId: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() parentId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() userId?: number;
  @ApiProperty() @IsEnum(['leader', 'group', 'person']) type: 'leader' | 'group' | 'person';
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) role?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) icon?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() colPosition?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateOrgNodeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) role?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateOrgAreaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(150) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() desc?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) color?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) icon?: string;
}

export class LinkUserDto {
  @ApiPropertyOptional({ description: 'ID del usuario a vincular. null para desvincular.' })
  @IsOptional()
  @IsInt()
  userId: number | null;
}
