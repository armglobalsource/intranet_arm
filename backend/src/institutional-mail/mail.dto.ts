import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class MailDetailsDto {
  @IsIn(['create','change','offboard']) operation!: 'create'|'change'|'offboard';
  @IsIn(['arm','school']) company!: 'arm'|'school';
  @IsIn(['collaborator','temporary','functional','alias']) kind!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsString() @MinLength(3) @MaxLength(60) employeeId!: string;
  @IsString() @MinLength(2) @MaxLength(160) area!: string;
  @IsString() @MinLength(2) @MaxLength(160) jobTitle!: string;
  @IsString() @MaxLength(10) startsOn!: string;
  @IsString() @MaxLength(64) suggestedName!: string;
  @IsString() @MinLength(1) @MaxLength(2000) groups!: string;
  @IsString() @MaxLength(2000) reason!: string;
  @IsOptional() @IsString() @MaxLength(10) expiresOn?: string;
  @IsOptional() @IsString() @MaxLength(254) existingEmail?: string;
  @IsOptional() @IsString() @MaxLength(160) responsible?: string;
}
export class CreateMailRequestDto {
  @IsInt() @Min(1) managerId!: number;
  @IsDefined() @ValidateNested() @Type(() => MailDetailsDto) details!: MailDetailsDto;
}
export class ReviseMailRequestDto extends CreateMailRequestDto {
  @IsInt() @Min(1) version!: number;
}
export class MailActionDto {
  @IsInt() @Min(1) version!: number;
  @IsIn(['approve','observe','reject','start','complete']) action!: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsOptional() @IsString() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(160) license?: string;
  @IsOptional() @IsString() @MaxLength(2000) groups?: string;
  @IsOptional() @Transform(({obj,key})=>obj[key]) @IsBoolean() workspaceChecked?: boolean;
  @IsOptional() @Transform(({obj,key})=>obj[key]) @IsBoolean() mfaConfirmed?: boolean;
  @IsOptional() @Transform(({obj,key})=>obj[key]) @IsBoolean() secureDelivery?: boolean;
  @IsOptional() @Transform(({obj,key})=>obj[key]) @IsBoolean() accessRevoked?: boolean;
}
