import { describe, expect, it } from 'vitest';
import { canDeleteReport, canEditReport, canReview, estadoDe, isUploaded } from './encuentros.review';

const leader = { sub: 7, email: 'lider@x', campusId: 1, permissions: ['encuentros:create'] };
const editor = { sub: 8, email: 'editor@x', campusId: 1, permissions: ['encuentros:create', 'encuentros:edit', 'encuentros:delete'] };
const reviewerByRole = { sub: 9, email: 'adm@x', campusId: 1, permissions: ['encuentros:review'] };
const campus = { id: 1, adminIds: [12] };

describe('report review', () => {
  it('treats Asana history as uploaded and new reports as pending', () => {
    expect(estadoDe({ id: 'asana:1:2', estado: 'enviado' })).toBe('subido');
    expect(estadoDe({ id: 'abc' })).toBe('subido'); // legado sin flujo
    expect(estadoDe({ id: 'abc', estado: 'validado' })).toBe('subido');
    expect(isUploaded({ id: 'asana:1:2', estado: 'observado' })).toBe(false);
    expect(estadoDe({ id: 'abc', estado: 'observado' })).toBe('observado');
    expect(isUploaded({ id: 'abc', estado: 'enviado' })).toBe(false);
  });

  it('lets the campus administrator review: by role in their campus or listed in the campus', () => {
    expect(canReview(reviewerByRole, campus)).toBe(true);
    expect(canReview({ ...reviewerByRole, campusId: 2 }, campus)).toBe(false);
    expect(canReview({ sub: 12, email: 'a', campusId: 5, permissions: [] }, campus)).toBe(true);
    expect(canReview(leader, campus)).toBe(false);
    expect(canReview({ sub: 1, email: 'admin', permissions: ['*'] }, campus)).toBe(true);
  });

  it('lets the author fix an unreviewed report, but nobody but the reviewer touches an uploaded one', () => {
    const own = { id: 'r1', campusId: 1, estado: 'observado', registradoPor: { uid: 7 } };
    expect(canEditReport(leader, own, false)).toBeNull();
    expect(canEditReport(leader, { ...own, registradoPor: { uid: 99 } }, false)).toBe('No puedes editar este reporte');
    expect(canEditReport(editor, { ...own, registradoPor: { uid: 99 } }, false)).toBeNull();
    expect(canEditReport(editor, { ...own, estado: 'subido' }, false)).toMatch(/ya fue subido/);
    expect(canEditReport(reviewerByRole, { ...own, estado: 'subido' }, true)).toBeNull();
    expect(canDeleteReport(editor, { ...own, estado: 'subido' }, false)).toMatch(/ya fue subido/);
    expect(canDeleteReport(leader, own, false)).toBe('No puedes eliminar este reporte');
  });
});
