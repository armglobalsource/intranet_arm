import {
  IsArray, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional,
  IsString, MaxLength, MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type UserStatus = 'pending' | 'active' | 'inactive' | 'suspended' | 'rejected';

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

export type ServingStatus = 'yes' | 'not-now' | 'interested' | 'no';

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
  @ApiProperty() @IsOptional() @IsEnum(['active', 'inactive', 'suspended', 'rejected']) status?: UserStatus;
  @ApiProperty() @IsOptional() @IsEnum(['pastor_principal', 'pastor', 'ministro']) ministerialTitle?: MinisterialTitle | null;
  @ApiProperty({ description: 'Mes y año en que se unió a la organización, formato YYYY-MM' })
  @IsOptional() @IsString() @MaxLength(7) memberSince?: string | null;

  // ── Wizard de bienvenida ──────────────────────────────────────────────────
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100)   preferredName?:      string | null;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(6)     phoneCountryCode?:   string | null;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100)   referralChannel?:    string | null;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(150)   referredByName?:     string | null;
  @ApiProperty() @IsOptional() @IsEnum(['yes', 'not-now', 'interested', 'no'])    servingStatus?: ServingStatus | null;
  @ApiProperty() @IsOptional() @IsArray() @IsString({ each: true })              interestAreas?: string[];
  @ApiProperty() @IsOptional() @IsString() @MaxLength(150)   otherAreaText?:      string | null;
}

export class ApproveUserDto {
  @ApiProperty({ required: false, description: 'Rol a asignar al aprobar (opcional, mantiene el rol actual si se omite)' })
  @IsOptional() @IsInt()
  roleId?: number;
}
