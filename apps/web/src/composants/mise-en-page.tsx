/**
 * Mise en page commune : coque DSFR, navigation selon les droits d'organisation, garde de session.
 *
 * Couche : interface (composants). Règles : RI-SEC-01 (le masquage des menus n'est qu'un confort :
 * le serveur vérifie chaque action), RI-ERG-01, RI-DSF-07.
 */
import { AppShell, Button, ThemeSelector, type Theme } from '@pajavamba/ui';
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';
import { setCsrfToken } from '../adaptateurs/api.ts';
import { useMe, useSetupStatus, useWrite } from '../adaptateurs/requetes.ts';
import { can } from '../domaine/modeles.ts';
import { Loading } from './retours.tsx';

const PUBLIC_PATHS = ['/connexion', '/initialisation', '/invitation', '/accessibilite', '/mentions-legales', '/donnees-personnelles'];
const FOOTER_LINKS = [
  { label: 'Accessibilité : non conforme', href: '/accessibilite' },
  { label: 'Mentions légales', href: '/mentions-legales' },
  { label: 'Données personnelles', href: '/donnees-personnelles' },
];

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
  const isPublic = PUBLIC_PATHS.some((path) => location.pathname.startsWith(path));

  useEffect(() => {
    if (setup.data?.initialized === false && location.pathname !== '/initialisation') void navigate({ to: '/initialisation' });
    else if (setup.data?.initialized === true && me.data === null && !isPublic) void navigate({ to: '/connexion' });
  }, [setup.data, me.data, isPublic, location.pathname, navigate]);

  const user = me.data ?? undefined;
  const navigation = user === undefined ? [] : [
    { label: 'Projets', href: '/' },
    { label: 'Recherche', href: '/recherche' },
    ...(can(user, 'user:manage') || can(user, 'role:manage') ? [{ label: 'Administration', href: '/administration' }] : []),
    ...(can(user, 'audit:read') ? [{ label: 'Audit', href: '/audit' }] : []),
    { label: 'Mon profil', href: '/profil' },
  ].map((link) => ({ ...link, current: link.href === '/' ? location.pathname === '/' || location.pathname.startsWith('/projets') : location.pathname.startsWith(link.href) }));

  const logout = (): void => {
    write.mutate({ method: 'DELETE', path: '/sessions/current' }, { onSettled: () => { setCsrfToken(null); void navigate({ to: '/connexion' }); } });
  };
  const quickAccess = user === undefined ? null : (
    <ul className="fr-btns-group">
      <li><span className="fr-btn fr-btn--tertiary-no-outline fr-icon-account-circle-line fr-btn--icon-left">{user.user.displayName}</span></li>
      <li><Button priority="tertiary no outline" iconId="fr-icon-logout-box-r-line" onClick={logout}>Se déconnecter</Button></li>
    </ul>
  );
  const theme: Theme = user?.user.theme ?? 'system';

  return (
    <AppShell
      serviceName="PajaVamba"
      tagline={user === undefined ? 'Gestion de projets agiles' : `Gestion de projets agiles — ${user.organisation.name}`}
      logoSrc="/marque/pajavamba-icon-128x128.png"
      navigation={navigation}
      quickAccess={quickAccess}
      footerLinks={FOOTER_LINKS}
      footerExtra={<ThemeSelector value={theme} onChange={(value) => { if (user !== undefined) write.mutate({ method: 'PATCH', path: '/me', body: { theme: value } }); }} />}
      onNavigate={(href) => void navigate({ to: href })}
    >
      {me.isPending || setup.isPending ? <Loading /> : <Outlet />}
    </AppShell>
  );
}
