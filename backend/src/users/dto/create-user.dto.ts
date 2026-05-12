import {
  IsArray, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional,
  IsString, MaxLength, MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export class CreateUserDto {
  @ApiProperty() @IsNotEmpty() @IsEmail()                    email:          string;
  @ApiProperty() @IsNotEmpty() @IsString() @MinLength(6)     password:       string;
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(100)   firstName:      string;
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(100)   lastName:       string;
  @ApiProperty() @IsNotEmpty() @IsInt()                      roleId:         number;
  @ApiProperty() @IsOptional() @IsInt()                      campusId?:      number;
  @ApiProperty() @IsOptional() @IsArray() @IsInt({ each: true }) jobTitleIds?: number[];
  @ApiProperty() @IsOptional() @IsString()                   phone?:         string;
  @ApiProperty() @IsOptional() @IsString()                   country?:       string;
  @ApiProperty() @IsOptional() @IsString()                   bio?:           string;
}

export class UpdateUserDto {
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100)   firstName?:     string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100)   lastName?:      string;
  @ApiProperty() @IsOptional() @IsInt()                      campusId?:      number | null;
  @ApiProperty() @IsOptional() @IsArray() @IsInt({ each: true }) jobTitleIds?: number[];
  @ApiProperty() @IsOptional() @IsString()                   phone?:         string;
  @ApiProperty() @IsOptional() @IsString()                   country?:       string;
  @ApiProperty() @IsOptional() @IsString()                   bio?:           string;
  @ApiProperty() @IsOptional() @IsEnum(['active', 'inactive', 'suspended']) status?: UserStatus;
}
