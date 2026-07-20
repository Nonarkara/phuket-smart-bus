/**
 * Base-aware client paths.
 *
 * Vite serves this project at `/` locally and `/phuket-smart-bus/` on
 * GitHub Pages. Keeping that difference here prevents navigation links and
 * route checks from silently leaving the deployed app.
 */
const viteBase = import.meta.env.BASE_URL || "/";
const basePath = viteBase === "/" ? "" : viteBase.replace(/\/$/, "");

export function appPath(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return `${basePath}/` || "/";
  return `${basePath}${normalized}`;
}

export function routePath(pathname: string): string {
  if (!basePath) return pathname;
  if (pathname === basePath) return "/";
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length);
  return pathname;
}
