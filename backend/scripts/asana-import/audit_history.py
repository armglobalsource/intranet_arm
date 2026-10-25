"""Read-only reconciliation of imported and held Asana records, including online overlap."""
import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from prepare import read_csv, count, ASSISTANCE, VOLUNTEERS, OTHER, MONTH_ONLY_RULE, normalize

def metrics(row):
    result = {'asistencia': 0, 'voluntarios': 0, 'decisionesPresencial': 0, 'decisionesOnline': 0, 'espectadoresOnline': 0}
    bad = []
    for field in [*ASSISTANCE, *VOLUNTEERS, *OTHER]:
        try:
            value = count(row[field])
        except ValueError:
            bad.append(field)
            continue
        if value is None:
            continue
        key = 'asistencia' if field in ASSISTANCE else 'voluntarios' if field in VOLUNTEERS else {
            'Aceptaron a Jesús Presencial': 'decisionesPresencial',
            'Aceptaron a Jesús Online': 'decisionesOnline', 'Espectadores a la vez': 'espectadoresOnline'}[field]
        result[key] += value
    return result, bad

def totals(rows):
    aggregate = Counter()
    for row in rows:
        aggregate.update(metrics(row)[0])
    return dict(aggregate)

def hour(row):
    match = re.search(r'\b(\d{1,2}):([0-5]\d)', row['Name'])
    return f'{int(match[1]):02d}:{match[2]}' if match else None

def audit(source, plan):
    rows = read_csv(source)
    imported_ids = {r['data']['source']['taskId'] for r in plan['records']}
    accepted = [r for r in rows if r['Task ID'] in imported_ids]
    held = [r for r in rows if r['Task ID'] not in imported_ids]
    by_id = {r['Task ID']: r for r in rows}
    categories = defaultdict(list)
    for issue in plan['review']:
        # Exclusive buckets reconcile to held row count; all original reasons remain in review.json.
        reasons = issue['reasons']
        priority = ['subtask', 'unknown_or_ambiguous_campus', 'missing_or_invalid_date', 'date_differs_from_section',
                    'possible_duplicate_event', 'invalid_numeric_field', 'not_final_registered', 'no_reported_metrics']
        category = next((reason for reason in priority if reason in reasons), 'other')
        categories[category].append(by_id[issue['taskId']])
    virtual = [r for r in rows if normalize(r['Campus']) == 'virtual']
    host_online = [r for r in rows if normalize(r['Campus']) in ('santiago', 'puente alto', 'santiago centro') and metrics(r)[0]['espectadoresOnline'] > 0]
    overlaps = []
    for v in virtual:
        if metrics(v)[0]['espectadoresOnline'] <= 0 or not v['Due Date']:
            continue
        for host in host_online:
            if host['Due Date'] == v['Due Date'] and hour(v) and hour(host) == hour(v):
                overlaps.append({'date': v['Due Date'], 'time': hour(v), 'virtualTask': v['Task ID'], 'hostTask': host['Task ID'],
                                 'host': host['Campus'], 'virtualViewers': metrics(v)[0]['espectadoresOnline'],
                                 'hostViewers': metrics(host)[0]['espectadoresOnline']})
    online_by_campus = []
    for campus in ['Virtual', 'Santiago', 'Puente Alto']:
        group = [r for r in rows if normalize(r['Campus']) == normalize(campus) and metrics(r)[0]['espectadoresOnline'] > 0]
        days = sorted(r['Due Date'] for r in group if r['Due Date'])
        online_by_campus.append({'campus': campus, 'reportsWithViewers': len(group), 'firstDate': days[0] if days else None,
                                'lastDate': days[-1] if days else None, 'metrics': totals(group)})
    # Tareas con la fecha errónea de Montevideo: las liberadas entran por el mes de su sección (sin día).
    montevideo = [r for r in rows if normalize(r['Campus']) == 'montevideo' and r['Due Date'] == MONTH_ONLY_RULE['date']]
    montevideo_imported = [r for r in montevideo if r['Task ID'] in imported_ids]
    months = defaultdict(list)
    for row in montevideo:
        months[row['Section/Column']].append(row)
    return {'sourceRows': len(rows), 'importedRows': len(accepted), 'heldRows': len(held),
            'sourceReportedMetrics': totals(rows), 'importedMetrics': totals(accepted), 'heldReportedMetrics': totals(held),
            'heldWithPositiveFigures': sum(any(v > 0 for v in metrics(r)[0].values()) for r in held),
            'exclusiveReviewGroups': {key: {'rows': len(group), 'positiveRows': sum(any(v > 0 for v in metrics(r)[0].values()) for r in group),
                                           'reportedMetrics': totals(group), 'taskIds': [r['Task ID'] for r in group]} for key, group in categories.items()},
            'montevideo': {'rows': len(montevideo), 'importedByMonth': len(montevideo_imported),
                          'heldRows': len(montevideo) - len(montevideo_imported), 'reportedMetrics': totals(montevideo),
                          'sections': {key: {'rows': len(group), 'reportedMetrics': totals(group)} for key, group in months.items()},
                          'distinctMetricSets': len({json.dumps(metrics(r)[0], sort_keys=True) for r in montevideo})},
            'virtualYears': dict(Counter(r['Due Date'][:4] for r in virtual)),
            'onlineByCampus': online_by_campus, 'sameDateTimeOnlineCandidates': overlaps}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('batch')
    args = parser.parse_args()
    batch = Path(args.batch).resolve()
    if not batch.is_relative_to(Path(__file__).resolve().parents[3] / 'migration-artifacts'):
        raise ValueError('Batch must be inside migration-artifacts')
    result = audit((batch / 'source.csv').read_bytes(), json.loads((batch / 'plan.json').read_text(encoding='utf-8')))
    (batch / 'historical-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    labels = {'not_final_registered':'Estado no finalizado/registrado', 'missing_or_invalid_date':'Sin fecha válida',
              'unknown_or_ambiguous_campus':'Sin campus confirmado', 'possible_duplicate_event':'Posible duplicación',
              'subtask':'Subtarea', 'invalid_numeric_field':'Cifra no numérica', 'no_reported_metrics':'Sin cifras',
              'date_differs_from_section':'Fecha discordante con sección'}
    lines = ['# Auditoría del histórico', '',
             'Los valores retenidos aún no son cifras oficiales: incluyen resúmenes, posibles duplicados y estados pendientes.',
             'Las cifras importadas representan solo la parte validada del archivo; no equivalen al histórico completo.', '',
             '| Indicador | Importado | Retenido para revisar | Suma bruta del CSV |', '|---|---:|---:|---:|']
    for key in result['sourceReportedMetrics']:
        lines.append(f"| {key} | {result['importedMetrics'][key]} | {result['heldReportedMetrics'][key]} | {result['sourceReportedMetrics'][key]} |")
    lines += ['', '## Tareas pendientes', '', '| Motivo principal | Tareas | Con cifras positivas |', '|---|---:|---:|']
    for key, group in result['exclusiveReviewGroups'].items():
        lines.append(f"| {labels.get(key,key)} | {group['rows']} | {group['positiveRows']} |")
    lines += ['', 'Cada tarea se cuenta una sola vez en esta tabla; puede tener más de un problema.', '',
              '## Montevideo', '', 'Las tareas fechadas 2022-04-05 están distribuidas en estas secciones del origen. Esto permite conocer el mes, pero no deducir el día.',
              f"{result['montevideo']['importedByMonth']} entraron por el mes de su sección (fechaPrecision = mes, sin día) y {result['montevideo']['heldRows']} "
              f"{'sigue retenida' if result['montevideo']['heldRows'] == 1 else 'siguen retenidas'} por otros motivos.", '',
              '| Sección original | Tareas | Asistencias | Voluntarios |', '|---|---:|---:|---:|']
    for section, group in result['montevideo']['sections'].items():
        lines.append(f"| {section} | {group['rows']} | {group['reportedMetrics']['asistencia']} | {group['reportedMetrics']['voluntarios']} |")
    lines += ['', '## Campus Virtual', '', '| Campus del reporte | Primer reporte con espectadores | Último | Reportes |', '|---|---|---|---:|']
    for group in result['onlineByCampus']:
        lines.append(f"| {group['campus']} | {group['firstDate']} | {group['lastDate']} | {group['reportsWithViewers']} |")
    lines += ['', f"Coincidencias de fecha y hora entre Virtual y emisores con espectadores positivos: {len(result['sameDateTimeOnlineCandidates'])}.",
              'Esta búsqueda no prueba ausencia de duplicados. La atribución histórica de las audiencias requiere confirmación.']
    (batch / 'historical-audit.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')
    concise = {**result, 'exclusiveReviewGroups': {k: {kk: vv for kk,vv in v.items() if kk != 'taskIds'} for k,v in result['exclusiveReviewGroups'].items()}}
    print(json.dumps(concise, ensure_ascii=True, indent=2))

if __name__ == '__main__':
    main()
