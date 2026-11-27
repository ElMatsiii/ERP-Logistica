import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { aplicarTokenDelPortal } from './api/sesion';
import './index.css';

// Inicio de sesión desde el portal de RRHH: lee #token=<jwt>, lo guarda y lo quita de la URL
// antes de montar la app (y por lo tanto antes de cualquier petición).
aplicarTokenDelPortal();

// Si el portal se abre sobre una pestaña donde Logística ya estaba cargada, solo cambia el fragmento
// (sin recargar). Se recarga para procesar el token igual que en una carga normal y no dejarlo en la URL.
window.addEventListener('hashchange', () => {
  if (new URLSearchParams(window.location.hash.slice(1)).has('token')) {
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
