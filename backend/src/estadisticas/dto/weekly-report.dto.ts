import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEmail, IsOptional, Matches } from 'class-validator';

export class WeeklyReportRecipientsDto {
  @IsArray()
  @ArrayMaxSize(40, { message: 'Máximo 40 destinatarios' })
  @IsEmail({}, { each: true, message: 'Revisa los correos: hay uno que no es válido' })
  destinatarios: string[];
}

export class SendWeeklyReportDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Semana inválida' })
  semana: string;

  @IsOptional() @IsBoolean()
  porRevisar?: boolean;

  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos un destinatario' })
  @ArrayMaxSize(40, { message: 'Máximo 40 destinatarios por envío' })
  @IsEmail({}, { each: true, message: 'Revisa los correos: hay uno que no es válido' })
  destinatarios: string[];
}
