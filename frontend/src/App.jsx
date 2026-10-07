import { lazy, Suspense, useRef } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useWorkspace } from './context/WorkspaceContext';
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';
import { PageLoader } from './components/ui';
import { ForgotPassword, Login, Register, ResetPassword } from './pages/Auth';
import Onboarding from './pages/Onboarding';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Meals = lazy(() => import('./pages/Meals'));
const Bazar = lazy(() => import('./pages/Bazar'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Contributions = lazy(() => import('./pages/Contributions'));
const Members = lazy(() => import('./pages/Members'));
const Shopping = lazy(() => import('./pages/Shopping'));
const Calendar = lazy(() => import('./pages/Calendar'));
const DayView = lazy(() => import('./pages/DayView'));
const MealPlan = lazy(() => import('./pages/MealPlan'));
const Reports = lazy(() => import('./pages/Reports'));
const History = lazy(() => import('./pages/History'));
const Settings = lazy(() => import('./pages/Settings'));
const CloseMonth = lazy(() => import('./pages/CloseMonth'));
const NewMonth = lazy(() => import('./pages/NewMonth'));
const Owner = lazy(() => import('./pages/Owner'));

function RequireAuth() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

function RequireWorkspace() {
  const { loading, households, month } = useWorkspace();
  if (loading || households === null) return <PageLoader />;
  if (!households.length || !month) return <Navigate to="/welcome" replace />;
  return <Outlet />;
}

function GuestOnly() {
  const { user, ready } = useAuth();
  if (!ready) return <PageLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function Welcome() {
  const { loading, households, month } = useWorkspace();
  const [params] = useSearchParams();
  // Decide once on arrival; the onboarding form navigates on its own after creating a household.
  const decision = useRef(null);
  if (loading || households === null) return <PageLoader />;
  if (decision.current === null) decision.current = Boolean(households.length && month && !params.get('new'));
  if (decision.current) return <Navigate to="/dashboard" replace />;
  return <Onboarding />;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/welcome" element={<Welcome />} />
          <Route element={<RequireWorkspace />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/meals" element={<Meals />} />
              <Route path="/bazar" element={<Bazar />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/contributions" element={<Contributions />} />
              <Route path="/members" element={<Members />} />
              <Route path="/shopping" element={<Shopping />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/day/:date" element={<DayView />} />
              <Route path="/meal-plan" element={<MealPlan />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/close" element={<CloseMonth />} />
              <Route path="/months/new" element={<NewMonth />} />
              <Route path="/owner" element={<Owner />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
