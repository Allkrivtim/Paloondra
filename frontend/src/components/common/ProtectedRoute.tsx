import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { PermissionKey } from '../../types';
import Spinner from './Spinner';

interface Props {
  children: JSX.Element;
  /** Redirects to the Dashboard instead of rendering, for routes only admins should reach (e.g. Users). The backend enforces this independently - this is just UX, not the real gate. */
  adminOnly?: boolean;
  /** Redirects to the Dashboard instead of rendering unless hasPermission(key) - always true for admins. The backend enforces this independently (requirePermission) - this is just UX, not the real gate. */
  permission?: PermissionKey;
}

export default function ProtectedRoute({ children, adminOnly, permission }: Props) {
  const { t } = useTranslation();
  const { isAuthenticated, isAdmin, hasPermission, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-panel-muted">
        <Spinner /> {t('protectedRoute.loading')}
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }
  if (permission && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
