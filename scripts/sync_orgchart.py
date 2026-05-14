#!/usr/bin/env python3
"""
Sincroniza áreas, equipos y membresías con el organigrama-arm-5.0.html
"""
import subprocess, io, csv

PSQL = "/opt/homebrew/opt/libpq/bin/psql"

# ── Conexión (pasa como argumento 1=dev, 2=prod) ─────────────────────────────
import sys
DEV_URL  = "postgresql://postgres.pgedgsugjpcqwgzvrfrm:T0eabQ332G8KpOWQ@aws-1-us-west-1.pooler.supabase.com:5432/postgres"
# ⬇️  Reemplaza con el URL directo de Supabase producción (sin pgbouncer)
PROD_URL = "postgresql://postgres:<PASSWORD>@db.<PROJECT-ID>.supabase.co:5432/postgres"

if len(sys.argv) > 1 and sys.argv[1] == "prod":
    URL = PROD_URL
    if "<PASSWORD>" in URL:
        print("⚠️  Configura PROD_URL en el script antes de ejecutar con: python3 sync_orgchart.py prod")
        sys.exit(1)
    ENV = "PROD"
else:
    URL = DEV_URL
    ENV = "DEV"

print(f"\n{'='*60}")
print(f"  Sincronizando organigrama en {ENV}")
print(f"{'='*60}\n")

def run(sql):
    r = subprocess.run([PSQL, URL], input=sql, capture_output=True, text=True)
    if r.returncode != 0 and r.stderr and "NOTICE" not in r.stderr:
        print(f"  ⚠️  {r.stderr.strip()}")
    return r.stdout.strip()

def q(val):
    """Escape single quotes for SQL."""
    if val is None: return "NULL"
    return "'" + str(val).replace("'", "''") + "'"

# ═══════════════════════════════════════════════════════════════
# 1. ÁREAS
# ═══════════════════════════════════════════════════════════════
print("1. Actualizando áreas...")

AREAS = [
    # (slug, name, color, icon, sort_order, desc)
    ('worship',    'AR Worship',         '#D97706', '🎵', 0,
     'Lideran el ministerio musical de adoración con foco en el desarrollo espiritual'),
    ('produccion', 'Producción',          '#0D9488', '⚙️',  1,
     'Coordinan la parte técnica y logística de todos los encuentros y eventos'),
    ('media',      'Media',              '#2563EB', '📸', 2,
     'Crean y gestionan los contenidos integrando fotografía, audiovisual y redes sociales'),
    ('creativa',   'Dirección Creativa', '#DB2777', '🎨', 3,
     'Entregan soluciones creativas y dirección artística a los distintos equipos'),
    ('marketing',  'Marketing Digital',  '#7C3AED', '📱', 4,
     'Impulsan el crecimiento de las plataformas digitales a través de campañas pagadas'),
]

for slug, name, color, icon, sort_order, desc in AREAS:
    sql = f"""
UPDATE org_areas
SET name={q(name)}, color={q(color)}, icon={q(icon)},
    sort_order={sort_order}, "desc"={q(desc)}, is_active=true
WHERE slug={q(slug)};
"""
    run(sql)
    print(f"  ✓ {name}")

# ═══════════════════════════════════════════════════════════════
# 2. EQUIPOS — definición canónica desde el HTML
# ═══════════════════════════════════════════════════════════════
print("\n2. Sincronizando equipos...")

# (area_slug, name, icon, col_position, sort_order, desc)
TEAMS_DEF = [
    # ── WORSHIP ──────────────────────────────────────────────
    ('worship', 'Enc. de Worship', '📍', 1, 0,
     'Dirigen el equipo de forma local, siendo el puente entre su campus y los directores generales, y ejecutando tareas específicas de su contexto.'),
    ('worship', 'Directores Musicales', '🎼', 1, 1,
     '• Es quien lidera al equipo en escena.\n• Indica a través de la plataforma Play List, la lista de canciones completa que lleva un encuentro o un evento.\n• Carga las canciones en plataforma y además se preocupa de las transiciones entre canción.\n• Dirige al equipo en la estructura de las canciones.'),
    ('worship', 'Enc. por Instrumento', '🎸', 2, 0,
     'Dan soporte musical y alineación técnica a cada instrumento, velando por la calidad y cohesión del equipo en su área específica. De manera global o local.'),
    ('worship', 'Equipo Prod. Musical', '🎛️', 3, 0,
     'Se encarga de procesos como mastering, edición, creación de playlists para eventos y coordinación de grabaciones y proyectos musicales del área.'),
    ('worship', 'Finanzas del Área', '📊', 4, 0,
     'Gestiona y da seguimiento a los recursos económicos del área, velando por una administración ordenada y responsable.'),
    ('worship', 'Equipo ARW', '🎤', 1, 2,
     'La banda de voluntarios que sirve musicalmente en los encuentros regulares y eventos especiales de la organización.'),

    # ── PRODUCCIÓN ────────────────────────────────────────────
    ('produccion', 'Equipo de Producción', '📍', 1, 0,
     'Llevan la producción de los encuentros y eventos de su campus, entregando dirección local y ejecutando las tareas específicas que cada contexto requiere.'),
    ('produccion', 'Equipo de Visuales', '🎬', 1, 1,
     'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del equipo de producción.'),
    ('produccion', 'Equipo de Iluminación', '💡', 1, 2,
     'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del equipo de producción.'),
    ('produccion', 'Equipo de Sonido', '🔊', 1, 3,
     'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del equipo de producción.'),
    ('produccion', 'Equipo de Stage', '🎭', 1, 4,
     'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del equipo de producción.'),
    ('produccion', 'Equipo de Dirección', '📋', 1, 5,
     'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del equipo de producción.'),
    ('produccion', 'Productores Específicos', '🎯', 2, 0,
     None),
    ('produccion', 'Soporte Técnico Global', '🔧', 3, 0,
     'Personas con roles en otras áreas que prestan apoyo especializado ante problemáticas técnicas complejas o situaciones imprevistas que el equipo necesite resolver.'),

    # ── MEDIA ────────────────────────────────────────────────
    ('media', 'Enc. de Media', '📍', 1, 0,
     'Coordinan el área de forma local, gestionando los requerimientos del equipo, administrando el calendario y velando por el buen funcionamiento del voluntariado en su campus.'),
    ('media', 'Equipo Audiovisual', '🎥', 1, 1,
     'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del encargado de media.'),
    ('media', 'Equipo de Fotografía', '📷', 1, 2,
     'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del encargado de media.'),
    ('media', 'Equipo de Stories', '✨', 1, 3,
     'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del encargado de media.'),
    ('media', 'Enc. de Cuentas', '📱', 2, 0,
     'Gestionan la grilla de contenido y mantienen activas las cuentas de Instagram de cada campus, asegurando publicaciones consistentes y alineadas con la comunicación de la organización.'),
    ('media', 'Equipo Focalizado', '🌐', 3, 0,
     'Equipo 100% focalizado en generar contenido específico para la cuenta central y página web.'),

    # ── CREATIVA ────────────────────────────────────────────
    ('creativa', 'Equipo Creativo', '✨', 1, 0,
     'Trabaja junto al Director Creativo en eventos especiales, proyectos de alto impacto y desafíos comunicacionales que requieren un desarrollo creativo más profundo.'),
    ('creativa', 'Diseño Gráfico', '🎨', 2, 0,
     'Responsables del branding de la organización y de responder a los requerimientos gráficos que surgen desde los distintos equipos y proyectos.'),
    ('creativa', 'Streaming Global', '📡', 3, 0,
     'Lideran el despliegue técnico y creativo de las transmisiones en vivo, cubriendo todos los eventos y encuentros de la organización que requieran streaming.'),
    ('creativa', 'Desarrollo Web', '💻', 4, 0,
     'Gestionan áreas específicas que requieren dirección creativa para su desarrollo, asegurando que cada plataforma comunique con coherencia y propósito.'),

    # ── MARKETING ───────────────────────────────────────────
    ('marketing', 'Equipo de Marketing', '📣', 1, 0,
     'Creativos especializados que ejecutan tareas específicas de producción para las campañas, incluyendo video y ajustes de diseño orientados al marketing.'),
    ('marketing', 'Asesores de Estrategia', '💡', 2, 0,
     'Aportan perspectiva externa y proponen mejoras a las estrategias del área, colaborando con el director para afinar el enfoque de cada campaña.'),
]

# Obtener IDs actuales de áreas
area_rows = run("SELECT slug, id FROM org_areas;")
area_id = {}
for line in area_rows.strip().split('\n'):
    parts = [p.strip() for p in line.split('|')]
    if len(parts) == 2 and parts[0] and parts[0] != 'slug':
        area_id[parts[0]] = int(parts[1])

print(f"  Areas: {area_id}")

# Obtener equipos existentes
team_rows = run("SELECT ot.name, ot.id, oa.slug FROM org_teams ot JOIN org_areas oa ON oa.id=ot.area_id;")
existing_teams = {}  # (area_slug, normalized_name) -> id
for line in team_rows.strip().split('\n'):
    parts = [p.strip() for p in line.split('|')]
    if len(parts) == 3 and parts[0] and parts[0] != 'name':
        key = (parts[2], parts[0].lower())
        existing_teams[key] = int(parts[1])

# Desactivar todos los equipos primero (los que no están en la lista canónica se desactivarán)
run("UPDATE org_teams SET is_active=false;")

# Procesar cada equipo canónico
team_id_map = {}  # (area_slug, team_name) -> db_id
for area_slug, name, icon, col, sort, desc in TEAMS_DEF:
    aid = area_id.get(area_slug)
    if not aid:
        print(f"  ⚠️  Área no encontrada: {area_slug}")
        continue

    key = (area_slug, name.lower())
    tid = existing_teams.get(key)

    desc_sql = q(desc) if desc else 'NULL'

    if tid:
        # Actualizar equipo existente
        sql = f"""
UPDATE org_teams
SET name={q(name)}, icon={q(icon)}, col_position={col}, sort_order={sort},
    "desc"={desc_sql}, is_active=true
WHERE id={tid};
"""
        run(sql)
        action = "actualizado"
    else:
        # Crear nuevo equipo
        sql = f"""
INSERT INTO org_teams(area_id, name, icon, col_position, sort_order, "desc", is_active)
VALUES ({aid}, {q(name)}, {q(icon)}, {col}, {sort}, {desc_sql}, true)
RETURNING id;
"""
        out = run(sql)
        # Parse returned ID
        for line in out.split('\n'):
            line = line.strip()
            if line.isdigit():
                tid = int(line)
                break
        action = "creado"

    team_id_map[(area_slug, name)] = tid
    print(f"  ✓ [{area_slug}] {name} (id={tid}) — {action}")

# Desactivar el equipo "La Plata" y otros no canónicos
run("UPDATE org_teams SET is_active=false WHERE name='La Plata';")
print(f"  ✗ 'La Plata' desactivado")

# Obtener IDs finales de todos los equipos activos
final_team_rows = run("SELECT ot.name, ot.id, oa.slug FROM org_teams ot JOIN org_areas oa ON oa.id=ot.area_id WHERE ot.is_active=true;")
all_team_ids = {}
for line in final_team_rows.strip().split('\n'):
    parts = [p.strip() for p in line.split('|')]
    if len(parts) == 3 and parts[0] and parts[0] != 'name':
        all_team_ids[(parts[2], parts[0])] = int(parts[1])

# ═══════════════════════════════════════════════════════════════
# 3. MEMBRESÍAS
# ═══════════════════════════════════════════════════════════════
print("\n3. Sincronizando membresías...")

# Mapeo nombre → user_id
NAME_TO_ID = {
    # primero apellido o nombre completo para mayor precisión
    'patricia burgos': 3,
    'patricio burgos': 4,
    'rodrigo quiroz':  5,
    'priscilla fabio': 6,
    'pri fabio':       6,
    'nicolás burgos':  7,
    'nico burgos':     7,
    'pr. nico burgos': 7,
    'ps. nico burgos': 7,
    'pablo ortiz':     8,
    'newman guevara':  9,
    'samuel montalva': 10,
    'anderson león':   11,
    'kari alvarez':    12,
    'karina álvarez':  12,
    'pra. kari alvarez': 12,
    'ismael gonzález': 13,
    'isma gonzález':   13,
    'treicy aceitón':  14,
    'min. treicy aceitón': 14,
    'kika muñoz':      15,
    'paola ortiz':     16,
    'pra. paola ortiz': 16,
    'kengev peña':     17,
    'naty delfín':     18,
    'benjamín saavedra': 19,
    'benja saavedra':  19,
    'alejandro montero': 20,
    'andrés zamorano': 21,
    'josué ferrer':    22,
    'fer herrera':     23,
    'fernanda herrera': 23,
    'mateo quiroz':    24,
    'bayron gonzález': 25,
    'carolina cepeda': 26,
    'caro cepeda':     26,
    'adriana oliveros': 27,
    'adri oliveros':   27,
    'patricia alarcón': 28,
    'naty segura':     29,
    'pra. naty segura': 29,
    'aileen gonzález': 30,
    'mariangela morin': 31,
    'marianyela morin': 31,
    'bastián oyarzo':  32,
    'paulina vásquez': 33,
    'pauli vasquez':   33,
    'carlos labarca':  34,
    'gabriela rojas':  35,
    'gaby rojas':      35,
    'gabi rojas':      35,
    'césar osses':     36,
    'sara montero':    37,
    'claudio navea':   38,
}

def find_user(name_raw):
    """Busca el user_id para un nombre del HTML."""
    name = name_raw.strip().lower()
    # Direct match
    if name in NAME_TO_ID:
        return NAME_TO_ID[name]
    # Partial match (first/last name substring)
    for key, uid in NAME_TO_ID.items():
        if key in name or name in key:
            return uid
    return None

# Limpiar TODAS las membresías
run("SET session_replication_role = replica; TRUNCATE org_memberships RESTART IDENTITY;")
print("  ✓ Membresías existentes eliminadas")

memberships = []  # (user_id, area_id_or_none, team_id_or_none, role, custom_title, sort_order)

# ── Área WORSHIP ─────────────────────────────────────────────
w_area = area_id['worship']
w_teams = {name: all_team_ids.get(('worship', name)) for name in [
    'Enc. de Worship', 'Directores Musicales', 'Enc. por Instrumento',
    'Equipo Prod. Musical', 'Finanzas del Área', 'Equipo ARW'
]}

# Area leaders
for uid in [3, 4, 5, 6]:  # Patricia B, Patricio B, Rodrigo Q, Priscilla F
    memberships.append((uid, w_area, None, 'area_leader', None, 0))

# Enc. de Worship — líderes por campus
enc_w = w_teams['Enc. de Worship']
if enc_w:
    members = [
        (6,  'Campus Santiago'),
        (6,  'Campus Puente Alto'),    # Priscilla también lidera PA
        (8,  'Campus Montevideo'),     # Pablo Ortiz
        (9,  'Campus Punta Arenas'),   # Newman Guevara
        (10, 'Campus Concepción'),     # Samuel Montalva
        (11, 'Campus Maracaibo'),      # Anderson León
        (12, 'Campus Katy'),           # Kari Alvarez
        (5,  'Campus Santiago'),       # Rodrigo Quiroz
    ]
    for i, (uid, title) in enumerate(members):
        memberships.append((uid, None, enc_w, 'team_leader', title, i))

# Directores Musicales
dir_m = w_teams['Directores Musicales']
if dir_m:
    members = [
        (13, 'Campus Santiago y Puente Alto'),  # Isma González
        (5,  'Campus Santiago y Puente Alto'),  # Rodrigo Quiroz
        (6,  'Campus Santiago y Puente Alto'),  # Priscilla Fabio
        (7,  'Campus Katy'),                    # Nico Burgos
        (8,  'Campus Montevideo'),              # Pablo Ortiz
        (9,  'Campus Punta Arenas'),            # Newman Guevara
        (10, 'Campus Concepción'),              # Samuel Montalva
        (11, 'Campus Maracaibo'),               # Anderson León
        (12, 'Campus Katy'),                    # Karina Álvarez
    ]
    for i, (uid, title) in enumerate(members):
        role = 'team_leader' if i == 0 else 'member'
        memberships.append((uid, None, dir_m, role, title, i))

# Enc. por Instrumento
enc_i = w_teams['Enc. por Instrumento']
if enc_i:
    members = [
        (14, 'Voces'),     # Treicy Aceitón
        (13, 'Bajistas'),  # Isma González (Juan José González not in DB)
    ]
    for i, (uid, title) in enumerate(members):
        role = 'team_leader' if i == 0 else 'member'
        memberships.append((uid, None, enc_i, role, title, i))

# Equipo Prod. Musical
prod_m = w_teams['Equipo Prod. Musical']
if prod_m:
    members = [
        (13, 'Productor Musical'),      # Isma González
        (7,  'Ingeniero de Mezcla'),    # Nico Burgos
        (5,  'Composición'),            # Rodrigo Quiroz
        (6,  'Composición'),            # Priscilla Fabio
    ]
    for i, (uid, title) in enumerate(members):
        role = 'team_leader' if i == 0 else 'member'
        memberships.append((uid, None, prod_m, role, title, i))

# Finanzas del Área
fin = w_teams['Finanzas del Área']
if fin:
    members = [
        (15, 'Encargada Chile'),        # Kika Muñoz
        (16, 'Encargada Montevideo'),   # Paola Ortiz
    ]
    for i, (uid, title) in enumerate(members):
        role = 'team_leader' if i == 0 else 'member'
        memberships.append((uid, None, fin, role, title, i))

# Equipo ARW — sin usuarios concretos en la DB (voluntarios)
# Skip (no users to add)

# ── Área PRODUCCIÓN ──────────────────────────────────────────
p_area = area_id['produccion']
p_teams = {name: all_team_ids.get(('produccion', name)) for name in [
    'Equipo de Producción', 'Equipo de Visuales', 'Equipo de Iluminación',
    'Equipo de Sonido', 'Equipo de Stage', 'Equipo de Dirección',
    'Productores Específicos', 'Soporte Técnico Global'
]}

# Area leaders
for uid in [4, 5]:  # Patricio B, Rodrigo Q
    memberships.append((uid, p_area, None, 'area_leader', None, 0))

# Equipo de Producción
eq_p = p_teams['Equipo de Producción']
if eq_p:
    members = [
        (17, 'Campus Santiago'),    # Kengev Peña
        (18, 'Campus Santiago'),    # Naty Delfín
        (19, 'Campus Santiago'),    # Benja Saavedra
        (20, 'Campus Montevideo'),  # Alejandro Montero
        (9,  'Campus Punta Arenas'), # Newman Guevara
        (21, 'Campus Concepción'),  # Andrés Zamorano
        (11, 'Campus Maracaibo'),   # Anderson León
        (7,  'Campus Katy'),        # Nico Burgos
    ]
    for i, (uid, title) in enumerate(members):
        role = 'team_leader' if i == 0 else 'member'
        memberships.append((uid, None, eq_p, role, title, i))

# Equipo de Visuales
eq_v = p_teams['Equipo de Visuales']
if eq_v:
    members = [
        (25, 'Encargado campus Stgo'),  # Bayron González
        (26, 'Encargada campus Pte'),   # Caro Cepeda
        (31, 'Encargada campus Montevideo'), # Mariangela Morin
    ]
    for i, (uid, title) in enumerate(members):
        role = 'team_leader' if i == 0 else 'member'
        memberships.append((uid, None, eq_v, role, title, i))

# Equipo de Iluminación
eq_il = p_teams['Equipo de Iluminación']
if eq_il:
    members = [
        (27, 'Encargada campus Pte'),  # Adriana Oliveros
    ]
    for i, (uid, title) in enumerate(members):
        memberships.append((uid, None, eq_il, 'team_leader', title, i))

# Equipo de Sonido
eq_s = p_teams['Equipo de Sonido']
if eq_s:
    members = [
        (19, 'Encargado campus Stgo'),       # Benja Saavedra
        (21, 'Encargado campus Concepción'), # Andrés Zamorano
        (11, 'Encargado campus Maracaibo'),  # Anderson León
    ]
    for i, (uid, title) in enumerate(members):
        role = 'team_leader' if i == 0 else 'member'
        memberships.append((uid, None, eq_s, role, title, i))

# Equipo de Stage
eq_st = p_teams['Equipo de Stage']
if eq_st:
    members = [
        (19, 'Encargado campus Stgo'),   # Benja Saavedra
    ]
    for i, (uid, title) in enumerate(members):
        memberships.append((uid, None, eq_st, 'team_leader', title, i))

# Equipo de Dirección — sin asignar, skip

# Productores Específicos
prod_e = p_teams['Productores Específicos']
if prod_e:
    members = [
        (24, 'Prod. Experiencias Virtual'),  # Mateo Quiroz
        (22, 'Prod. de Oración Global'),     # Josué Ferrer
        (23, 'Prod. Programación Global'),   # Fer Herrera
    ]
    for i, (uid, title) in enumerate(members):
        role = 'team_leader' if i == 0 else 'member'
        memberships.append((uid, None, prod_e, role, title, i))

# Soporte Técnico Global
sop = p_teams['Soporte Técnico Global']
if sop:
    members = [
        (25, 'Visuales'),    # Bayron González
        (27, 'Iluminación'), # Adri Oliveros
        (19, 'Sonido'),      # Benja Saavedra
    ]
    for i, (uid, title) in enumerate(members):
        memberships.append((uid, None, sop, 'member', title, i))

# ── Área MEDIA ──────────────────────────────────────────────
m_area = area_id['media']
m_teams = {name: all_team_ids.get(('media', name)) for name in [
    'Enc. de Media', 'Equipo Audiovisual', 'Equipo de Fotografía',
    'Equipo de Stories', 'Enc. de Cuentas', 'Equipo Focalizado'
]}

# Area leaders
for uid in [28, 29]:  # Patricia Alarcón, Naty Segura
    memberships.append((uid, m_area, None, 'area_leader', None, 0))

# Enc. de Media
enc_m = m_teams['Enc. de Media']
if enc_m:
    members = [
        (30, 'Campus Santiago'),     # Aileen González
        (29, 'Campus Puente Alto'),  # Naty Segura
        (31, 'Campus Montevideo'),   # Mariangela Morin
        (32, 'Campus Punta Arenas'), # Bastián Oyarzo
        (33, 'Campus Concepción'),   # Pauli Vásquez
        (34, 'Campus Maracaibo'),    # Carlos Labarca
    ]
    for i, (uid, title) in enumerate(members):
        role = 'team_leader' if i == 0 else 'member'
        memberships.append((uid, None, enc_m, role, title, i))

# Equipo Audiovisual
eq_av = m_teams['Equipo Audiovisual']
if eq_av:
    members = [
        (35, 'Encargada campus Stgo'),     # Gabriela Rojas
        (31, 'Encargada campus Montevideo'), # Mariangela Morin
    ]
    for i, (uid, title) in enumerate(members):
        role = 'team_leader' if i == 0 else 'member'
        memberships.append((uid, None, eq_av, role, title, i))

# Equipo de Fotografía — "Por confirmar" / Rotatorio, skip

# Equipo de Stories — Javiera Burgos / Donella / not in DB, skip

# Enc. de Cuentas
enc_c = m_teams['Enc. de Cuentas']
if enc_c:
    members = [
        (30, 'Campus Santiago'),     # Aileen González
        (26, 'Campus Puente Alto'),  # Caro Cepeda
        (37, 'Campus Montevideo'),   # Sara Montero
        (33, 'Campus Concepción'),   # Pauli Vásquez
        (7,  'Campus Katy'),         # Nico Burgos
        (29, 'Campus La Plata'),     # Naty Segura
    ]
    for i, (uid, title) in enumerate(members):
        role = 'team_leader' if i == 0 else 'member'
        memberships.append((uid, None, enc_c, role, title, i))

# Equipo Focalizado
eq_f = m_teams['Equipo Focalizado']
if eq_f:
    members = [
        (35, 'Encargada'),   # Gabi Rojas
    ]
    for i, (uid, title) in enumerate(members):
        memberships.append((uid, None, eq_f, 'team_leader', title, i))

# ── Área CREATIVA ─────────────────────────────────────────────
c_area = area_id['creativa']
c_teams = {name: all_team_ids.get(('creativa', name)) for name in [
    'Equipo Creativo', 'Diseño Gráfico', 'Streaming Global', 'Desarrollo Web'
]}

# Area leaders
memberships.append((7, c_area, None, 'area_leader', 'Director Creativo y Pastor Campus Virtual', 0))

# Equipo Creativo
eq_cr = c_teams['Equipo Creativo']
if eq_cr:
    members = [
        (23, 'Creativo'),  # Fer Herrera
        (38, 'Creativo'),  # Claudio Navea
    ]
    for i, (uid, title) in enumerate(members):
        role = 'team_leader' if i == 0 else 'member'
        memberships.append((uid, None, eq_cr, role, title, i))

# Diseño Gráfico
dis_g = c_teams['Diseño Gráfico']
if dis_g:
    members = [
        (37, 'Encargada de Diseño'),  # Sara Montero
    ]
    for i, (uid, title) in enumerate(members):
        memberships.append((uid, None, dis_g, 'team_leader', title, i))

# Streaming Global
str_g = c_teams['Streaming Global']
if str_g:
    members = [
        (36, 'Productor de Streaming'),  # César Osses
    ]
    for i, (uid, title) in enumerate(members):
        memberships.append((uid, None, str_g, 'team_leader', title, i))

# Desarrollo Web
des_w = c_teams['Desarrollo Web']
if des_w:
    members = [
        (26, 'Páginas Web'),    # Caro Cepeda
        (19, 'Admin YouTube'),  # Benja Saavedra
        (24, 'Experiencias Zoom'), # Mateo Quiroz
    ]
    for i, (uid, title) in enumerate(members):
        role = 'team_leader' if i == 0 else 'member'
        memberships.append((uid, None, des_w, role, title, i))

# ── Área MARKETING ────────────────────────────────────────────
mk_area = area_id['marketing']
mk_teams = {name: all_team_ids.get(('marketing', name)) for name in [
    'Equipo de Marketing', 'Asesores de Estrategia'
]}

# Area leader
memberships.append((38, mk_area, None, 'area_leader', 'Director de Marketing Digital', 0))

# Equipo de Marketing
eq_mk = mk_teams['Equipo de Marketing']
if eq_mk:
    members = [
        (19, 'Audiovisual'),  # Benja Saavedra
    ]
    for i, (uid, title) in enumerate(members):
        memberships.append((uid, None, eq_mk, 'team_leader', title, i))

# Asesores de Estrategia — Isa Zambrano, Marco Mella, Victor Reyes not in DB, skip

# ═══════════════════════════════════════════════════════════════
# 4. INSERTAR MEMBRESÍAS
# ═══════════════════════════════════════════════════════════════
print(f"\n  Total membresías a insertar: {len(memberships)}")

# Deduplicar (un usuario no puede tener el mismo role+area/team twice)
seen = set()
unique_memberships = []
for m in memberships:
    uid, aid, tid, role, title, sort = m
    key = (uid, aid, tid, role)
    if key not in seen:
        seen.add(key)
        unique_memberships.append(m)

print(f"  Total después de deduplicar: {len(unique_memberships)}")

# Construir VALUES
values = []
for uid, aid, tid, role, title, sort in unique_memberships:
    area_val = str(aid) if aid else 'NULL'
    team_val = str(tid) if tid else 'NULL'
    title_val = q(title) if title else 'NULL'
    values.append(f"({uid}, {area_val}, {team_val}, '{role}', {title_val}, {sort})")

if values:
    values_str = ',\n'.join(values)
    insert_sql = f"""
SET session_replication_role = replica;
INSERT INTO org_memberships(user_id, area_id, team_id, role, custom_title, sort_order)
VALUES
{values_str};
"""
    out = run(insert_sql)
    print(f"  ✓ {out}")
else:
    print("  ⚠️  No hay membresías para insertar")

# ═══════════════════════════════════════════════════════════════
# 5. VERIFICACIÓN FINAL
# ═══════════════════════════════════════════════════════════════
print("\n4. Verificación final...")
print(run("""
SELECT 'areas'        as tabla, COUNT(*) as total FROM org_areas WHERE is_active=true
UNION ALL
SELECT 'equipos',     COUNT(*) FROM org_teams WHERE is_active=true
UNION ALL
SELECT 'membresías',  COUNT(*) FROM org_memberships
ORDER BY tabla;
"""))

print("\n✅ Sincronización completada\n")
