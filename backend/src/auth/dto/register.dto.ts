import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty() @IsNotEmpty() @IsEmail()                  email:     string;
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(100) firstName: string;
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(100) lastName:  string;
  @ApiProperty() @IsNotEmpty() @IsString() @MinLength(6)   password:  string;
}
