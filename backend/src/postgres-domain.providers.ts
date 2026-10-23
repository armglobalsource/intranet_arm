import { EventsController } from './events/events.controller';
import { PostgresEventsService } from './events/postgres-events.service';
import { PostgresJobsService } from './jobs/postgres-jobs.service';
import { EstadisticasController } from './estadisticas/estadisticas.controller';
import { PostgresEstadisticasService } from './estadisticas/postgres-estadisticas.service';
import { AnunciosController } from './anuncios/anuncios.controller';
import { PostgresAnunciosService } from './anuncios/postgres-anuncios.service';
import { KiloamorController } from './kiloamor/kiloamor.controller';
import { PostgresKiloamorService } from './kiloamor/postgres-kiloamor.service';
import { SiembraController } from './siembra/siembra.controller';
import { PostgresSiembraService } from './siembra/postgres-siembra.service';
import { EncuentrosController } from './encuentros/encuentros.controller';
import { PostgresEncuentrosService } from './encuentros/postgres-encuentros.service';
import { ArmRecordStore } from './common/database/arm-record-store';
import { ReconciliationController } from './reconciliation/reconciliation.controller';
import { PostgresReconciliationService } from './reconciliation/postgres-reconciliation.service';
import { EquipoRosterController } from './equipo-roster/equipo-roster.controller';
import { PostgresEquipoRosterService } from './equipo-roster/postgres-equipo-roster.service';
import { TipoCambioController } from './tipo-cambio/tipo-cambio.controller';
import { PostgresTipoCambioService } from './tipo-cambio/postgres-tipo-cambio.service';
import { VisualReferencesController } from './visual-references/visual-references.controller';
import { PostgresVisualReferencesService } from './visual-references/postgres-visual-references.service';
import { SearchController } from './search/search.controller';
import { PostgresSearchService } from './search/postgres-search.service';
import { FeedbackController } from './feedback/feedback.controller';
import { PostgresFeedbackService } from './feedback/postgres-feedback.service';
import { PostgresHealthController } from './health/postgres-health.controller';
import { ContentsController } from './content/content.controller';
import { PostgresContentsService } from './content/postgres-content.service';
import { DocumentsController } from './documents/documents.controller';
import { PostgresDocumentsService } from './documents/postgres-documents.service';
import { CampusController } from './campus/campus.controller';
import { FichasController } from './fichas/fichas.controller';
import { PostgresFichasService } from './fichas/postgres-fichas.service';
import { PostgresCampusService } from './campus/postgres-campus.service';
import { ArmCatalogosController } from './arm-catalogos/arm-catalogos.controller';
import { PostgresArmCatalogosService } from './arm-catalogos/postgres-arm-catalogos.service';
import { JobTitlesController } from './job-titles/job-titles.controller';
import { PostgresJobTitlesService } from './job-titles/postgres-job-titles.service';
import { OnboardingController } from './onboarding/onboarding.controller';
import { PostgresOnboardingService } from './onboarding/postgres-onboarding.service';
import { CancionesController } from './canciones/canciones.controller';
import { PostgresCancionesService } from './canciones/postgres-canciones.service';
import { PaletasController } from './paletas/paletas.controller';
import { PostgresPaletasService } from './paletas/postgres-paletas.service';
import { DisponibilidadController } from './disponibilidad/disponibilidad.controller';
import { TecnicosController } from './tecnicos/tecnicos.controller';
import { PostgresDisponibilidadService,PostgresTecnicosService } from './disponibilidad/postgres-availability';
import { CampusTurnosController } from './campus-turnos/campus-turnos.controller';
import { PostgresCampusTurnosService } from './campus-turnos/postgres-campus-turnos.service';
import { OrgChartController } from './orgchart/orgchart.controller';
import { PostgresOrgChartService } from './orgchart/postgres-orgchart.service';

// Domain controllers and their PostgreSQL services.
export const postgresDomainControllers=[EventsController,EstadisticasController,AnunciosController,KiloamorController,SiembraController,EncuentrosController,ReconciliationController,EquipoRosterController,TipoCambioController,VisualReferencesController,SearchController,FeedbackController,PostgresHealthController,ContentsController,DocumentsController,FichasController,CampusController,ArmCatalogosController,JobTitlesController,OnboardingController,CancionesController,PaletasController,DisponibilidadController,TecnicosController,CampusTurnosController,OrgChartController];
export const postgresDomainProviders=[
  ArmRecordStore,
  PostgresEventsService,PostgresJobsService,PostgresEstadisticasService,PostgresAnunciosService,PostgresKiloamorService,
  PostgresSiembraService,PostgresEncuentrosService,PostgresReconciliationService,PostgresEquipoRosterService,
  PostgresTipoCambioService,PostgresVisualReferencesService,PostgresSearchService,PostgresFeedbackService,
  PostgresContentsService,PostgresDocumentsService,PostgresFichasService,PostgresCampusService,PostgresArmCatalogosService,
  PostgresJobTitlesService,PostgresOnboardingService,PostgresCancionesService,PostgresPaletasService,
  PostgresDisponibilidadService,PostgresTecnicosService,PostgresCampusTurnosService,PostgresOrgChartService,
];
