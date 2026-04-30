import { IsString, IsOptional, MinLength, MaxLength, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDocumentDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(255) name: string;
  @ApiProperty() @IsOptional() @IsString() description?: string;
  @ApiProperty() @IsOptional() @IsInt() departmentId?: number;
  @ApiProperty() @IsOptional() @IsInt() minRoleId?: number;
}
