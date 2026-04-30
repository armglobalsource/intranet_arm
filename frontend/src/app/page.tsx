import { redirect } from 'next/navigation';

// La raíz redirige al dashboard o al login según sesión
export default function RootPage() {
  redirect('/dashboard');
}
