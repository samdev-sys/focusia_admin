import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './AdminApp';
import './index.css';

/**
 * Punto de entrada del panel de administración.
 *
 * App de React independiente de la de usuario: se compila y despliega por
 * separado, en `/admin`, sin cargar el bundle de la app normal.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
