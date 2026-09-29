import { IsNumber, Min } from 'class-validator';

export class UpdateTipoCambioDto {
  /** Pesos chilenos por 1 unidad de la moneda (ej: 1 USD = 943.62 CLP). */
  @IsNumber()
  @Min(0.000001)
  clpPorUnidad: number;
}
