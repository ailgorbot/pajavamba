/**
 * Routes de l'interface (TanStack Router, déclaration par le code).
 *
 * Couche : interface (pages). Règles : RI-API-02, §18.2 (structure des écrans).
 */
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { MiseEnPage } from './composants/mise-en-page.tsx';
import { ConnexionPage, InitialisationPage, InvitationPage } from './pages/acces.tsx';
import { AdministrationPage, AuditPage, PageLegale, RecherchePage } from './pages/administration.tsx';
import { BacklogPage } from './pages/backlog.tsx';
import { BoardPage } from './pages/board.tsx';
import { ElementPage } from './pages/element.tsx';
import { ProfilPage } from './pages/profil.tsx';
import { ProjetPage } from './pages/projet.tsx';
import { NouveauProjetPage, ProjetsPage } from './pages/projets.tsx';

const racine = createRootRoute({ component: MiseEnPage });

const routes = [
  createRoute({ getParentRoute: () => racine, path: '/', component: ProjetsPage }),
  createRoute({ getParentRoute: () => racine, path: '/connexion', component: ConnexionPage }),
  createRoute({ getParentRoute: () => racine, path: '/initialisation', component: InitialisationPage }),
  createRoute({ getParentRoute: () => racine, path: '/invitation', component: InvitationPage }),
  createRoute({ getParentRoute: () => racine, path: '/projets/nouveau', component: NouveauProjetPage }),
  createRoute({ getParentRoute: () => racine, path: '/projets/$cle', component: ProjetPage }),
  createRoute({ getParentRoute: () => racine, path: '/projets/$cle/backlog', component: BacklogPage }),
  createRoute({ getParentRoute: () => racine, path: '/projets/$cle/board', component: BoardPage }),
  createRoute({ getParentRoute: () => racine, path: '/projets/$cle/elements/$element', component: ElementPage }),
  createRoute({ getParentRoute: () => racine, path: '/recherche', component: RecherchePage }),
  createRoute({ getParentRoute: () => racine, path: '/profil', component: ProfilPage }),
  createRoute({ getParentRoute: () => racine, path: '/administration', component: AdministrationPage }),
  createRoute({ getParentRoute: () => racine, path: '/audit', component: AuditPage }),
  createRoute({ getParentRoute: () => racine, path: '/accessibilite', component: () => <PageLegale page="accessibilite" /> }),
  createRoute({ getParentRoute: () => racine, path: '/mentions-legales', component: () => <PageLegale page="mentions" /> }),
  createRoute({ getParentRoute: () => racine, path: '/donnees-personnelles', component: () => <PageLegale page="donnees" /> }),
] as const;

/** Routeur de l'application. */
export const routeur = createRouter({ routeTree: racine.addChildren(routes) });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof routeur;
  }
}
