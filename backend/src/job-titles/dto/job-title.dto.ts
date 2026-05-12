import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateJobTitleDto {
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(150) name: string;
  @ApiProperty() @IsOptional() @IsInt()                    sortOrder?: number;
}

export class UpdateJobTitleDto {
  @ApiProperty() @IsOptional() @IsString() @MaxLength(150) name?:      string;
  @ApiProperty() @IsOptional() @IsBoolean()                isActive?:  boolean;
  @ApiProperty() @IsOptional() @IsInt()                    sortOrder?: number;
}
