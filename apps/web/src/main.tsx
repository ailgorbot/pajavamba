/**
 * Point d'entrée de l'interface : système de design, état serveur, routeur.
 *
 * Couche : interface. Règles : RI-DSF-02 (DSFR via la façade), RI-RGPD-04 (aucun traceur).
 */
import '@pajavamba/ui/styles.css';
import { startUi } from '@pajavamba/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { routeur } from './routeur.tsx';

const STALE_MS = 5_000;

startUi();
const client = new QueryClient({ defaultOptions: { queries: { staleTime: STALE_MS, refetchOnWindowFocus: true } } });
const racine = document.getElementById('racine');
if (racine !== null) {
  createRoot(racine).render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <RouterProvider router={routeur} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
