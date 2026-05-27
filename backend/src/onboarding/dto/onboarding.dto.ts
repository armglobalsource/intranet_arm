import {
  IsArray, IsBoolean, IsNumber, IsOptional,
  IsString, MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OnboardingStepDto {
  @IsString() @MaxLength(150)  title:       string;
  @IsString() @MaxLength(2000) description: string;
  @IsNumber()                  order:       number;
}

export class CreateOnboardingDto {
  @IsString()            @MaxLength(100)  teamName:     string;
  @IsString()            @MaxLength(60)   slug:         string;
  @IsOptional() @IsString() @MaxLength(200)  welcomeTitle?: string;
  @IsOptional() @IsString() @MaxLength(2000) welcomeText?:  string;
  @IsOptional() @IsString() @MaxLength(500)  videoUrl?:     string;
  @IsOptional() @IsString() @MaxLength(10)   emoji?:        string;
  @IsOptional() @IsString() @MaxLength(30)   color?:        string;
  @IsOptional() @IsArray()                   roleNames?:    string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OnboardingStepDto)
  steps?: OnboardingStepDto[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateOnboardingDto {
  @IsOptional() @IsString() @MaxLength(100)  teamName?:     string;
  @IsOptional() @IsString() @MaxLength(60)   slug?:         string;
  @IsOptional() @IsString() @MaxLength(200)  welcomeTitle?: string;
  @IsOptional() @IsString() @MaxLength(2000) welcomeText?:  string;
  @IsOptional() @IsString() @MaxLength(500)  videoUrl?:     string;
  @IsOptional() @IsString() @MaxLength(10)   emoji?:        string;
  @IsOptional() @IsString() @MaxLength(30)   color?:        string;
  @IsOptional() @IsArray()                   roleNames?:    string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OnboardingStepDto)
  steps?: OnboardingStepDto[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}
