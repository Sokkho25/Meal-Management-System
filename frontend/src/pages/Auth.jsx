import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Button, Input } from '../components/ui';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [v, setV] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(v.email, v.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-500">Log in to your household.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Input label="Email" type="email" autoComplete="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        <Input label="Password" type="password" autoComplete="current-password" required value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={busy}>
          Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        New here?{' '}
        <Link to="/register" className="font-medium text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [v, setV] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register(v);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500">If a manager added your email, you'll join their household automatically.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Input label="Full name" required autoComplete="name" value={v.name} onChange={set('name')} />
        <Input label="Email" type="email" required autoComplete="email" value={v.email} onChange={set('email')} />
        <Input label="Mobile (optional)" type="tel" autoComplete="tel" value={v.phone} onChange={set('phone')} />
        <Input label="Password" type="password" required minLength={8} autoComplete="new-password" hint="At least 8 characters" value={v.password} onChange={set('password')} />
        <Button type="submit" className="w-full" size="lg" loading={busy}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      setDone(await api.post('/auth/forgot-password', { email }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      {done ? (
        <div className="mt-6 space-y-3 text-sm text-slate-600">
          <p>{done.message}</p>
          {done.devResetUrl && (
            <p className="rounded-xl bg-amber-50 p-3 text-amber-800">
              Development mode: <a className="font-medium underline" href={done.devResetUrl.replace(/^https?:\/\/[^/]+/, '')}>open reset link</a>
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" className="w-full" size="lg" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const { acceptToken } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await api.post('/auth/reset-password', { token: params.get('token'), password });
      acceptToken(d.token, d.user);
      toast.success('Password updated');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Input label="New password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="w-full" size="lg" loading={busy}>
          Update password
        </Button>
      </form>
    </>
  );
}
