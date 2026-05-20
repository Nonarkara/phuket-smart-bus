/// <reference types="vite/client" />

declare const APP_VERSION: string;

interface ImportMetaEnv {
  readonly VITE_GISTDA_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
