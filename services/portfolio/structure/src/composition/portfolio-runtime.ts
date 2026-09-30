/**
 * Environnement d'exécution du service portfolio.
 *
 * Couche : moyenne (portfolio/structure). Règle : RI-ARC-09 (câblage manuel).
 */
import { toEntityId, type AccessPolicy, type Clock, type IdGenerator } from '@pajavamba/kernel';
import type { ServiceRuntimeShape, SqlExecutor } from '@pajavamba/ops';
import type { PortfolioDependencies } from '@pajavamba/portfolio-fonctionnel';
import type pg from 'pg';
import { projectRepository } from '../persistance/project.repository.ts';
import { teamRepository } from '../persistance/team.repository.ts';

/** Portée PostgreSQL du service portfolio. */
export const PORTFOLIO_SCOPE = { schema: 'portfolio', role: 'pv_portfolio_app' } as const;

/** Paramètres de l'environnement portfolio. */
export interface PortfolioSettings {
  readonly pool: pg.Pool;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly policy: AccessPolicy;
  readonly notify: () => void;
}

/** Environnement du service portfolio (dépendances liées à l'organisation courante). */
export interface PortfolioRuntime {
  readonly settings: PortfolioSettings;
  /**
   * Environnement pour une organisation.
   * @param organisationId organisation courante
   */
  forOrganisation(organisationId: string): ServiceRuntimeShape<PortfolioDependencies>;
}

/**
 * Construit l'environnement du service portfolio.
 * @param settings paramètres
 * @returns environnement
 */
export function createPortfolioRuntime(settings: PortfolioSettings): PortfolioRuntime {
  return {
    settings,
    forOrganisation: (organisationId) => ({
      pool: settings.pool,
      scope: PORTFOLIO_SCOPE,
      notify: settings.notify,
      dependenciesOf: (tx: SqlExecutor): PortfolioDependencies => ({
        projects: projectRepository(tx),
        teams: teamRepository(tx, toEntityId(organisationId)),
        policy: settings.policy,
        clock: settings.clock,
        ids: settings.ids,
      }),
    }),
  };
}
