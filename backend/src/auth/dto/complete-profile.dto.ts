import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteProfileDto {
  @ApiProperty() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) firstName?: string;
  @ApiProperty() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) lastName?:  string;
  @ApiProperty() @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: 'male' | 'female';
  @ApiProperty() @IsOptional() @IsString() @IsNotEmpty()                  phone?:     string;
  @ApiProperty() @IsOptional() @IsString()                                birthDate?: string;
  @ApiProperty() @IsOptional() @IsString() @IsNotEmpty() @MinLength(6)    password?:  string;

  // ── Wizard de bienvenida ──────────────────────────────────────────────────
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100)                preferredName?:    string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(6)                  phoneCountryCode?: string;
  @ApiProperty() @IsOptional() @IsInt()                                   campusId?:         number;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100)                referralChannel?:  string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(150)                referredByName?:   string;
  @ApiProperty() @IsOptional() @IsEnum(['yes', 'not-now', 'interested', 'no'])
  servingStatus?: 'yes' | 'not-now' | 'interested' | 'no';
  @ApiProperty({ description: 'Mes y año que empezó a servir, formato YYYY-MM' })
  @IsOptional() @IsString() @MaxLength(7)                                 memberSince?:      string;
  @ApiProperty() @IsOptional() @IsArray() @IsString({ each: true })       interestAreas?:    string[];
  @ApiProperty() @IsOptional() @IsString() @MaxLength(150)                otherAreaText?:    string;
  @ApiProperty() @IsOptional() @IsBoolean()                               consentAccepted?:  boolean;
}
