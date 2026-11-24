import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsEmail, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

/** Una entrada de la compra: para quién es, de qué tipo y sus respuestas. */
export class OrderItemDto {
 @IsOptional() @IsUUID() ticketTypeId?:string;
 @IsString() @MinLength(1) @MaxLength(80) firstName:string;
 @IsString() @MinLength(1) @MaxLength(80) lastName:string;
 @IsOptional() @IsEmail() @MaxLength(254) email?:string;
 @IsOptional() @IsInt() @Min(0) @Max(120) age?:number;
 @IsOptional() @IsObject() answers?:Record<string,string|boolean>;
}
/** La compra pública: quien compra (recibe las entradas) y de 1 a 10 entradas. */
export class RegistrationDto {
 @IsString() @MinLength(1) @MaxLength(80) firstName:string;
 @IsString() @MinLength(1) @MaxLength(80) lastName:string;
 @IsEmail() @MaxLength(254) email:string;
 @Matches(/^\+?[0-9 ()-]{7,25}$/) phone:string;
 @IsInt() @Min(1) campusId:number;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({each:true}) @Type(()=>OrderItemDto) items:OrderItemDto[];
 @IsOptional() @IsString() @MaxLength(30) code?:string;
 @Equals(true) consent:boolean;
 @Matches(/^[a-f0-9]{64}$/) requestKey:string;
}
export class RegistrationAccessDto {
 @Matches(/^[a-f0-9]{64}$/) token:string;
}
export class CodeLookupDto {
 @IsString() @MinLength(1) @MaxLength(30) code:string;
}
/** Quien compró transfiere una de sus entradas a otra persona. */
export class TransferDto {
 @Matches(/^[a-f0-9]{64}$/) token:string;
 @IsString() @MinLength(1) @MaxLength(80) firstName:string;
 @IsString() @MinLength(1) @MaxLength(80) lastName:string;
 @IsOptional() @IsEmail() @MaxLength(254) email?:string;
}
/** Cancelar una entrada confirmada (ticketId) o una reserva pendiente completa (sin ticketId). */
export class SelfCancelDto {
 @Matches(/^[a-f0-9]{64}$/) token:string;
 @IsOptional() @IsUUID() ticketId?:string;
}
export class TicketsLinkDto {
 @IsEmail() @MaxLength(254) email:string;
}
export class TicketsTokenDto {
 @IsString() @MinLength(10) @MaxLength(600) token:string;
}
