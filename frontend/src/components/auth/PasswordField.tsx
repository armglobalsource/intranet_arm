'use client';
import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { authInput } from './AuthShell';

export const PasswordField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false);
  return <div className="relative">
    <input {...props} ref={ref} type={visible ? 'text' : 'password'} className={`${authInput} pr-14`} />
    <button type="button" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-[#627369] hover:text-[#182d25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#315e49]">
      {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  </div>;
});
