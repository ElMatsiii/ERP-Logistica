/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del portal del ERP (RRHH), donde se inicia sesión. Ver client/.env.example */
  readonly VITE_RRHH_PORTAL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
