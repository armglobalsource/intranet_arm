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

export class UpdateOrgAreaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(150) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() desc?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() leaderDesc?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) color?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) icon?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateOrgTeamDto {
  @ApiProperty() @IsInt() areaId: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() parentTeamId?: number;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(150) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) icon?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() desc?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() colPosition?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateOrgTeamDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) icon?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) iconUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() desc?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() colPosition?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateOrgMembershipDto {
  @ApiProperty() @IsInt() userId: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() areaId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() teamId?: number;
  @ApiProperty() @IsEnum(['area_leader', 'team_leader', 'member']) role: 'area_leader' | 'team_leader' | 'member';
  @ApiPropertyOptional() @IsOptional() @IsInt() jobTitleId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateOrgMembershipDto {
  @ApiPropertyOptional() @IsOptional() @IsEnum(['area_leader', 'team_leader', 'member']) role?: 'area_leader' | 'team_leader' | 'member';
  @ApiPropertyOptional() @IsOptional() @IsInt() jobTitleId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}
