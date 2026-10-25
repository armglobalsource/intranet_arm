import unittest
from audit_history import audit
from prepare import prepare
from test_prepare import fixture, CATALOG

class AuditTest(unittest.TestCase):
    def test_imported_plus_held_equals_source(self):
        raw = fixture({}, {'Name': 'Encuentro pendiente', 'Estado Registro': 'Pendiente', 'Asistencia Auditorio': '5'})
        plan = prepare(raw, CATALOG, [], '2026-10-25')
        result = audit(raw, plan)
        self.assertEqual(result['heldRows'], 1)
        self.assertEqual(result['heldReportedMetrics']['asistencia'], 5)
        for key, total in result['sourceReportedMetrics'].items():
            self.assertEqual(total, result['importedMetrics'][key] + result['heldReportedMetrics'][key])
        self.assertEqual(sum(g['rows'] for g in result['exclusiveReviewGroups'].values()), result['heldRows'])

    def test_same_time_virtual_host_is_only_candidate(self):
        raw = fixture({'Campus': 'Virtual', 'Name': 'Encuentro 11:00 hrs', 'Espectadores a la vez': '100'},
                      {'Campus': 'Santiago', 'Name': 'Encuentro 11:00hrs', 'Espectadores a la vez': '120'},
                      {'Campus': 'Santiago', 'Name': 'Encuentro 18:00hrs', 'Espectadores a la vez': '90'})
        plan = prepare(raw, CATALOG, [{'name':'Virtual','country':None,'isActive':False}], '2026-10-25')
        result = audit(raw, plan)
        self.assertEqual(len(result['sameDateTimeOnlineCandidates']), 1)
        self.assertEqual(result['sameDateTimeOnlineCandidates'][0]['virtualViewers'], 100)
        self.assertEqual(result['sameDateTimeOnlineCandidates'][0]['hostViewers'], 120)

    def test_malformed_value_does_not_erase_other_figures(self):
        raw = fixture({'V.Sensorial':'no'})
        result = audit(raw, prepare(raw, CATALOG, [], '2026-10-25'))
        self.assertEqual(result['heldReportedMetrics']['asistencia'],100)
        self.assertEqual(result['heldReportedMetrics']['voluntarios'],2)
        self.assertEqual(result['heldWithPositiveFigures'],1)

if __name__ == '__main__':
    unittest.main()
