import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Políticas de Privacidad y Seguridad',
};

const LAST_UPDATED = '10 de septiembre de 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-[15px] font-semibold text-white mb-2.5">{title}</h2>
      <div className="space-y-3 text-[13.5px] text-white/65 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PoliticasPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0d0d0d' }}>
      <div className="max-w-2xl mx-auto px-6 py-10">

        <div className="flex items-center justify-between mb-10">
          <Image src="/logo.png" alt="ARM Global" width={130} height={44} className="object-contain" priority />
          <Link href="/" className="text-[12px] text-white/40 hover:text-white/70 transition-colors">
            ← Volver
          </Link>
        </div>

        <p className="text-[11px] font-medium uppercase tracking-widest text-white/30 mb-2">Documento legal</p>
        <h1 className="text-2xl font-bold text-white mb-1.5">Políticas de Privacidad y Seguridad</h1>
        <p className="text-[12px] text-white/35 mb-10">Última actualización: {LAST_UPDATED}</p>

        <div className="rounded-xl p-4 mb-10 text-[12.5px] text-white/55 leading-relaxed" style={{ background: '#151515', border: '1px solid #232323' }}>
          Esta política aplica a toda persona que se registra o utiliza la plataforma interna
          de ARM Global (&quot;la Plataforma&quot;), sin importar el país desde el que se conecte.
          Al marcar &quot;He leído y acepto las políticas de ARM Global&quot; durante el registro,
          confirmas que has leído, comprendido y aceptado este documento en su totalidad.
        </div>

        <Section title="1. Identidad del responsable del tratamiento">
          <p>
            ARM Global (&quot;nosotros&quot;, &quot;la organización&quot;) es responsable del tratamiento de
            los datos personales que recopila a través de esta Plataforma. Puedes contactarnos
            para cualquier consulta relacionada con esta política escribiendo a{' '}
            <a href="mailto:privacidad@armglobal.org" className="text-white/80 underline underline-offset-2 hover:text-white">
              privacidad@armglobal.org
            </a>.
          </p>
        </Section>

        <Section title="2. Datos que recopilamos">
          <p>Recopilamos los datos que entregas directamente al registrarte y completar tu perfil:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Datos de identificación: nombre, apellido, nombre preferido, correo electrónico y contraseña (almacenada de forma cifrada, nunca en texto plano).</li>
            <li>Datos de contacto: teléfono y código de país.</li>
            <li>Datos demográficos: fecha de nacimiento y género (este último es opcional).</li>
            <li>Datos de participación: campus principal, hace cuánto eres parte de ARM Global, si sirves actualmente y en qué área, y tus áreas de interés.</li>
            <li>Datos de procedencia: cómo llegaste a ARM Global y, si aplica, quién te invitó.</li>
            <li>Fotografía de perfil, si decides subir una.</li>
            <li>Datos técnicos básicos generados por el uso de la Plataforma (registros de acceso, fecha de última conexión) con fines de seguridad.</li>
          </ul>
        </Section>

        <Section title="3. Para qué usamos tus datos">
          <p>Usamos tus datos personales exclusivamente para:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Crear y administrar tu cuenta, incluyendo el proceso de aprobación de registro.</li>
            <li>Mantener actualizado el directorio interno y el organigrama de la organización.</li>
            <li>Coordinar tu participación en equipos, ministerios y actividades de servicio.</li>
            <li>Enviarte comunicaciones institucionales relevantes (por correo y/o WhatsApp) y felicitaciones de cumpleaños.</li>
            <li>Generar reportes internos agregados y anónimos sobre voluntariado y asistencia.</li>
            <li>Prevenir accesos no autorizados y proteger la seguridad de la Plataforma.</li>
          </ul>
          <p>No usamos tus datos para fines publicitarios ni los vendemos a terceros.</p>
        </Section>

        <Section title="4. Base legal y consentimiento">
          <p>
            El tratamiento de tus datos se basa en el consentimiento que otorgas expresamente al
            marcar la casilla de aceptación durante el registro, de conformidad con la Ley N.º
            19.628 sobre Protección de la Vida Privada y, en lo que corresponda según su entrada
            en vigencia, la Ley N.º 21.719 de Protección de Datos Personales de Chile. Puedes
            retirar tu consentimiento en cualquier momento contactándonos, sin que esto afecte
            la licitud del tratamiento realizado con anterioridad.
          </p>
        </Section>

        <Section title="5. Con quién compartimos tus datos">
          <p>
            No compartimos tus datos personales con terceros ajenos a ARM Global, salvo con
            proveedores de infraestructura tecnológica que procesan datos en nuestro nombre bajo
            estrictos acuerdos de confidencialidad (por ejemplo, servicios de nube de Google
            Cloud / Firebase, donde se alojan de forma segura los datos de la Plataforma), o
            cuando la ley nos obligue a hacerlo ante una autoridad competente.
          </p>
        </Section>

        <Section title="6. Transferencias internacionales">
          <p>
            ARM Global tiene presencia en distintos países. Si te registras desde fuera de Chile,
            tus datos podrán ser transferidos y almacenados en servidores ubicados en otras
            jurisdicciones (incluyendo Estados Unidos, donde se alojan los servidores de nuestro
            proveedor de infraestructura). En todos los casos aplicamos las mismas medidas de
            seguridad descritas en esta política, independientemente del país de origen de tus
            datos.
          </p>
        </Section>

        <Section title="7. Conservación de los datos">
          <p>
            Conservamos tus datos mientras mantengas una cuenta activa en la Plataforma. Si
            solicitas la eliminación de tu cuenta, eliminaremos o anonimizaremos tus datos
            personales dentro de un plazo razonable, salvo que debamos conservar cierta
            información por obligación legal o para la defensa de derechos ante autoridades
            competentes.
          </p>
        </Section>

        <Section title="8. Tus derechos (Derechos ARCO y Portabilidad)">
          <p>Sin importar el país desde el que te registres, puedes ejercer en cualquier momento los siguientes derechos sobre tus datos:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-white/80">Acceso:</strong> saber qué datos tuyos tenemos y cómo los usamos.</li>
            <li><strong className="text-white/80">Rectificación:</strong> corregir datos inexactos o desactualizados.</li>
            <li><strong className="text-white/80">Cancelación:</strong> solicitar la eliminación de tus datos cuando ya no sean necesarios.</li>
            <li><strong className="text-white/80">Oposición:</strong> oponerte a un tratamiento específico de tus datos.</li>
            <li><strong className="text-white/80">Portabilidad:</strong> solicitar una copia de tus datos en un formato estructurado.</li>
          </ul>
          <p>
            Puedes ejercer estos derechos, sin costo, escribiendo a{' '}
            <a href="mailto:privacidad@armglobal.org" className="text-white/80 underline underline-offset-2 hover:text-white">
              privacidad@armglobal.org
            </a>{' '}
            . Muchos de estos datos también puedes verlos y corregirlos tú mismo directamente
            desde tu perfil dentro de la Plataforma.
          </p>
        </Section>

        <Section title="9. Seguridad de la información">
          <p>
            Aplicamos medidas técnicas y organizativas razonables para proteger tus datos frente
            a accesos no autorizados, pérdida o alteración: contraseñas almacenadas con hash
            criptográfico irreversible, comunicación cifrada (HTTPS/TLS) entre tu dispositivo y
            nuestros servidores, control de acceso basado en roles y permisos dentro de la
            organización, y bloqueo automático de cuentas nuevas hasta su aprobación por un
            administrador.
          </p>
        </Section>

        <Section title="10. Menores de edad">
          <p>
            El registro directo en la Plataforma está dirigido a personas mayores de 18 años.
            Los datos de niños, niñas y adolescentes que participan en ministerios infantiles o
            juveniles (por ejemplo, Kids o Tweens) son ingresados y administrados por un adulto
            responsable (madre, padre, tutor o líder autorizado), no por el menor directamente.
          </p>
        </Section>

        <Section title="11. Cambios a esta política">
          <p>
            Podemos actualizar esta política para reflejar cambios legales, técnicos u
            organizativos. Si los cambios son significativos, te lo notificaremos por los medios
            de contacto que tengamos registrados. La fecha de la última actualización siempre
            aparece al inicio de este documento.
          </p>
        </Section>

        <Section title="12. Contacto">
          <p>
            Si tienes preguntas sobre esta política o sobre cómo tratamos tus datos, escríbenos a{' '}
            <a href="mailto:privacidad@armglobal.org" className="text-white/80 underline underline-offset-2 hover:text-white">
              privacidad@armglobal.org
            </a>.
          </p>
        </Section>

        <div className="pt-6 mt-6" style={{ borderTop: '1px solid #1f1f1f' }}>
          <Link href="/" className="text-[12px] text-white/40 hover:text-white/70 transition-colors">
            ← Volver a ARM Global
          </Link>
        </div>

      </div>
    </div>
  );
}
