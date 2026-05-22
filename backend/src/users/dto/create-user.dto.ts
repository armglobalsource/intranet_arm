import {
  IsArray, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional,
  IsString, MaxLength, MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export type MinisterialTitle = 'pastor_principal' | 'pastor' | 'ministro';

export class CreateUserDto {
  @ApiProperty() @IsNotEmpty() @IsEmail()                    email:               string;
  @ApiProperty() @IsOptional() @IsString() @MinLength(6)     password?:           string;
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(100)   firstName:           string;
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(100)   lastName:            string;
  @ApiProperty() @IsNotEmpty() @IsInt()                      roleId:              number;
  @ApiProperty() @IsOptional() @IsInt()                      campusId?:           number;
  @ApiProperty() @IsOptional() @IsArray() @IsInt({ each: true }) jobTitleIds?:    number[];
  @ApiProperty() @IsOptional() @IsString()                   phone?:              string;
  @ApiProperty() @IsOptional() @IsString()                   country?:            string;
  @ApiProperty() @IsOptional() @IsString()                   bio?:                string;
  @ApiProperty() @IsOptional() @IsString()                   birthDate?:          string;
  @ApiProperty() @IsOptional() @IsEnum(['pastor_principal', 'pastor', 'ministro']) ministerialTitle?: MinisterialTitle | null;
}

export class UpdateUserDto {
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100)   firstName?:          string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100)   lastName?:           string;
  @ApiProperty() @IsOptional() @IsEmail()                    email?:              string;
  @ApiProperty() @IsOptional() @IsString() @MinLength(6)     password?:           string;
  @ApiProperty() @IsOptional() @IsInt()                      roleId?:             number;
  @ApiProperty() @IsOptional() @IsInt()                      campusId?:           number | null;
  @ApiProperty() @IsOptional() @IsArray() @IsInt({ each: true }) jobTitleIds?:    number[];
  @ApiProperty() @IsOptional() @IsString()                   phone?:              string;
  @ApiProperty() @IsOptional() @IsString()                   country?:            string;
  @ApiProperty() @IsOptional() @IsString()                   bio?:                string;
  @ApiProperty() @IsOptional() @IsString()                   birthDate?:          string | null;
  @ApiProperty() @IsOptional() @IsEnum(['male', 'female', 'other', 'prefer_not_to_say']) gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  @ApiProperty() @IsOptional() @IsEnum(['active', 'inactive', 'suspended']) status?: UserStatus;
  @ApiProperty() @IsOptional() @IsEnum(['pastor_principal', 'pastor', 'ministro']) ministerialTitle?: MinisterialTitle | null;
}
