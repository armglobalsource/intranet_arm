import { IsNumber, Min } from 'class-validator';

export class UpdateTipoCambioDto {
  /** Unidades de esta moneda equivalentes a 1 USD (ej. CLP ~950, USD siempre 1). */
  @IsNumber() @Min(0.000001) unitsPerUSD: number;
}
