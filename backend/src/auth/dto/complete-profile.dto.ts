import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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
}
