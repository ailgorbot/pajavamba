/**
 * Coque applicative : liens d'évitement, en-tête et pied de page au gabarit DSFR, en thème neutre
 * (sans bloc Marianne ni identité de l'État, substituable par déploiement).
 *
 * Couche : présentation (`packages/ui`). Règles : RI-DSF-01, RI-DSF-07 (liens obligatoires),
 * RI-DSF-08 (thème neutre via la façade), RI-ACC-02 (liens d'évitement), RI-ACC-10.
 */
import type { ReactNode } from 'react';

/** Lien de navigation. */
export interface NavLink {
  readonly label: string;
  readonly href: string;
  readonly current: boolean;
}

/** Propriétés de la coque. */
export interface AppShellProps {
  readonly serviceName: string;
  readonly tagline: string;
  readonly logoSrc: string;
  readonly navigation: readonly NavLink[];
  /** Zone d'accès rapide (utilisateur connecté, déconnexion). */
  readonly quickAccess: ReactNode;
  /** Liens obligatoires du pied de page. */
  readonly footerLinks: readonly { readonly label: string; readonly href: string }[];
  /** Réglage du thème. */
  readonly footerExtra: ReactNode;
  /** Navigation interne sans rechargement. */
  onNavigate(href: string): void;
  readonly children: ReactNode;
}

/** Propriétés d'un lien interne. */
interface InternalLinkProps {
  readonly href: string;
  readonly className: string;
  readonly current?: boolean;
  readonly title?: string;
  onNavigate(href: string): void;
  readonly children: ReactNode;
}

/**
 * Lien interne intercepté par le routeur de l'application.
 * @param props propriétés
 * @returns élément React
 */
function InternalLink(props: InternalLinkProps): ReactNode {
  return (
    <a
      className={props.className}
      href={props.href}
      title={props.title}
      {...(props.current === true ? { 'aria-current': 'page' as const } : {})}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        props.onNavigate(props.href);
      }}
    >
      {props.children}
    </a>
  );
}

/**
 * En-tête : marque de l'opérateur, nom du service, accès rapides, navigation.
 * @param props propriétés de la coque
 * @returns élément React
 */
function ShellHeader(props: AppShellProps): ReactNode {
  return (
    <header role="banner" className="fr-header">
      <div className="fr-header__body">
        <div className="fr-container">
          <div className="fr-header__body-row">
            <div className="fr-header__brand fr-enlarge-link">
              <div className="fr-header__brand-top">
                <div className="fr-header__operator">
                  <img className="fr-responsive-img pv-logo" src={props.logoSrc} alt="" />
                </div>
              </div>
              <div className="fr-header__service">
                <InternalLink className="" href="/" title={`Accueil — ${props.serviceName}`} onNavigate={props.onNavigate}>
                  <p className="fr-header__service-title">{props.serviceName}</p>
                </InternalLink>
                <p className="fr-header__service-tagline">{props.tagline}</p>
              </div>
            </div>
            <div className="fr-header__tools">
              <div className="fr-header__tools-links">{props.quickAccess}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="fr-header__menu">
        <div className="fr-container">
          <div className="fr-header__menu-links" />
          {props.navigation.length > 0 && (
            <nav className="fr-nav" id="navigation-principale" role="navigation" aria-label="Menu principal">
              <ul className="fr-nav__list">
                {props.navigation.map((link) => (
                  <li className="fr-nav__item" key={link.href}>
                    <InternalLink className="fr-nav__link" href={link.href} current={link.current} onNavigate={props.onNavigate}>{link.label}</InternalLink>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Coque applicative.
 * @param props propriétés
 * @returns élément React
 */
export function AppShell(props: AppShellProps): ReactNode {
  return (
    <>
      <div className="fr-skiplinks">
        <nav className="fr-container" role="navigation" aria-label="Accès rapide">
          <ul className="fr-skiplinks__list">
            <li><a className="fr-link" href="#contenu">Contenu</a></li>
            <li><a className="fr-link" href="#navigation-principale">Menu</a></li>
            <li><a className="fr-link" href="#pied-de-page">Pied de page</a></li>
          </ul>
        </nav>
      </div>
      <ShellHeader {...props} />
      <main id="contenu" role="main" tabIndex={-1} className="fr-container fr-py-4w">
        {props.children}
      </main>
      <footer className="fr-footer" role="contentinfo" id="pied-de-page">
        <div className="fr-container">
          <div className="fr-footer__body">
            <div className="fr-footer__content">
              <p className="fr-footer__content-desc">{props.serviceName} — {props.tagline}</p>
            </div>
          </div>
          <div className="fr-footer__bottom">
            <ul className="fr-footer__bottom-list">
              {props.footerLinks.map((link) => (
                <li className="fr-footer__bottom-item" key={link.href}>
                  <InternalLink className="fr-footer__bottom-link" href={link.href} onNavigate={props.onNavigate}>{link.label}</InternalLink>
                </li>
              ))}
            </ul>
            <div className="fr-footer__bottom-copy fr-mt-2w">{props.footerExtra}</div>
          </div>
        </div>
      </footer>
    </>
  );
}
