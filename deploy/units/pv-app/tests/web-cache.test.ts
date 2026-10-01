/**
 * Tests de la politique de cache de l'interface (#279).
 */
import { describe, expect, it } from 'vitest';
import { cacheControlFor, ENTRY_CACHE, IMMUTABLE_CACHE, PUBLIC_CACHE } from '../src/web-cache.ts';

describe("cache de l'interface", () => {
  it('met en cache durablement les fichiers versionnés', () => {
    expect(cacheControlFor('/app/web/assets/index-BWSeLnOu.css')).toBe(IMMUTABLE_CACHE);
  });

  it("revalide toujours le point d'entrée", () => {
    expect(cacheControlFor('/app/web/index.html')).toBe(ENTRY_CACHE);
  });

  it('met en cache un jour les autres fichiers publics', () => {
    expect(cacheControlFor('/app/web/marque/pajavamba-icon-32x32.png')).toBe(PUBLIC_CACHE);
  });
});
