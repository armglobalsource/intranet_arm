import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class EventCategoryDto {
 @IsString() @MinLength(1) @MaxLength(80) name: string;
 @IsBoolean() active: boolean;
}
export class EventFaqDto {
 @IsString() @MinLength(1) @MaxLength(200) question: string;
 @IsString() @MinLength(1) @MaxLength(2000) answer: string;
}
export class EventTicketTypeDto {
 @IsString() @MinLength(1) @MaxLength(80) name: string;
 @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(999999999) price: number;
 @IsString() @Matches(/^[A-Z]{3}$/) currency: string;
}
export class EventDetailsDto {
 @IsString() @MaxLength(240) summary: string;
 @IsString() @MaxLength(15000) description: string;
 @IsString() @MaxLength(2000) bannerUrl: string;
 @Matches(/^#[0-9a-fA-F]{6}$/) color: string;
 @IsString() @MaxLength(80) timezone: string;
 @IsIn(['onsite','online','hybrid']) modality: string;
 @IsString() @MaxLength(200) location: string;
 @IsString() @MaxLength(400) address: string;
 @IsOptional() @IsISO8601({strict:true}) registrationOpensAt?: string | null;
 @IsOptional() @IsISO8601({strict:true}) registrationClosesAt?: string | null;
 @IsOptional() @IsISO8601({strict:true}) paymentDueAt?: string | null;
 @IsBoolean() waitlist: boolean;
 @IsOptional() @IsInt() @Min(0) @Max(120) minimumAge?: number | null;
 @IsString() @MaxLength(5000) conditions: string;
 @IsString() @MaxLength(5000) cancellationPolicy: string;
 @IsIn(['free','paid']) pricing: string;
 @IsArray() @ArrayMaxSize(20) @ValidateNested({each:true}) @Type(()=>EventFaqDto) faqs: EventFaqDto[];
}
/** Full replacement plus optimistic version: omitted fields cannot survive unnoticed. */
export class SaveEventProgramDto {
 @IsInt() @Min(0) version: number;
 @IsString() @MinLength(1) @MaxLength(160) title: string;
 @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) @MaxLength(120) slug: string;
 @IsOptional() @IsUUID() categoryId?: string | null;
 @IsInt() @Min(1) campusId: number;
 @IsInt() @Min(1) organizerId: number;
 @IsISO8601({strict:true}) startsAt: string;
 @IsISO8601({strict:true}) endsAt: string;
 @IsIn(['draft','published','finished','cancelled']) status: string;
 @IsIn(['pending','closed']) registrationStatus: string;
 @IsOptional() @IsInt() @Min(1) @Max(1000000) capacity?: number | null;
 @IsArray() @ArrayUnique() @ArrayMaxSize(200) @IsInt({each:true}) @Min(1,{each:true}) campusIds: number[];
 @ValidateNested() @Type(()=>EventDetailsDto) details: EventDetailsDto;
 @IsArray() @ArrayMaxSize(20) @ValidateNested({each:true}) @Type(()=>EventTicketTypeDto) ticketTypes: EventTicketTypeDto[];
}
