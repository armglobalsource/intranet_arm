import { Equals, IsEmail, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RegistrationDto {
 @IsString() @MinLength(1) @MaxLength(80) firstName:string;
 @IsString() @MinLength(1) @MaxLength(80) lastName:string;
 @IsEmail() @MaxLength(254) email:string;
 @Matches(/^\+?[0-9 ()-]{7,25}$/) phone:string;
 @IsInt() @Min(1) campusId:number;
 @IsOptional() @IsInt() @Min(0) @Max(120) age?:number;
 @IsOptional() @IsUUID() ticketTypeId?:string;
 @Equals(true) consent:boolean;
 @Matches(/^[a-f0-9]{64}$/) requestKey:string;
}
export class RegistrationAccessDto {
 @Matches(/^[a-f0-9]{64}$/) token:string;
}
