/**
 * Racine de composition du service portfolio (câblage manuel, RI-ARC-09).
 *
 * Couche : moyenne (portfolio/structure).
 */
import { join } from 'node:path';
import type { EventConsumer, RegisteredAction } from '@pajavamba/contracts';
import type { Logger, MigrationSet } from '@pajavamba/ops';
import { projectActions } from '../actions/project.actions.ts';
import { teamActions } from '../actions/team.actions.ts';
import { createPortfolioProjectionConsumer, runPurge } from '../evenements/portfolio.consumers.ts';
import { createPortfolioRuntime, type PortfolioSettings } from './portfolio-runtime.ts';

export type { PortfolioSettings } from './portfolio-runtime.ts';

/** Migrations du service portfolio. */
export const PORTFOLIO_MIGRATIONS: MigrationSet = { service: 'portfolio', directory: join(import.meta.dirname, '../../migrations') };

/** Service portfolio câblé. */
export interface PortfolioService {
  readonly actions: readonly RegisteredAction[];
  readonly consumers: readonly EventConsumer[];
  /** Tâche planifiée de purge (RG-PRJ-007). */
  purge(logger: Logger): Promise<number>;
}

/**
 * Câble le service portfolio.
 * @param settings paramètres
 * @returns service câblé
 */
export function createPortfolioService(settings: PortfolioSettings): PortfolioService {
  const runtime = createPortfolioRuntime(settings);
  return {
    actions: [...projectActions(runtime), ...teamActions(runtime)],
    consumers: [createPortfolioProjectionConsumer(runtime)],
    purge: async (logger) => runPurge(runtime, logger),
  };
}
