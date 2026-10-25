import unittest
from prepare import prepare, count, read_csv, ASSISTANCE, VOLUNTEERS, OTHER
import csv
import io

HEADERS = ['Task ID', 'Name', 'Campus', 'Due Date', 'Estado Registro', 'Estado', 'Section/Column', 'Parent task'] + list(ASSISTANCE) + list(VOLUNTEERS) + list(OTHER)
CATALOG = [{'id': 1, 'name': 'Santiago', 'country': 'Chile'}]

def fixture(*overrides):
    stream = io.StringIO(newline='')
    writer = csv.DictWriter(stream, fieldnames=HEADERS)
    writer.writeheader()
    for i, values in enumerate(overrides):
        row = {'Task ID': str(100 + i), 'Name': 'Encuentro Domingo 11:00', 'Campus': 'Santiago',
               'Due Date': '2026-10-18', 'Estado Registro': 'Registrado', 'Estado': 'Finalizada',
               'Asistencia Auditorio': '100', 'V.Conexión': '2.0'}
        writer.writerow({**row, **values})
    return stream.getvalue().encode('utf-8')

class PrepareTest(unittest.TestCase):
    def test_counts(self):
        self.assertEqual(count('2.0'), 2)
        self.assertEqual(count(' \n0'), 0)
        self.assertIsNone(count(' '))
        for value in ['no', '-1', '1.5', '1,000', 'NaN', '9007199254740992']:
            with self.assertRaises(ValueError):
                count(value)

    def test_missing_is_not_zero_and_totals_separate(self):
        plan = prepare(fixture({'Asistencia Kids': '0', 'Espectadores a la vez': '4'}), CATALOG, [], '2026-10-25')
        row = plan['records'][0]['data']
        self.assertEqual(row['totalAsistencia'], 100)
        self.assertEqual(row['totalVoluntarios'], 2)
        self.assertEqual(row['asistencia']['kids'], 0)
        self.assertNotIn('bebe', row['asistencia'])
        self.assertNotIn('acepto', row['presencial'])
        self.assertEqual(row['online']['espectadores'], 4)
        self.assertNotIn('registradoPor', row)

    def test_reproducible_identity_and_alias(self):
        raw = fixture({'Campus': ' Santiago Centro '})
        first = prepare(raw, CATALOG, [], '2026-10-25')
        self.assertEqual(first, prepare(raw, CATALOG, [], '2026-10-25'))
        self.assertEqual(first['records'][0]['data']['campus'], 'Santiago')
        self.assertTrue(first['records'][0]['document_id'].endswith(':100'))

    def test_duplicate_events_are_all_held(self):
        plan = prepare(fixture({}, {}), CATALOG, [], '2026-10-25')
        self.assertEqual(len(plan['records']), 0)
        self.assertEqual(plan['summary']['reasons']['possible_duplicate_event'], 2)

    def test_repeated_ids_are_all_held(self):
        plan = prepare(fixture({}, {'Task ID': '100', 'Name': 'Otro evento'}), CATALOG, [], '2026-10-25')
        self.assertEqual(plan['summary']['reasons']['invalid_or_repeated_task_id'], 2)

    def test_pending_cancelled_invalid_and_missing_date_held(self):
        cases = [({'Estado Registro': 'Pendiente'}, 'not_final_registered'),
                 ({'Estado': 'Cancelada'}, 'not_final_registered'),
                 ({'V.Sensorial': 'no'}, 'invalid_numeric_field'),
                 ({'Due Date': ''}, 'missing_or_invalid_date'),
                 ({'Due Date': '2026-02-30'}, 'missing_or_invalid_date'),
                 ({'Due Date': '2026-10-26'}, 'future_date'),
                 ({'Section/Column': 'Septiembre 2026'}, 'date_differs_from_section'),
                 ({'Campus': 'Otro'}, 'unknown_or_ambiguous_campus'),
                 ({'Parent task': 'Parent'}, 'subtask')]
        for values, reason in cases:
            with self.subTest(reason=reason):
                plan = prepare(fixture(values), CATALOG, [], '2026-10-25')
                self.assertFalse(plan['records'])
                self.assertIn(reason, plan['review'][0]['reasons'])

    def test_montevideo_month_only_reports_are_released_without_inventing_the_day(self):
        catalog = CATALOG + [{'id': 2, 'name': 'Montevideo', 'country': 'Uruguay'}]
        base = {'Campus': 'Montevideo', 'Due Date': '2022-04-05', 'Name': 'Encuentro Jueves 20:00 hrs'}
        plan = prepare(fixture({**base, 'Section/Column': 'Septiembre 2021', 'Asistencia Auditorio': '30'},
                               {**base, 'Section/Column': 'Septiembre 2021', 'Asistencia Auditorio': '41'},
                               {**base, 'Section/Column': 'Octubre 2021'}), catalog, [], '2026-10-25')
        self.assertEqual(len(plan['records']), 3)
        self.assertEqual(plan['summary']['monthOnly'], 3)
        first = plan['records'][0]['data']
        self.assertEqual((first['fecha'], first['fechaPrecision'], first['periodo']), ('2021-09-01', 'mes', '2021-09'))
        self.assertEqual(first['source']['originalDate'], '2022-04-05')
        self.assertEqual(first['source']['dateRule'], 'month_from_section')
        self.assertEqual(plan['records'][2]['data']['periodo'], '2021-10')

    def test_month_only_rule_does_not_leak_to_other_campuses_dates_or_sections(self):
        catalog = CATALOG + [{'id': 2, 'name': 'Montevideo', 'country': 'Uruguay'}]
        cases = [({'Campus': 'Santiago', 'Due Date': '2022-04-05', 'Section/Column': 'Septiembre 2021'}, 'date_differs_from_section'),
                 ({'Campus': 'Montevideo', 'Due Date': '2022-04-06', 'Section/Column': 'Septiembre 2021'}, 'date_differs_from_section'),
                 ({'Campus': 'Montevideo', 'Due Date': '2022-04-05', 'Section/Column': 'Sin mes'}, 'date_differs_from_section')]
        for values, reason in cases:
            with self.subTest(values=values):
                plan = prepare(fixture(values), catalog, [], '2026-10-25')
                self.assertEqual(plan['summary']['monthOnly'], 0)
                self.assertFalse(plan['records'] and plan['records'][0]['data'].get('fechaPrecision'))
        # El mes de la sección no puede quedar en el futuro respecto del corte.
        plan = prepare(fixture({'Campus': 'Montevideo', 'Due Date': '2022-04-05', 'Section/Column': 'Diciembre 2026'}), catalog, [], '2026-10-25')
        self.assertEqual(plan['records'], [])
        self.assertIn('future_date', plan['review'][0]['reasons'])

    def test_month_only_report_still_held_when_pending_or_empty(self):
        catalog = CATALOG + [{'id': 2, 'name': 'Montevideo', 'country': 'Uruguay'}]
        plan = prepare(fixture({'Campus': 'Montevideo', 'Due Date': '2022-04-05', 'Section/Column': 'Marzo 2022',
                                'Estado': 'Sin Iniciar', 'Estado Registro': 'Pendiente', 'Asistencia Auditorio': '', 'V.Conexión': ''}), catalog, [], '2026-10-25')
        self.assertEqual(plan['records'], [])
        self.assertIn('not_final_registered', plan['review'][0]['reasons'])
        self.assertIn('no_reported_metrics', plan['review'][0]['reasons'])

    def test_registered_but_empty_held(self):
        plan = prepare(fixture({'Asistencia Auditorio': '', 'V.Conexión': ''}), CATALOG, [], '2026-10-25')
        self.assertIn('no_reported_metrics', plan['review'][0]['reasons'])

    def test_csv_quoted_multiline_and_bom(self):
        raw = b'\xef\xbb\xbf' + fixture({'Name': 'Encuentro, "especial"\n11:00'})
        self.assertEqual(read_csv(raw)[0]['Name'], 'Encuentro, "especial"\n11:00')

    def test_wrong_export_fails(self):
        with self.assertRaises(ValueError):
            read_csv(b'Task ID,Duration\n1,40\n')

if __name__ == '__main__':
    unittest.main()
