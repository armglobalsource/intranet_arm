"""Prepare an auditable Asana import. This command never connects to a database."""
import argparse
import csv
import hashlib
import io
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal
from pathlib import Path

PROJECT_ID = '1185873534171121'
ASSISTANCE = {'Asistencia Auditorio': 'auditorio', 'Asistencia Kids': 'kids',
              'Asistencia Tweens': 'tweens', 'Asist. Sala bebé': 'bebe'}
VOLUNTEERS = dict(zip(
    ['V. Servicio', 'V. Técnica', 'V. Kids', 'V. Tweens', 'V. Worship', 'V. Cocina',
     'V. RRSS', 'V. Seguridad', 'V. Sala de bebé', 'V. Info', 'V. Oración',
     'V. Merch', 'V. Proyecto educativo', 'V. Amor x la casa', 'V.Conexión', 'V.Sensorial'],
    ['servicio', 'tecnica', 'kids', 'tweens', 'worship', 'cocina', 'rrss', 'seguridad',
     'sala_bebes', 'info', 'oracion', 'merch', 'proyecto_educativo', 'amor', 'conexion', 'sensorial']))
OTHER = {'Aceptaron a Jesús Presencial': ('presencial', 'acepto'),
         'Aceptaron a Jesús Online': ('online', 'acepto'),
         'Espectadores a la vez': ('online', 'espectadores')}
MONTHS = {v: i + 1 for i, v in enumerate('enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split())}
# El origen cargó el mismo día (2022-04-05) en reportes semanales de Montevideo de varios meses.
# Con autorización del usuario (25-10-2026) se incorporan por el mes de su sección, sin inventar el día.
MONTH_ONLY_RULE = {'campus': 'montevideo', 'date': '2022-04-05'}

def normalize(value):
    return ''.join(c for c in unicodedata.normalize('NFD', value.strip().lower()) if not unicodedata.combining(c))

def month_of_section(section):
    match = re.fullmatch(r'([a-z]+)\s+(20\d\d)', normalize(section))
    return f'{match[2]}-{MONTHS[match[1]]:02d}' if match and match[1] in MONTHS else None

def month_only_period(row, campus_name, day):
    """Mes (YYYY-MM) de la sección cuando el reporte pertenece a la carga con fecha errónea de Montevideo."""
    if campus_name == MONTH_ONLY_RULE['campus'] and day == MONTH_ONLY_RULE['date']:
        return month_of_section(row.get('Section/Column', ''))
    return None

def digest(value):
    return hashlib.sha256(value).hexdigest()

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))

def valid_date(value):
    try:
        return bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}', value)) and date.fromisoformat(value).year in range(2000, 2101)
    except ValueError:
        return False

def count(value):
    value = value.strip()
    if not value:
        return None  # Missing is not a reported zero.
    if not re.fullmatch(r'\d+(?:\.0+)?', value):
        raise ValueError('invalid_count')
    number = int(Decimal(value))
    if number > 9007199254740991:
        raise ValueError('unsafe_count')
    return number

def read_csv(raw):
    reader = csv.reader(io.StringIO(raw.decode('utf-8-sig'), newline=''), strict=True)
    headers = [h.strip() for h in next(reader)]
    if len(headers) != len(set(headers)):
        raise ValueError('Duplicate CSV headers')
    required = {'Task ID', 'Name', 'Campus', 'Due Date', 'Estado Registro', 'Estado'} | set(ASSISTANCE) | set(VOLUNTEERS) | set(OTHER)
    if not required.issubset(headers):
        raise ValueError('Missing columns: ' + ', '.join(sorted(required - set(headers))))
    rows = []
    for values in reader:
        if not values:
            continue
        if len(values) != len(headers):
            raise ValueError(f'Wrong column count at CSV line {reader.line_num}')
        rows.append(dict(zip(headers, values)))
    return rows

def prepare(raw, catalog, historical, as_of):
    if not valid_date(as_of):
        raise ValueError('Invalid cutoff')
    rows = read_csv(raw)
    by_name = defaultdict(list)
    for campus in catalog + historical:
        by_name[normalize(campus['name'])].append(campus)
    aliases = {'santiago centro': 'santiago'}
    ids = Counter(row['Task ID'] for row in rows)
    same_event = defaultdict(list)
    for row in rows:
        campus = aliases.get(normalize(row['Campus']), normalize(row['Campus']))
        # Los reportes de solo mes comparten fecha y nombre por la carga errónea: no son duplicados entre sí.
        if campus and valid_date(row['Due Date'].strip()) and not month_only_period(row, campus, row['Due Date'].strip()):
            same_event[(campus, row['Due Date'].strip(), normalize(row['Name']))].append(row['Task ID'])
    duplicates = {key: values for key, values in same_event.items() if len(values) > 1}
    accepted, review = [], []
    reasons_count = Counter()
    for row in rows:
        reasons = []
        task_id, day = row['Task ID'].strip(), row['Due Date'].strip()
        source_campus = normalize(row['Campus'])
        campus_name = aliases.get(source_campus, source_campus)
        candidates = by_name.get(campus_name, [])
        period = month_only_period(row, campus_name, day)
        if not re.fullmatch(r'\d+', task_id) or ids[row['Task ID']] != 1:
            reasons.append('invalid_or_repeated_task_id')
        if len(candidates) != 1:
            reasons.append('unknown_or_ambiguous_campus')
        if not valid_date(day):
            reasons.append('missing_or_invalid_date')
        elif day > as_of or (period and period > as_of[:7]):
            reasons.append('future_date')
        if (campus_name, day, normalize(row['Name'])) in duplicates:
            reasons.append('possible_duplicate_event')
        section = normalize(row.get('Section/Column', ''))
        section_match = re.fullmatch(r'([a-z]+)\s+(20\d\d)', section)
        # Con mes de sección autorizado, la fecha discordante ya no retiene el reporte.
        if not period and valid_date(day) and section_match and section_match[1] in MONTHS:
            if day[:7] != f'{section_match[2]}-{MONTHS[section_match[1]]:02d}':
                reasons.append('date_differs_from_section')
        if normalize(row['Estado Registro']) != 'registrado' or normalize(row['Estado']) != 'finalizada':
            reasons.append('not_final_registered')
        if row.get('Parent task', '').strip():
            reasons.append('subtask')
        metrics = {'asistencia': {}, 'voluntarios': {}, 'presencial': {}, 'online': {}}
        invalid_fields = []
        for field, target in {**{k: ('asistencia', v) for k, v in ASSISTANCE.items()},
                              **{k: ('voluntarios', v) for k, v in VOLUNTEERS.items()}, **OTHER}.items():
            try:
                number = count(row[field])
                if number is not None:
                    metrics[target[0]][target[1]] = number
            except ValueError:
                invalid_fields.append(field)
        if invalid_fields:
            reasons.append('invalid_numeric_field')
        if not any(metrics.values()):
            reasons.append('no_reported_metrics')
        if reasons:
            reasons_count.update(reasons)
            review.append({'taskId': task_id, 'name': row['Name'], 'campus': row['Campus'].strip(),
                           'date': day, 'section': row.get('Section/Column'), 'reasons': reasons,
                           'invalidFields': invalid_fields})
            continue
        campus = candidates[0]
        kind = 'encuentro' if normalize(row['Name']).startswith('encuentro') and normalize(row.get('Tipo de Encuentro', '')) != 'junta' else 'evento'
        record = {'tipo': kind, 'campus': campus['name'], 'fecha': day, 'encuentro': row['Name'].strip(),
                  'modalidad': row.get('Modalidad', '').strip(), 'predicador': row.get('Predicador', '').strip(),
                  'mensaje': row.get('Nombre Mensaje', '').strip(), **metrics,
                  'totalAsistencia': sum(metrics['asistencia'].values()),
                  'totalVoluntarios': sum(metrics['voluntarios'].values()), 'estado': 'enviado',
                  'source': {'provider': 'asana', 'projectId': PROJECT_ID, 'taskId': task_id,
                             'csvSha256': digest(raw), 'recordSha256': digest(canonical(row).encode()),
                             'originalCampus': row['Campus'], 'originalStatus': row['Estado'],
                             'originalReportStatus': row['Estado Registro'],
                             'originalType': row.get('Tipo de Encuentro', ''),
                             'section': row.get('Section/Column', ''),
                             'createdDate': row.get('Created At', ''), 'modifiedDate': row.get('Last Modified', '')}}
        if period:
            # Solo se conoce el mes: `fecha` es el primer día por compatibilidad con el almacén, pero
            # `fechaPrecision` impide usarla como día. No entra en semanas ni en comparaciones semanales.
            record['fecha'] = f'{period}-01'
            record['fechaPrecision'] = 'mes'
            record['periodo'] = period
            record['source']['originalDate'] = day
            record['source']['dateRule'] = 'month_from_section'
        if kind == 'evento':
            record['eventoNombre'] = row['Name'].strip()
        # Assignees are not necessarily authors: do not invent ecosystem users or copy contact details.
        accepted.append({'document_id': f'asana:{PROJECT_ID}:{task_id}', 'data': record})
    totals = defaultdict(lambda: {'records': 0, 'attendance': 0, 'volunteers': 0, 'decisions': 0, 'onlineViewers': 0})
    for record in accepted:
        data = record['data']
        aggregate = totals[data['campus']]
        aggregate['records'] += 1
        aggregate['attendance'] += data['totalAsistencia']
        aggregate['volunteers'] += data['totalVoluntarios']
        aggregate['decisions'] += data['presencial'].get('acepto', 0) + data['online'].get('acepto', 0)
        aggregate['onlineViewers'] += data['online'].get('espectadores', 0)
    return {'version': 1, 'sourceSha256': digest(raw), 'projectId': PROJECT_ID, 'asOf': as_of,
            'historicalCampuses': historical, 'catalog': catalog, 'records': accepted,
            'summary': {'sourceRows': len(rows), 'ready': len(accepted), 'review': len(review),
                        'monthOnly': sum(r['data'].get('fechaPrecision') == 'mes' for r in accepted),
                        'reasons': dict(reasons_count), 'byCampus': dict(totals)},
            'review': review}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv', required=True)
    parser.add_argument('--catalog', required=True)
    parser.add_argument('--historical', required=True)
    parser.add_argument('--as-of', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    out = Path(args.output).resolve()
    root = Path(__file__).resolve().parents[3] / 'migration-artifacts'
    if not out.is_relative_to(root):
        raise ValueError('Output must be inside ignored migration-artifacts/')
    raw = Path(args.csv).read_bytes()
    plan = prepare(raw, json.loads(Path(args.catalog).read_text(encoding='utf-8-sig')),
                   json.loads(Path(args.historical).read_text(encoding='utf-8-sig')), args.as_of)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'source.csv').write_bytes(raw)
    encoded = (canonical(plan) + '\n').encode()
    (out / 'plan.json').write_bytes(encoded)
    (out / 'review.json').write_text(json.dumps(plan['review'], ensure_ascii=False, indent=2), encoding='utf-8')
    summary = plan['summary']
    lines = ['# Revisión del histórico de Asana', '', f"Tareas: {summary['sourceRows']}. Preparadas: {summary['ready']}. En revisión: {summary['review']}.", '',
             '| Campus | Reportes | Asistencias | Voluntarios | Decisiones | Espectadores online |', '|---|---:|---:|---:|---:|---:|']
    for name, values in sorted(summary['byCampus'].items()):
        lines.append('| ' + name + ' | ' + ' | '.join(str(v) for v in values.values()) + ' |')
    lines += ['', 'Motivos de revisión (una tarea puede tener varios):']
    lines += [f'- {reason}: {n}' for reason, n in sorted(summary['reasons'].items())]
    lines += ['', 'Solo se preparan tareas Finalizadas y Registradas, con fechas y campus conocidos y cifras válidas.',
              'Los vacíos se conservan como faltantes; los ceros explícitos se conservan. Las asistencias excluyen voluntarios y espectadores online.',
              f"No se infiere fecha desde la sección, salvo los {summary['monthOnly']} reportes de Montevideo con fecha errónea (autorizados por el usuario): entran por el mes de su sección, con fechaPrecision = mes y sin día.",
             'No se infiere autor desde el responsable ni horarios ausentes. Los posibles duplicados se retienen para revisión.',
              f"SHA-256 del plan: `{digest(encoded)}`", f"SHA-256 del CSV: `{digest(raw)}`"]
    (out / 'review.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(json.dumps({'planSha256': digest(encoded), **summary}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
