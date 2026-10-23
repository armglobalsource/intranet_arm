import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, { message: 'El enlace no es válido. Solicita uno nuevo.' })
  token!: string;

  @IsString()
  @MinLength(12, { message: 'Usa al menos 12 caracteres para tu nueva contraseña' })
  @MaxLength(72, { message: 'La contraseña es demasiado larga' })
  password!: string;
}
