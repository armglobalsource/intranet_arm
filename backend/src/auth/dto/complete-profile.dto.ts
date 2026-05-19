import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteProfileDto {
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100) lastName?:  string;
  @ApiProperty() @IsOptional()
  @IsEnum(['male', 'female', 'other', 'prefer_not_to_say'])
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  @ApiProperty() @IsOptional() @IsString()                  phone?:     string;
  @ApiProperty() @IsOptional() @IsString()                  birthDate?: string;
  @ApiProperty() @IsOptional() @IsString() @MinLength(6)    password?:  string;
}
