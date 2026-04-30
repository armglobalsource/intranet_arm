import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @ApiProperty() @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @ApiProperty() @IsOptional() @IsString() jobTitle?: string;
  @ApiProperty() @IsOptional() @IsString() bio?: string;
  @ApiProperty() @IsOptional() @IsString() phone?: string;
}
