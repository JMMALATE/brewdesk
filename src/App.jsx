import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { homePathFor, MANAGERS, ROLES } from './lib/roles.js';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import Menu from './pages/Menu.jsx';
import Orders from './pages/Orders.jsx';
import POS from './pages/POS.jsx';
import Staff from './pages/Staff.jsx';

function HomeRedirect() {
  const { role } = useAuth();
  return <Navigate to={homePathFor(role)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Any active staff member */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="pos" element={<POS />} />
          <Route path="orders" element={<Orders />} />

          {/* Managers and owners only */}
          <Route element={<ProtectedRoute roles={MANAGERS} />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="menu" element={<Menu />} />
          </Route>

          {/* Owner only */}
          <Route element={<ProtectedRoute roles={[ROLES.OWNER]} />}>
            <Route path="staff" element={<Staff />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
