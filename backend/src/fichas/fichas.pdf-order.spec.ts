import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { validateSync } from 'class-validator';
import { SectionLayoutDto } from './dto/ficha.dto';

describe('orden de secciones de la ficha', () => {
  const layout = (pdfOrder?: string[]) => Object.assign(new SectionLayoutDto(), { left: ['pastoral'], right: ['worship'], pdfOrder });
  it('acepta un orden opcional con las secciones de la vista PDF', () => {
    expect(validateSync(layout())).toHaveLength(0);
    expect(validateSync(layout(['pastoral', 'responsables', 'streaming', 'produccion']))).toHaveLength(0);
  });
  it('rechaza secciones desconocidas o duplicadas', () => {
    expect(validateSync(layout(['pastoral', 'pastoral']))).not.toHaveLength(0);
    expect(validateSync(layout(['pastoral', 'desconocida']))).not.toHaveLength(0);
  });
});
