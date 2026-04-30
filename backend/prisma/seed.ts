import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

type OrgNodeType = 'leader' | 'group' | 'person';

interface NodeDef {
  type: OrgNodeType;
  name: string;
  role?: string;
  description?: string;
  icon?: string;
  col?: number;
  children?: NodeDef[];
}

async function seedArea(
  areaId: number,
  nodes: NodeDef[],
  parentId: number | null = null,
  sortBase = 0,
) {
  for (let i = 0; i < nodes.length; i++) {
    const def = nodes[i];
    const created = await prisma.orgNode.create({
      data: {
        areaId,
        parentId,
        type: def.type,
        name: def.name,
        role: def.role ?? null,
        description: def.description ?? null,
        icon: def.icon ?? null,
        colPosition: def.col ?? 1,
        sortOrder: sortBase + i,
      },
    });
    if (def.children?.length) {
      await seedArea(areaId, def.children, created.id, 0);
    }
  }
}

async function main() {
  // ── ROLES Y USUARIO ADMIN ─────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin', description: 'Administrador con acceso total' },
  });

  await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: { name: 'user', description: 'Usuario estándar' },
  });

  const passwordHash = await bcrypt.hash('Admin1234!', 10);

  await prisma.user.upsert({
    where: { email: 'admin@arm.com' },
    update: {},
    create: {
      email: 'admin@arm.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'ARM',
      jobTitle: 'Administrador',
      roleId: adminRole.id,
      status: 'active',
    },
  });

  console.log('✅ Usuario admin creado → admin@arm.com / Admin1234!');

  // Clean orgchart tables
  await prisma.orgNode.deleteMany();
  await prisma.orgArea.deleteMany();

  // ── AREAS ──────────────────────────────────────────────────────
  const areas = await prisma.$transaction([
    prisma.orgArea.create({
      data: { slug: 'worship', name: 'AR Worship', color: '#D97706', icon: '🎵', sortOrder: 0,
        desc: 'Lideran el ministerio musical de adoración con foco en el desarrollo espiritual' },
    }),
    prisma.orgArea.create({
      data: { slug: 'produccion', name: 'Producción', color: '#0D9488', icon: '⚙️', sortOrder: 1,
        desc: 'Coordinan la parte técnica y logística de todos los encuentros y eventos' },
    }),
    prisma.orgArea.create({
      data: { slug: 'media', name: 'Media', color: '#2563EB', icon: '📸', sortOrder: 2,
        desc: 'Crean y gestionan los contenidos integrando fotografía, audiovisual y redes sociales' },
    }),
    prisma.orgArea.create({
      data: { slug: 'creativa', name: 'Dirección Creativa', color: '#DB2777', icon: '🎨', sortOrder: 3,
        desc: 'Entregan soluciones creativas y dirección artística a los distintos equipos' },
    }),
    prisma.orgArea.create({
      data: { slug: 'marketing', name: 'Marketing Digital', color: '#7C3AED', icon: '📱', sortOrder: 4,
        desc: 'Impulsan el crecimiento de las plataformas digitales a través de campañas pagadas' },
    }),
  ]);

  const [worship, produccion, media, creativa, marketing] = areas;

  // ── WORSHIP ────────────────────────────────────────────────────
  const worshipTree: NodeDef[] = [
    {
      type: 'leader',
      name: 'Pres. Principales Patricia y Patricio Burgos\nPr. Rodrigo Quiroz y Pra. Priscilla Fabio',
      role: 'Pastores Encargados',
      description: 'Lideran el ministerio de forma global, entregando lineamiento y dirección general, velando por el equipo en su totalidad y respondiendo a los desafíos del área.',
      children: [
        {
          type: 'group', name: 'Enc. de Worship', role: 'Por Campus', icon: '🎯', col: 1,
          description: 'Dirigen el equipo de forma local, siendo el puente entre su campus y los directores generales, y ejecutando tareas específicas de su contexto.',
          children: [
            { type: 'person', name: 'Pra. Pri Fabio\nPr. Rodrigo Quiroz', role: 'Campus Santiago' },
            { type: 'person', name: 'Pra. Pri Fabio\nPr. Rodrigo Quiroz', role: 'Campus Puente Alto' },
            { type: 'person', name: 'Pablo Ortiz', role: 'Campus Montevideo' },
            { type: 'person', name: 'Newman Guevara', role: 'Campus Punta Arenas' },
            { type: 'person', name: 'Samuel Montalva', role: 'Campus Concepción' },
            { type: 'person', name: 'Anderson León', role: 'Campus Maracaibo' },
            { type: 'person', name: 'Pra. Kari Alvarez', role: 'Campus Katy' },
            { type: 'person', name: 'Pablo Ortiz', role: 'Campus La Plata' },
          ],
        },
        {
          type: 'group', name: 'Directores Musicales', role: 'Por Campus', icon: '🎼', col: 1,
          description: '• Es quien lidera al equipo en escena.\n• Indica a través de la plataforma Play List, la lista de canciones completa que lleva un encuentro o un evento.\n• Carga las canciones en plataforma y además se preocupa de las transiciones entre canción.\n• Dirige al equipo en la estructura de las canciones.',
          children: [
            { type: 'person', name: 'Min. José Gandía\nMin. Elías Quiroz\nJuan José Gonzalez\nIsmael Gonzalez\nMarco Mella\nDaniel Fabio\nRonald Romero\nManuel Córdova\nVicto Cárdenas\nPs. Pablo Encina\nPs. Rodrigo Quiroz', role: 'Campus Santiago y Puente Alto' },
            { type: 'person', name: 'Pablo Ortiz\nEzequiel Cárdenas\nIsrael Videla', role: 'Campus Montevideo' },
            { type: 'person', name: 'Min. Newman Guevara\nJavier Rosas\nJavier Carvajal', role: 'Campus Punta Arenas' },
            { type: 'person', name: 'Samuel Montalva', role: 'Campus Concepción' },
            { type: 'person', name: 'Anderson León\nRafael Pérez', role: 'Campus Maracaibo' },
            { type: 'person', name: 'Ps. Karina Peralta\nPs. Nicolas Burgos', role: 'Campus Katy' },
          ],
        },
        {
          type: 'group', name: 'Enc. por Instrumento', role: 'Global / Local', icon: '🎸', col: 2,
          description: 'Dan soporte musical y alineación técnica a cada instrumento, velando por la calidad y cohesión del equipo en su área específica. De manera global o local.',
          children: [
            { type: 'person', name: 'Min. José Candia', role: 'Guitarras' },
            { type: 'person', name: 'Matias Batias', role: 'Bateristas' },
            { type: 'person', name: 'Juan José González', role: 'Bajistas' },
            { type: 'person', name: 'Marco Mella', role: 'Pianistas' },
            { type: 'person', name: 'Min. Treicy Aceitón', role: 'Voces' },
          ],
        },
        {
          type: 'group', name: 'Equipo Prod. Musical', role: 'Studio ARM', icon: '🎙️', col: 3,
          description: 'Se encarga de procesos como mastering, edición, creación de playlists para eventos y coordinación de grabaciones y proyectos musicales del área.',
          children: [
            { type: 'person', name: 'Isma González', role: 'Productor Musical' },
            { type: 'person', name: 'Pr. Nico Burgos', role: 'Ingeniero de Mezcla' },
            { type: 'person', name: 'Pr. Rodrigo Quiroz\nPra. Pri Fabio\nPr. Nico Burgos', role: 'Composición' },
          ],
        },
        {
          type: 'group', name: 'Finanzas del Área', role: 'Administración', icon: '💰', col: 4,
          description: 'Gestiona y da seguimiento a los recursos económicos del área, velando por una administración ordenada y responsable.',
          children: [
            { type: 'person', name: 'Kika Muñoz', role: 'Encargada Chile' },
            { type: 'person', name: 'Pra. Paola Ortiz', role: 'Encargada Montevideo' },
          ],
        },
        {
          type: 'group', name: 'Equipo ARW', role: 'Por Campus', icon: '🤝', col: 1,
          description: 'La banda de voluntarios que sirve musicalmente en los encuentros regulares y eventos especiales de la organización.',
          children: [
            { type: 'person', name: 'Voluntarios', role: 'Banda por campus' },
          ],
        },
      ],
    },
  ];

  // ── PRODUCCIÓN ────────────────────────────────────────────────
  const produccionTree: NodeDef[] = [
    {
      type: 'leader',
      name: 'Pr. Principal Patricio Burgos\nPr. Rodrigo Quiroz',
      role: 'Productor General',
      description: 'Lidera y dirige el equipo de producción con una mirada global del área, tomando las decisiones estratégicas y velando por sacar adelante cada desafío que enfrenta el equipo.',
      children: [
        {
          type: 'group', name: 'Equipo de Producción', role: 'Por Campus', icon: '🎬', col: 1,
          description: 'Llevan la producción de los encuentros y eventos de su campus, entregando dirección local y ejecutando las tareas específicas que cada contexto requiere.',
          children: [
            { type: 'person', name: 'Kengev Peña\nNaty Delfín\nBenja Saavedra\nCarlos Villalobos', role: 'Campus Santiago' },
            { type: 'person', name: 'Caro\nCamilo\nCamila\nEdison\nCarlos Contreras\nKaty', role: 'Campus Puente Alto' },
            { type: 'person', name: 'Alejandro Montero', role: 'Campus Montevideo' },
            { type: 'person', name: 'Pedro\nNewman Guevara', role: 'Campus Punta Arenas' },
            { type: 'person', name: 'Andrés Zamorano\nAbi\nBayron González', role: 'Campus Concepción' },
            { type: 'person', name: 'Andrea Pernia\nAnderson León', role: 'Campus Maracaibo' },
            { type: 'person', name: 'Annie Stephens\nPr. Nico Burgos', role: 'Campus Katy' },
          ],
        },
        {
          type: 'group', name: 'Equipo de Visuales', role: 'Por Campus', icon: '📺', col: 1,
          description: 'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del equipo de producción.',
          children: [
            { type: 'person', name: 'Caro Cepeda', role: 'Encargada campus Pte' },
            { type: 'person', name: 'Bayron González', role: 'Encargado campus Stgo' },
            { type: 'person', name: 'Marianyela Morin', role: 'Encargada campus Montevideo' },
            { type: 'person', name: 'Daniela Martinez', role: 'Encargada campus Pta Arenas' },
          ],
        },
        {
          type: 'group', name: 'Equipo de Iluminación', role: 'Por Campus', icon: '💡', col: 1,
          description: 'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del equipo de producción.',
          children: [
            { type: 'person', name: 'Adriana Oliveros', role: 'Encargada campus Pte' },
            { type: 'person', name: 'Ruben Albornoz\nElkin Traspalacio', role: 'Encargado campus Stgo' },
          ],
        },
        {
          type: 'group', name: 'Equipo de Sonido', role: 'Por Campus', icon: '🔊', col: 1,
          description: 'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del equipo de producción.',
          children: [
            { type: 'person', name: 'Javier Encina', role: 'Encargado campus Pte' },
            { type: 'person', name: 'Benja Saavedra', role: 'Encargado campus Stgo' },
            { type: 'person', name: 'Andrés Zamorano', role: 'Encargado campus Concepción' },
            { type: 'person', name: 'Kevin Sánchez', role: 'Encargado campus Pta Arenas' },
            { type: 'person', name: 'Anderson León', role: 'Encargado campus Maracaibo' },
            { type: 'person', name: 'Ps. Jus Alvares', role: 'Encargado campus Katy' },
          ],
        },
        {
          type: 'group', name: 'Equipo de Stage', role: 'Por Campus', icon: '🎭', col: 1,
          description: 'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del equipo de producción.',
          children: [
            { type: 'person', name: 'Rodrigo Becerra', role: 'Encargado campus Pte' },
            { type: 'person', name: 'Benja Saavedra', role: 'Encargado campus Stgo' },
            { type: 'person', name: 'Gabriel Ceñas', role: 'Encargado campus Katy' },
          ],
        },
        {
          type: 'group', name: 'Equipo de Dirección', role: 'Por Campus', icon: '🎯', col: 1,
          description: 'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del equipo de producción.',
          children: [
            { type: 'person', name: 'Sin asignar', role: 'Encargada campus Pte' },
            { type: 'person', name: 'Sin asignar', role: 'Encargada campus Stgo' },
            { type: 'person', name: 'Sin asignar', role: 'Encargada campus Montevideo' },
          ],
        },
        {
          type: 'group', name: 'Productores Específicos', role: 'Proyectos Especiales', icon: '🎯', col: 2,
          children: [
            { type: 'person', name: 'Mateo Quiroz', role: 'Prod. Experiencias Virtual', description: 'Gestiona y realiza todas las experiencias que ocurren en plataformas digitales como Zoom, incluyendo grupos pequeños, reuniones de liderazgo y otros encuentros virtuales.' },
            { type: 'person', name: 'Josuè Ferrer', role: 'Prod. de Oración Global', description: 'Responsable específico del encuentro de oración, liderando su realización y gestión de principio a fin.' },
            { type: 'person', name: 'Fer Herrera', role: 'Prod. Programación Global', description: 'Coordina y da seguimiento a las noticias y anuncios semanales, asegurando que todos los campus cuenten con los recursos necesarios para comunicar sus actividades a tiempo.' },
          ],
        },
        {
          type: 'group', name: 'Soporte Técnico Global', role: 'Apoyo Especializado', icon: '🔧', col: 3,
          description: 'Personas con roles en otras áreas que prestan apoyo especializado ante problemáticas técnicas complejas o situaciones imprevistas que el equipo necesite resolver.',
          children: [
            { type: 'person', name: 'Bayron González', role: 'Visuales' },
            { type: 'person', name: 'Adri Oliveros', role: 'Iluminación' },
            { type: 'person', name: 'Benja Saavedra', role: 'Sonido' },
          ],
        },
      ],
    },
  ];

  // ── MEDIA ──────────────────────────────────────────────────────
  const mediaTree: NodeDef[] = [
    {
      type: 'leader',
      name: 'Pra. Principal Patricia Alarcón\nPra. Naty Segura',
      role: 'Directora de Media',
      description: 'Lidera el área con una mirada global, define la dirección estratégica del equipo y toma las decisiones que marcan el rumbo del contenido de la organización.',
      children: [
        {
          type: 'group', name: 'Enc. de Media', role: 'Por Campus', icon: '📋', col: 1,
          description: 'Coordinan el área de forma local, gestionando los requerimientos del equipo, administrando el calendario y velando por el buen funcionamiento del voluntariado en su campus.',
          children: [
            { type: 'person', name: 'Aileen González', role: 'Campus Santiago' },
            { type: 'person', name: 'Pra. Naty Segura', role: 'Campus Puente Alto' },
            { type: 'person', name: 'Mariangela Morin', role: 'Campus Montevideo' },
            { type: 'person', name: 'Bastián Oyarzo', role: 'Campus Punta Arenas' },
            { type: 'person', name: 'Pauli Vasquez', role: 'Campus Concepción' },
            { type: 'person', name: 'Carlos Labarca', role: 'Campus Maracaibo' },
          ],
        },
        {
          type: 'group', name: 'Equipo Audiovisual', role: 'Por Campus', icon: '🎥', col: 1,
          description: 'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del encargado de media.',
          children: [
            { type: 'person', name: 'Daninca Contreras', role: 'Encargada campus Pte' },
            { type: 'person', name: 'Gaby Rojas', role: 'Encargada campus Stgo' },
            { type: 'person', name: 'Annavaleria Casadiego', role: 'Encargada campus Montevideo' },
          ],
        },
        {
          type: 'group', name: 'Equipo de Fotografía', role: 'Por Campus', icon: '📷', col: 1,
          description: 'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del encargado de media.',
          children: [
            { type: 'person', name: 'Por confirmar', role: 'Encargada campus Pte' },
            { type: 'person', name: 'Rotatorio', role: 'Encargada campus Stgo' },
            { type: 'person', name: 'Maia Braceiro', role: 'Encargada campus Montevideo' },
          ],
        },
        {
          type: 'group', name: 'Equipo de Stories', role: 'Por Campus', icon: '✨', col: 1,
          description: 'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del encargado de media.',
          children: [
            { type: 'person', name: 'Javiera Burgos', role: 'Encargada campus Pte' },
            { type: 'person', name: 'Por confirmar', role: 'Encargada campus Stgo' },
            { type: 'person', name: 'Donella San Martín', role: 'Encargada campus Montevideo' },
          ],
        },
        {
          type: 'group', name: 'Enc. de Cuentas', role: 'Instagram por Campus', icon: '📱', col: 2,
          description: 'Gestionan la grilla de contenido y mantienen activas las cuentas de Instagram de cada campus, asegurando publicaciones consistentes y alineadas con la comunicación de la organización.',
          children: [
            { type: 'person', name: 'Aileen González', role: 'Campus Santiago' },
            { type: 'person', name: 'Caro Cepeda', role: 'Campus Puente Alto' },
            { type: 'person', name: 'Sara Montero', role: 'Campus Montevideo' },
            { type: 'person', name: 'Eliana', role: 'Campus Punta Arenas' },
            { type: 'person', name: 'Pauli Vasquez', role: 'Campus Concepción' },
            { type: 'person', name: 'Sofi Briceño', role: 'Campus Maracaibo' },
            { type: 'person', name: 'Pr. Nico Burgos', role: 'Campus Katy' },
            { type: 'person', name: 'Sara Montero\nCaro Cepeda\nPra. Naty Segura', role: 'Campus La Plata' },
          ],
        },
        {
          type: 'group', name: 'Equipo Focalizado', role: 'Cuenta Central y Web', icon: '🌐', col: 3,
          description: 'Equipo 100% focalizado en generar contenido específico para la cuenta central y página web.',
          children: [
            { type: 'person', name: 'Gabi Rojas', role: 'Encargada' },
            { type: 'person', name: 'Daninka', role: 'Contenidos' },
            { type: 'person', name: 'Jo Osses', role: 'Contenidos' },
            { type: 'person', name: 'Dirección Creativa', role: 'Apoyo' },
          ],
        },
      ],
    },
  ];

  // ── CREATIVA ───────────────────────────────────────────────────
  const creativaTree: NodeDef[] = [
    {
      type: 'leader',
      name: 'Pr. Nico Burgos',
      role: 'Director Creativo\ny Pastor Campus Virtual',
      description: 'Define la dirección creativa de la organización con una mirada innovadora, asegurando que cada solución comunicacional esté alineada con la visión y genere conexión real con las personas. También lidera y cuida la comunidad online de la organización, velando por su atención pastoral.',
      children: [
        {
          type: 'group', name: 'Equipo Creativo', role: 'Proyectos Especiales', icon: '✨', col: 1,
          description: 'Trabaja junto al Director Creativo en eventos especiales, proyectos de alto impacto y desafíos comunicacionales que requieren un desarrollo creativo más profundo.',
          children: [
            { type: 'person', name: 'Fer Herrera', role: 'Creativo' },
            { type: 'person', name: 'Claudio Navea', role: 'Creativo' },
            { type: 'person', name: 'Pastores Principales', role: 'Apoyo' },
          ],
        },
        {
          type: 'group', name: 'Diseño Gráfico', role: 'Branding', icon: '🎨', col: 2,
          description: 'Responsables del branding de la organización y de responder a los requerimientos gráficos que surgen desde los distintos equipos y proyectos.',
          children: [
            { type: 'person', name: 'Sara Montero', role: 'Encargada de Diseño' },
            { type: 'person', name: 'Voluntarios de Diseño', role: 'Equipo Gráfico' },
          ],
        },
        {
          type: 'group', name: 'Streaming Global', role: 'Transmisiones en Vivo', icon: '📡', col: 3,
          description: 'Lideran el despliegue técnico y creativo de las transmisiones en vivo, cubriendo todos los eventos y encuentros de la organización que requieran streaming.',
          children: [
            { type: 'person', name: 'César Osses', role: 'Productor de Streaming' },
            { type: 'person', name: 'Camarógrafos\nSwitchman\nSonido', role: 'Equipo Técnico' },
          ],
        },
        {
          type: 'group', name: 'Desarrollo Web', role: 'Plataformas Digitales', icon: '💻', col: 4,
          description: 'Gestionan áreas específicas que requieren dirección creativa para su desarrollo, asegurando que cada plataforma comunique con coherencia y propósito.',
          children: [
            { type: 'person', name: 'Caro Cepeda', role: 'Páginas Web' },
            { type: 'person', name: 'Benja Saavedra', role: 'Admin YouTube' },
            { type: 'person', name: 'Mateo Quiroz', role: 'Experiencias Zoom' },
          ],
        },
      ],
    },
  ];

  // ── MARKETING ──────────────────────────────────────────────────
  const marketingTree: NodeDef[] = [
    {
      type: 'leader',
      name: 'Claudio Navea',
      role: 'Director de Marketing Digital',
      description: 'Dirige el área, levanta campañas y les da seguimiento activo, asegurando que cada iniciativa esté orientada a resultados concretos.',
      children: [
        {
          type: 'group', name: 'Equipo de Marketing', role: 'Producción de Campañas', icon: '📣', col: 1,
          description: 'Creativos especializados que ejecutan tareas específicas de producción para las campañas, incluyendo video y ajustes de diseño orientados al marketing.',
          children: [
            { type: 'person', name: 'Benja Saavedra', role: 'Audiovisual' },
            { type: 'person', name: 'Vacante', role: 'Diseñador Gráfico' },
          ],
        },
        {
          type: 'group', name: 'Asesores de Estrategia', role: 'Perspectiva Externa', icon: '💡', col: 2,
          description: 'Aportan perspectiva externa y proponen mejoras a las estrategias del área, colaborando con el director para afinar el enfoque de cada campaña.',
          children: [
            { type: 'person', name: 'Isa Zambrano', role: 'Asesor/a' },
            { type: 'person', name: 'Marco Mella', role: 'Asesor/a' },
            { type: 'person', name: 'Victor Reyes', role: 'Asesor/a' },
          ],
        },
      ],
    },
  ];

  await seedArea(worship.id, worshipTree);
  await seedArea(produccion.id, produccionTree);
  await seedArea(media.id, mediaTree);
  await seedArea(creativa.id, creativaTree);
  await seedArea(marketing.id, marketingTree);

  console.log('✅ Orgchart seed completed');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
