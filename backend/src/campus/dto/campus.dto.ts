import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCampusDto {
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(150) name:     string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(255) address?: string;
}

export class UpdateCampusDto {
  @ApiProperty() @IsOptional() @IsString() @MaxLength(150) name?:     string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(255) address?:  string;
  @ApiProperty() @IsOptional() @IsBoolean()                isActive?: boolean;
}
