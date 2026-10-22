import { EventsController } from './events/events.controller';
import { EventsService } from './events/events.service';
import { PostgresEventsService } from './events/postgres-events.service';
import { JobsService } from './jobs/jobs.service';
import { PostgresJobsService } from './jobs/postgres-jobs.service';
import { EstadisticasController } from './estadisticas/estadisticas.controller';
import { EstadisticasService } from './estadisticas/estadisticas.service';
import { PostgresEstadisticasService } from './estadisticas/postgres-estadisticas.service';
import { AnunciosController } from './anuncios/anuncios.controller';
import { AnunciosService } from './anuncios/anuncios.service';
import { PostgresAnunciosService } from './anuncios/postgres-anuncios.service';
import { KiloamorController } from './kiloamor/kiloamor.controller';
import { KiloamorService } from './kiloamor/kiloamor.service';
import { PostgresKiloamorService } from './kiloamor/postgres-kiloamor.service';
import { SiembraController } from './siembra/siembra.controller';
import { SiembraService } from './siembra/siembra.service';
import { PostgresSiembraService } from './siembra/postgres-siembra.service';
import { EncuentrosController } from './encuentros/encuentros.controller';
import { EncuentrosService } from './encuentros/encuentros.service';
import { PostgresEncuentrosService } from './encuentros/postgres-encuentros.service';
import { ArmRecordStore } from './common/database/arm-record-store';
import { ReconciliationController } from './reconciliation/reconciliation.controller';
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { PostgresReconciliationService } from './reconciliation/postgres-reconciliation.service';
import { EquipoRosterController } from './equipo-roster/equipo-roster.controller';
import { EquipoRosterService } from './equipo-roster/equipo-roster.service';
import { PostgresEquipoRosterService } from './equipo-roster/postgres-equipo-roster.service';
import { TipoCambioController } from './tipo-cambio/tipo-cambio.controller';
import { TipoCambioService } from './tipo-cambio/tipo-cambio.service';
import { PostgresTipoCambioService } from './tipo-cambio/postgres-tipo-cambio.service';
import { VisualReferencesController } from './visual-references/visual-references.controller';
import { VisualReferencesService } from './visual-references/visual-references.service';
import { PostgresVisualReferencesService } from './visual-references/postgres-visual-references.service';
import { SearchController } from './search/search.controller';
import { SearchService } from './search/search.service';
import { PostgresSearchService } from './search/postgres-search.service';
import { FeedbackController } from './feedback/feedback.controller';
import { FeedbackService } from './feedback/feedback.service';
import { PostgresFeedbackService } from './feedback/postgres-feedback.service';
import { PostgresHealthController } from './health/postgres-health.controller';
import { ContentsController } from './content/content.controller';
import { ContentsService } from './content/content.service';
import { PostgresContentsService } from './content/postgres-content.service';
import { DocumentsController } from './documents/documents.controller';
import { DocumentsService } from './documents/documents.service';
import { PostgresDocumentsService } from './documents/postgres-documents.service';
import { CampusController } from './campus/campus.controller';
import { FichasController } from './fichas/fichas.controller';
import { FichasService } from './fichas/fichas.service';
import { PostgresFichasService } from './fichas/postgres-fichas.service';
import { CampusService } from './campus/campus.service';
import { PostgresCampusService } from './campus/postgres-campus.service';
import { ArmCatalogosController } from './arm-catalogos/arm-catalogos.controller';
import { ArmCatalogosService } from './arm-catalogos/arm-catalogos.service';
import { PostgresArmCatalogosService } from './arm-catalogos/postgres-arm-catalogos.service';
import { JobTitlesController } from './job-titles/job-titles.controller';
import { JobTitlesService } from './job-titles/job-titles.service';
import { PostgresJobTitlesService } from './job-titles/postgres-job-titles.service';
import { OnboardingController } from './onboarding/onboarding.controller';
import { OnboardingService } from './onboarding/onboarding.service';
import { PostgresOnboardingService } from './onboarding/postgres-onboarding.service';
import { CancionesController } from './canciones/canciones.controller';
import { CancionesService } from './canciones/canciones.service';
import { PostgresCancionesService } from './canciones/postgres-canciones.service';
import { PaletasController } from './paletas/paletas.controller';
import { PaletasService } from './paletas/paletas.service';
import { PostgresPaletasService } from './paletas/postgres-paletas.service';
import { DisponibilidadController } from './disponibilidad/disponibilidad.controller';
import { DisponibilidadService } from './disponibilidad/disponibilidad.service';
import { TecnicosController } from './tecnicos/tecnicos.controller';
import { TecnicosService } from './tecnicos/tecnicos.service';
import { PostgresDisponibilidadService,PostgresTecnicosService } from './disponibilidad/postgres-availability';
import { CampusTurnosController } from './campus-turnos/campus-turnos.controller';
import { CampusTurnosService } from './campus-turnos/campus-turnos.service';
import { PostgresCampusTurnosService } from './campus-turnos/postgres-campus-turnos.service';
import { OrgChartController } from './orgchart/orgchart.controller';
import { OrgChartService } from './orgchart/orgchart.service';
import { PostgresOrgChartService } from './orgchart/postgres-orgchart.service';

// Bind only domains that have SQL implementations. Importing service classes as
// provider tokens does not instantiate their old Firebase dependencies.
export const postgresDomainControllers=[EventsController,EstadisticasController,AnunciosController,KiloamorController,SiembraController,EncuentrosController,ReconciliationController,EquipoRosterController,TipoCambioController,VisualReferencesController,SearchController,FeedbackController,PostgresHealthController,ContentsController,DocumentsController,FichasController,CampusController,ArmCatalogosController,JobTitlesController,OnboardingController,CancionesController,PaletasController,DisponibilidadController,TecnicosController,CampusTurnosController,OrgChartController];
export const postgresDomainProviders=[PostgresEventsService,PostgresJobsService,
 {provide:EventsService,useExisting:PostgresEventsService},
 {provide:JobsService,useExisting:PostgresJobsService},
  PostgresEstadisticasService,
  {provide:EstadisticasService,useExisting:PostgresEstadisticasService},
  PostgresAnunciosService,
  {provide:AnunciosService,useExisting:PostgresAnunciosService},
  PostgresKiloamorService,
  {provide:KiloamorService,useExisting:PostgresKiloamorService},
  PostgresSiembraService,
  {provide:SiembraService,useExisting:PostgresSiembraService},
  PostgresEncuentrosService,
  {provide:EncuentrosService,useExisting:PostgresEncuentrosService},ArmRecordStore,
  PostgresReconciliationService,
  {provide:ReconciliationService,useExisting:PostgresReconciliationService},
  PostgresEquipoRosterService,
  {provide:EquipoRosterService,useExisting:PostgresEquipoRosterService},
  PostgresTipoCambioService,
  {provide:TipoCambioService,useExisting:PostgresTipoCambioService},
  PostgresVisualReferencesService,
  {provide:VisualReferencesService,useExisting:PostgresVisualReferencesService},
  PostgresSearchService,PostgresFeedbackService,
  {provide:SearchService,useExisting:PostgresSearchService},
  {provide:FeedbackService,useExisting:PostgresFeedbackService},
  PostgresContentsService,PostgresDocumentsService,
  {provide:ContentsService,useExisting:PostgresContentsService},
  {provide:DocumentsService,useExisting:PostgresDocumentsService},
  PostgresFichasService,
  {provide:FichasService,useExisting:PostgresFichasService},
  PostgresCampusService,PostgresArmCatalogosService,PostgresJobTitlesService,PostgresOnboardingService,PostgresCancionesService,PostgresPaletasService,PostgresDisponibilidadService,PostgresTecnicosService,PostgresCampusTurnosService,PostgresOrgChartService,
  {provide:CampusService,useExisting:PostgresCampusService},
  {provide:ArmCatalogosService,useExisting:PostgresArmCatalogosService},
  {provide:JobTitlesService,useExisting:PostgresJobTitlesService},
  {provide:OnboardingService,useExisting:PostgresOnboardingService},
  {provide:CancionesService,useExisting:PostgresCancionesService},
  {provide:PaletasService,useExisting:PostgresPaletasService},
  {provide:DisponibilidadService,useExisting:PostgresDisponibilidadService},
  {provide:TecnicosService,useExisting:PostgresTecnicosService},
  {provide:CampusTurnosService,useExisting:PostgresCampusTurnosService},
  {provide:OrgChartService,useExisting:PostgresOrgChartService},
];
