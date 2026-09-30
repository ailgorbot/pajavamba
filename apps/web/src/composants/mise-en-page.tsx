/**
 * Mise en page commune : coque DSFR, navigation selon les droits d'organisation, garde de session.
 *
 * Couche : interface (composants). Règles : RI-SEC-01 (le masquage des menus n'est qu'un confort :
 * le serveur vérifie chaque action), RI-ERG-01, RI-DSF-07.
 */
import { AppShell, Button, ThemeSelector, type NavLink } from '@pajavamba/ui';
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';
import { setCsrfToken } from '../adaptateurs/api.ts';
import { useMe, useSetupStatus, useWrite } from '../adaptateurs/requetes.ts';
import { can, type Me } from '../domaine/modeles.ts';
import { Loading } from './retours.tsx';

const PUBLIC_PATHS = ['/connexion', '/initialisation', '/invitation', '/accessibilite', '/mentions-legales', '/donnees-personnelles'];
const FOOTER_LINKS = [
  { label: 'Accessibilité : non conforme', href: '/accessibilite' },
  { label: 'Mentions légales', href: '/mentions-legales' },
  { label: 'Données personnelles', href: '/donnees-personnelles' },
];

/**
 * Liens de navigation selon les permissions d'organisation.
 * @param user profil connecté
 * @param pathname chemin courant
 * @returns liens
 */
function navigationFor(user: Me | undefined, pathname: string): NavLink[] {
  if (user === undefined) return [];
  const links = [
    { label: 'Projets', href: '/' },
    { label: 'Recherche', href: '/recherche' },
    ...(can(user, 'user:manage') || can(user, 'role:manage') ? [{ label: 'Administration', href: '/administration' }] : []),
    ...(can(user, 'audit:read') ? [{ label: 'Audit', href: '/audit' }] : []),
    { label: 'Mon profil', href: '/profil' },
  ];
  return links.map((link) => ({ ...link, current: link.href === '/' ? pathname === '/' || pathname.startsWith('/projets') : pathname.startsWith(link.href) }));
}

/**
 * Redirige vers l'initialisation ou la connexion lorsque nécessaire.
 * @param initialized instance initialisée (ou inconnu)
 * @param connected session ouverte (ou inconnu)
 */
function useSessionGuard(initialized: boolean | undefined, connected: boolean | undefined): void {
  const location = useLocation();
  const navigate = useNavigate();
  const isPublic = PUBLIC_PATHS.some((path) => location.pathname.startsWith(path));
  useEffect(() => {
    if (initialized === false && location.pathname !== '/initialisation') void navigate({ to: '/initialisation' });
    else if (initialized === true && connected === false && !isPublic) void navigate({ to: '/connexion' });
  }, [initialized, connected, isPublic, location.pathname, navigate]);
}

/**
 * Accès rapide : nom de l'utilisateur et déconnexion.
 * @param props profil
 * @returns élément React
 */
function AccesRapide(props: Readonly<{ user: Me }>): ReactNode {
  const write = useWrite();
  const navigate = useNavigate();
  const logout = (): void => {
    write.mutate({ method: 'DELETE', path: '/sessions/current' }, { onSettled: () => { setCsrfToken(null); void navigate({ to: '/connexion' }); } });
  };
  return (
    <ul className="fr-btns-group">
      <li><span className="fr-btn fr-btn--tertiary-no-outline fr-icon-account-circle-line fr-btn--icon-left">{props.user.user.displayName}</span></li>
      <li><Button priority="tertiary no outline" iconId="fr-icon-logout-box-r-line" onClick={logout}>Se déconnecter</Button></li>
    </ul>
  );
}

/**
 * Mise en page de l'application.
 * @returns élément React
 */
export function MiseEnPage(): ReactNode {
  const me = useMe();
  const setup = useSetupStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const write = useWrite();
  const user = me.data ?? undefined;
  useSessionGuard(setup.data?.initialized, me.isPending ? undefined : user !== undefined);
  const saveTheme = (theme: Me['user']['theme']): void => {
    if (user !== undefined) write.mutate({ method: 'PATCH', path: '/me', body: { theme } });
  };
  return (
    <AppShell
      serviceName="PajaVamba"
      tagline={user === undefined ? 'Gestion de projets agiles' : `Gestion de projets agiles — ${user.organisation.name}`}
      logoSrc="/marque/pajavamba-icon-128x128.png"
      navigation={navigationFor(user, location.pathname)}
      quickAccess={user === undefined ? null : <AccesRapide user={user} />}
      footerLinks={FOOTER_LINKS}
      footerExtra={<ThemeSelector value={user?.user.theme ?? 'system'} onChange={saveTheme} />}
      onNavigate={(href) => void navigate({ to: href })}
    >
      {me.isPending || setup.isPending ? <Loading /> : <Outlet />}
    </AppShell>
  );
}
