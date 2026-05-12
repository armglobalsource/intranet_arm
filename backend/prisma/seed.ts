import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ── ROLES DE SISTEMA ─────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin', description: 'Administrador con acceso total' },
  });
  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: { name: 'user', description: 'Usuario estándar' },
  });

  const defaultHash = await bcrypt.hash('ARM2026!', 10);

  async function upsertUser(email: string, firstName: string, lastName: string, _jobTitle: string, roleId: number) {
    return prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash: defaultHash, firstName, lastName, roleId, status: 'active' },
    });
  }

  // ── ADMIN ─────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('12345678', 10);
  await prisma.user.upsert({
    where: { email: 'admin@arm.com' },
    update: { passwordHash: adminHash },
    create: {
      email: 'admin@arm.com', passwordHash: adminHash,
      firstName: 'Admin', lastName: 'ARM',
      roleId: adminRole.id, status: 'active',
    },
  });

  // ── USUARIOS ──────────────────────────────────────────────────
  const patricia   = await upsertUser('patricia.burgos@arm.com',   'Patricia',   'Burgos',    'Pastora Principal',                    userRole.id);
  const patricio   = await upsertUser('patricio.burgos@arm.com',   'Patricio',   'Burgos',    'Pastor Principal',                     userRole.id);
  const rodrigo    = await upsertUser('rodrigo.quiroz@arm.com',    'Rodrigo',    'Quiroz',    'Pastor / Enc. Worship',                userRole.id);
  const priscilla  = await upsertUser('priscilla.fabio@arm.com',   'Priscilla',  'Fabio',     'Pastora / Enc. Worship',               userRole.id);
  const nico       = await upsertUser('nico.burgos@arm.com',       'Nicolás',    'Burgos',    'Director Creativo / Pastor Virtual',   userRole.id);
  const pabloO     = await upsertUser('pablo.ortiz@arm.com',       'Pablo',      'Ortiz',     'Enc. Worship Montevideo / La Plata',   userRole.id);
  const newman     = await upsertUser('newman.guevara@arm.com',    'Newman',     'Guevara',   'Enc. Worship Punta Arenas',            userRole.id);
  const samuel     = await upsertUser('samuel.montalva@arm.com',   'Samuel',     'Montalva',  'Enc. Worship Concepción',              userRole.id);
  const anderson   = await upsertUser('anderson.leon@arm.com',     'Anderson',   'León',      'Enc. Worship Maracaibo',               userRole.id);
  const kariA      = await upsertUser('kari.alvarez@arm.com',      'Karina',     'Álvarez',   'Enc. Worship Katy',                    userRole.id);
  const ismaG      = await upsertUser('isma.gonzalez@arm.com',     'Ismael',     'González',  'Productor Musical',                    userRole.id);
  const treicy     = await upsertUser('treicy.aceyton@arm.com',    'Treicy',     'Aceitón',   'Enc. Voces',                           userRole.id);
  const kikaMu     = await upsertUser('kika.munoz@arm.com',        'Kika',       'Muñoz',     'Enc. Finanzas Chile',                  userRole.id);
  const paolaO     = await upsertUser('paola.ortiz@arm.com',       'Paola',      'Ortiz',     'Enc. Finanzas Montevideo',             userRole.id);
  const kengev     = await upsertUser('kengev.pena@arm.com',       'Kengev',     'Peña',      'Producción Santiago',                  userRole.id);
  const naty       = await upsertUser('naty.delfin@arm.com',       'Naty',       'Delfín',    'Producción Santiago',                  userRole.id);
  const benja      = await upsertUser('benja.saavedra@arm.com',    'Benjamín',   'Saavedra',  'Producción / Sonido',                  userRole.id);
  const alejandroM = await upsertUser('alejandro.montero@arm.com', 'Alejandro',  'Montero',   'Producción Montevideo',                userRole.id);
  const andresZ    = await upsertUser('andres.zamorano@arm.com',   'Andrés',     'Zamorano',  'Producción Concepción',                userRole.id);
  const josue      = await upsertUser('josue.ferrer@arm.com',      'Josué',      'Ferrer',    'Prod. Oración Global',                 userRole.id);
  const fer        = await upsertUser('fer.herrera@arm.com',       'Fernanda',   'Herrera',   'Prod. Programación Global',            userRole.id);
  const mateoQ     = await upsertUser('mateo.quiroz@arm.com',      'Mateo',      'Quiroz',    'Prod. Experiencias Virtual',           userRole.id);
  const bayron     = await upsertUser('bayron.gonzalez@arm.com',   'Bayron',     'González',  'Visuales / Soporte Técnico',           userRole.id);
  const caro       = await upsertUser('caro.cepeda@arm.com',       'Carolina',   'Cepeda',    'Enc. Visuales Puente Alto',            userRole.id);
  const adri       = await upsertUser('adri.oliveros@arm.com',     'Adriana',    'Oliveros',  'Enc. Iluminación',                     userRole.id);
  const patriciaN  = await upsertUser('patricia.alarcon@arm.com',  'Patricia',   'Alarcón',   'Directora de Media',                   userRole.id);
  const natyS      = await upsertUser('naty.segura@arm.com',       'Naty',       'Segura',    'Enc. Media Puente Alto',               userRole.id);
  const aileen     = await upsertUser('aileen.gonzalez@arm.com',   'Aileen',     'González',  'Enc. Media Santiago',                  userRole.id);
  const mariangela = await upsertUser('mariangela.morin@arm.com',  'Mariangela', 'Morin',     'Enc. Media Montevideo',                userRole.id);
  const bastian    = await upsertUser('bastian.oyarzo@arm.com',    'Bastián',    'Oyarzo',    'Enc. Media Punta Arenas',              userRole.id);
  const pauliV     = await upsertUser('pauli.vasquez@arm.com',     'Paulina',    'Vásquez',   'Enc. Media Concepción',                userRole.id);
  const carlosL    = await upsertUser('carlos.labarca@arm.com',    'Carlos',     'Labarca',   'Enc. Media Maracaibo',                 userRole.id);
  const gabyR      = await upsertUser('gaby.rojas@arm.com',        'Gabriela',   'Rojas',     'Audiovisual / Cuenta Central',         userRole.id);
  const cesarO     = await upsertUser('cesar.osses@arm.com',       'César',      'Osses',     'Productor de Streaming',               userRole.id);
  const saraM      = await upsertUser('sara.montero@arm.com',      'Sara',       'Montero',   'Diseñadora Gráfica',                   userRole.id);
  const claudio    = await upsertUser('claudio.navea@arm.com',     'Claudio',    'Navea',     'Director de Marketing Digital',        userRole.id);

  // ── LIMPIAR ORGANIGRAMA ───────────────────────────────────────
  await prisma.orgMembership.deleteMany();
  await prisma.orgTeam.deleteMany();
  await prisma.orgArea.deleteMany();

  // ── ÁREAS ─────────────────────────────────────────────────────
  const worship = await prisma.orgArea.create({ data: {
    slug: 'worship', name: 'AR Worship', color: '#D97706', icon: '🎵', sortOrder: 0,
    desc: 'Lideran el ministerio musical de adoración con foco en el desarrollo espiritual',
  }});
  const produccion = await prisma.orgArea.create({ data: {
    slug: 'produccion', name: 'Producción', color: '#0D9488', icon: '⚙️', sortOrder: 1,
    desc: 'Coordinan la parte técnica y logística de todos los encuentros y eventos',
  }});
  const media = await prisma.orgArea.create({ data: {
    slug: 'media', name: 'Media', color: '#2563EB', icon: '📸', sortOrder: 2,
    desc: 'Crean y gestionan los contenidos integrando fotografía, audiovisual y redes sociales',
  }});
  const creativa = await prisma.orgArea.create({ data: {
    slug: 'creativa', name: 'Dirección Creativa', color: '#DB2777', icon: '🎨', sortOrder: 3,
    desc: 'Entregan soluciones creativas y dirección artística a los distintos equipos',
  }});
  const mktg = await prisma.orgArea.create({ data: {
    slug: 'marketing', name: 'Marketing Digital', color: '#7C3AED', icon: '📱', sortOrder: 4,
    desc: 'Impulsan el crecimiento de las plataformas digitales a través de campañas pagadas',
  }});

  // helper para membresías en lote
  const mem = async (userId: number, areaId: number | null, teamId: number | null, role: 'area_leader'|'team_leader'|'member', sort = 0) =>
    prisma.orgMembership.create({ data: { userId, areaId, teamId, role, sortOrder: sort } });

  // ── WORSHIP ───────────────────────────────────────────────────
  await mem(patricia.id,  worship.id, null, 'area_leader', 0);
  await mem(patricio.id,  worship.id, null, 'area_leader', 1);
  await mem(rodrigo.id,   worship.id, null, 'area_leader', 2);
  await mem(priscilla.id, worship.id, null, 'area_leader', 3);

  const wEnc = await prisma.orgTeam.create({ data: { areaId: worship.id, name: 'Enc. de Worship', icon: '📍', colPosition: 1, sortOrder: 0, desc: 'Dirigen el equipo de forma local, siendo el puente entre su campus y los directores generales.' }});
  await mem(rodrigo.id,   null, wEnc.id, 'team_leader', 0);
  await mem(priscilla.id, null, wEnc.id, 'team_leader', 1);
  await mem(pabloO.id,    null, wEnc.id, 'member', 2);
  await mem(newman.id,    null, wEnc.id, 'member', 3);
  await mem(samuel.id,    null, wEnc.id, 'member', 4);
  await mem(anderson.id,  null, wEnc.id, 'member', 5);
  await mem(kariA.id,     null, wEnc.id, 'member', 6);

  const wDirMus = await prisma.orgTeam.create({ data: { areaId: worship.id, name: 'Directores Musicales', icon: '🎼', colPosition: 1, sortOrder: 1, desc: 'Lidera al equipo en escena, indica la lista de canciones y dirige la estructura musical.' }});
  await mem(rodrigo.id,  null, wDirMus.id, 'team_leader', 0);
  await mem(ismaG.id,    null, wDirMus.id, 'member', 1);
  await mem(newman.id,   null, wDirMus.id, 'member', 2);
  await mem(samuel.id,   null, wDirMus.id, 'member', 3);
  await mem(anderson.id, null, wDirMus.id, 'member', 4);

  const wInstr = await prisma.orgTeam.create({ data: { areaId: worship.id, name: 'Enc. por Instrumento', icon: '🎸', colPosition: 2, sortOrder: 2, desc: 'Dan soporte musical y alineación técnica a cada instrumento.' }});
  await mem(ismaG.id,  null, wInstr.id, 'team_leader', 0);
  await mem(treicy.id, null, wInstr.id, 'team_leader', 1);

  const wProd = await prisma.orgTeam.create({ data: { areaId: worship.id, name: 'Equipo Prod. Musical', icon: '🎙️', colPosition: 3, sortOrder: 3, desc: 'Mastering, edición, playlists para eventos y coordinación de grabaciones.' }});
  await mem(ismaG.id,   null, wProd.id, 'team_leader', 0);
  await mem(nico.id,    null, wProd.id, 'member', 1);
  await mem(rodrigo.id, null, wProd.id, 'member', 2);

  const wFin = await prisma.orgTeam.create({ data: { areaId: worship.id, name: 'Finanzas del Área', icon: '💰', colPosition: 4, sortOrder: 4, desc: 'Gestiona y da seguimiento a los recursos económicos del área.' }});
  await mem(kikaMu.id, null, wFin.id, 'team_leader', 0);
  await mem(paolaO.id, null, wFin.id, 'team_leader', 1);

  // ── PRODUCCIÓN ────────────────────────────────────────────────
  await mem(patricio.id, produccion.id, null, 'area_leader', 0);
  await mem(rodrigo.id,  produccion.id, null, 'area_leader', 1);

  const pEquipo = await prisma.orgTeam.create({ data: { areaId: produccion.id, name: 'Equipo de Producción', icon: '🎬', colPosition: 1, sortOrder: 0, desc: 'Llevan la producción de los encuentros y eventos de su campus.' }});
  await mem(kengev.id,     null, pEquipo.id, 'member', 0);
  await mem(naty.id,       null, pEquipo.id, 'member', 1);
  await mem(benja.id,      null, pEquipo.id, 'member', 2);
  await mem(alejandroM.id, null, pEquipo.id, 'member', 3);
  await mem(andresZ.id,    null, pEquipo.id, 'member', 4);
  await mem(anderson.id,   null, pEquipo.id, 'member', 5);

  const pVisuales = await prisma.orgTeam.create({ data: { areaId: produccion.id, name: 'Equipo de Visuales', icon: '📺', colPosition: 1, sortOrder: 1, desc: 'Sirven de forma presencial en los encuentros y eventos.' }});
  await mem(caro.id,      null, pVisuales.id, 'team_leader', 0);
  await mem(bayron.id,    null, pVisuales.id, 'team_leader', 1);
  await mem(mariangela.id,null, pVisuales.id, 'team_leader', 2);

  const pIlum = await prisma.orgTeam.create({ data: { areaId: produccion.id, name: 'Equipo de Iluminación', icon: '💡', colPosition: 1, sortOrder: 2, desc: 'Sirven de forma presencial en los encuentros y eventos.' }});
  await mem(adri.id, null, pIlum.id, 'team_leader', 0);

  const pSonido = await prisma.orgTeam.create({ data: { areaId: produccion.id, name: 'Equipo de Sonido', icon: '🔊', colPosition: 1, sortOrder: 3, desc: 'Sirven de forma presencial en los encuentros y eventos.' }});
  await mem(benja.id,   null, pSonido.id, 'team_leader', 0);
  await mem(andresZ.id, null, pSonido.id, 'member', 1);
  await mem(anderson.id,null, pSonido.id, 'member', 2);

  const pEspec = await prisma.orgTeam.create({ data: { areaId: produccion.id, name: 'Productores Específicos', icon: '🎯', colPosition: 2, sortOrder: 4, desc: 'Responsables de experiencias y encuentros específicos.' }});
  await mem(mateoQ.id, null, pEspec.id, 'team_leader', 0);
  await mem(josue.id,  null, pEspec.id, 'team_leader', 1);
  await mem(fer.id,    null, pEspec.id, 'team_leader', 2);

  // ── MEDIA ─────────────────────────────────────────────────────
  await mem(patriciaN.id, media.id, null, 'area_leader', 0);
  await mem(natyS.id,     media.id, null, 'area_leader', 1);

  const mEnc = await prisma.orgTeam.create({ data: { areaId: media.id, name: 'Enc. de Media', icon: '📋', colPosition: 1, sortOrder: 0, desc: 'Coordinan el área de forma local, gestionando requerimientos y calendario.' }});
  await mem(aileen.id,     null, mEnc.id, 'team_leader', 0);
  await mem(natyS.id,      null, mEnc.id, 'team_leader', 1);
  await mem(mariangela.id, null, mEnc.id, 'team_leader', 2);
  await mem(bastian.id,    null, mEnc.id, 'team_leader', 3);
  await mem(pauliV.id,     null, mEnc.id, 'team_leader', 4);
  await mem(carlosL.id,    null, mEnc.id, 'team_leader', 5);

  const mAV = await prisma.orgTeam.create({ data: { areaId: media.id, name: 'Equipo Audiovisual', icon: '🎥', colPosition: 1, sortOrder: 1, desc: 'Sirven de forma presencial en los encuentros y eventos.' }});
  await mem(gabyR.id,      null, mAV.id, 'team_leader', 0);
  await mem(mariangela.id, null, mAV.id, 'member', 1);

  const mCuentas = await prisma.orgTeam.create({ data: { areaId: media.id, name: 'Enc. Cuentas Instagram', icon: '📱', colPosition: 2, sortOrder: 2, desc: 'Gestionan la grilla de contenido de Instagram por campus.' }});
  await mem(aileen.id,     null, mCuentas.id, 'team_leader', 0);
  await mem(caro.id,       null, mCuentas.id, 'team_leader', 1);
  await mem(mariangela.id, null, mCuentas.id, 'team_leader', 2);
  await mem(pauliV.id,     null, mCuentas.id, 'team_leader', 3);

  const mFocal = await prisma.orgTeam.create({ data: { areaId: media.id, name: 'Equipo Focalizado', icon: '🌐', colPosition: 3, sortOrder: 3, desc: 'Equipo 100% focalizado en contenido para la cuenta central y web.' }});
  await mem(gabyR.id, null, mFocal.id, 'team_leader', 0);

  // ── CREATIVA ──────────────────────────────────────────────────
  await mem(nico.id, creativa.id, null, 'area_leader', 0);

  const cEquipo = await prisma.orgTeam.create({ data: { areaId: creativa.id, name: 'Equipo Creativo', icon: '✨', colPosition: 1, sortOrder: 0, desc: 'Trabaja en eventos especiales y proyectos de alto impacto.' }});
  await mem(fer.id,    null, cEquipo.id, 'member', 0);
  await mem(claudio.id,null, cEquipo.id, 'member', 1);

  const cDis = await prisma.orgTeam.create({ data: { areaId: creativa.id, name: 'Diseño Gráfico', icon: '🎨', colPosition: 2, sortOrder: 1, desc: 'Responsables del branding y requerimientos gráficos.' }});
  await mem(saraM.id, null, cDis.id, 'team_leader', 0);

  const cStream = await prisma.orgTeam.create({ data: { areaId: creativa.id, name: 'Streaming Global', icon: '📡', colPosition: 3, sortOrder: 2, desc: 'Lideran el despliegue técnico y creativo de las transmisiones en vivo.' }});
  await mem(cesarO.id, null, cStream.id, 'team_leader', 0);

  const cWeb = await prisma.orgTeam.create({ data: { areaId: creativa.id, name: 'Desarrollo Web', icon: '💻', colPosition: 4, sortOrder: 3, desc: 'Gestionan las plataformas digitales con dirección creativa.' }});
  await mem(caro.id,   null, cWeb.id, 'member', 0);
  await mem(benja.id,  null, cWeb.id, 'member', 1);
  await mem(mateoQ.id, null, cWeb.id, 'member', 2);

  // ── MARKETING ─────────────────────────────────────────────────
  await mem(claudio.id, mktg.id, null, 'area_leader', 0);

  const mkEquipo = await prisma.orgTeam.create({ data: { areaId: mktg.id, name: 'Equipo de Marketing', icon: '📣', colPosition: 1, sortOrder: 0, desc: 'Ejecutan tareas de producción para las campañas de marketing.' }});
  await mem(benja.id, null, mkEquipo.id, 'member', 0);

  const mkAsesores = await prisma.orgTeam.create({ data: { areaId: mktg.id, name: 'Asesores de Estrategia', icon: '💡', colPosition: 2, sortOrder: 1, desc: 'Aportan perspectiva externa y proponen mejoras a las estrategias.' }});
  await mem(saraM.id, null, mkAsesores.id, 'member', 0);

  console.log('✅ Seed completado — áreas, equipos y membresías creados');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
