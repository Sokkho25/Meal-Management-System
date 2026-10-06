import { Outlet } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-9 rounded-xl ring-2 ring-white/20" />
          <span className="text-lg font-semibold">MessMate</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">Meals, bazar and monthly bills, settled without arguments.</h1>
          <ul className="mt-8 space-y-3 text-brand-100">
            {['Record meals in a few taps from your phone', 'Automatic meal rate and member balances', 'Every number shows how it was calculated', 'Each month kept separately, history preserved'].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-brand-300" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-brand-200">For bachelor messes, shared flats and family households.</p>
      </div>
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src="/favicon.svg" alt="" className="size-9" />
            <span className="text-lg font-semibold">MessMate</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
