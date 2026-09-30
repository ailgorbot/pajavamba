/**
 * Consommateurs de portfolio : configuration prête (workflow) et compteur d'éléments non terminés
 * (workitem) ; tâche planifiée de purge des projets à l'échéance.
 *
 * Couche : moyenne (portfolio/structure). Règles : RI-SRV-04, RI-SRV-11, RG-PRJ-005, RG-PRJ-007,
 * RI-MET-03.
 */
import { EVENT_TYPES, type CloudEvent, type EventConsumer } from '@pajavamba/contracts';
import { toEntityId } from '@pajavamba/kernel';
import { consumeOnce, insertOutbox, withTransaction, type Logger } from '@pajavamba/ops';
import { adjustOpenItems, markConfigurationReady, openItemDelta, purgeDueProjects } from '@pajavamba/portfolio-fonctionnel';
import { PORTFOLIO_SCOPE, type PortfolioRuntime } from '../composition/portfolio-runtime.ts';

const CONSUMER = 'portfolio.projections';

/**
 * Lit une chaîne (ou `null`) dans les données d'un événement.
 * @param event événement
 * @param key champ
 * @returns valeur
 */
function field(event: CloudEvent, key: string): string | null {
  const value = event.data[key];
  return typeof value === 'string' ? value : null;
}

/**
 * Variation d'éléments ouverts portée par un événement de workitem.
 * @param event événement
 * @returns variation
 */
function deltaOf(event: CloudEvent): number {
  switch (event.type) {
    case EVENT_TYPES.workItemCreated:
    case EVENT_TYPES.workItemRestored:
      return openItemDelta(null, field(event, 'stateCategory'));
    case EVENT_TYPES.workItemDeleted:
      return openItemDelta(field(event, 'stateCategory'), null);
    case EVENT_TYPES.workItemTransitioned:
      return openItemDelta(field(event, 'fromCategory'), field(event, 'toCategory'));
    default:
      return 0;
  }
}

/**
 * Crée le consommateur des projections de portfolio.
 * @param runtime environnement
 * @returns consommateur
 */
export function createPortfolioProjectionConsumer(runtime: PortfolioRuntime): EventConsumer {
  return {
    name: CONSUMER,
    types: [EVENT_TYPES.packInstantiated, EVENT_TYPES.workItemCreated, EVENT_TYPES.workItemDeleted, EVENT_TYPES.workItemRestored, EVENT_TYPES.workItemTransitioned],
    async handle(event) {
      const service = runtime.forOrganisation(event.pvorganisation);
      const projectId = toEntityId<'project'>(field(event, 'projectId') ?? '');
      await consumeOnce({ pool: service.pool, scope: { ...PORTFOLIO_SCOPE, organisationId: event.pvorganisation }, consumer: CONSUMER, eventId: event.id, correlationId: event.pvcorrelation }, async (tx) => {
        const dependencies = service.dependenciesOf(tx);
        if (event.type === EVENT_TYPES.packInstantiated) {
          await markConfigurationReady(dependencies, projectId);
        } else {
          await adjustOpenItems(dependencies, projectId, deltaOf(event));
        }
        return [];
      });
    },
  };
}

/**
 * Purge les projets dont le délai de grâce est échu, organisation par organisation.
 * @param runtime environnement
 * @param logger journal
 * @returns nombre de projets purgés
 */
export async function runPurge(runtime: PortfolioRuntime, logger: Logger): Promise<number> {
  const { pool, clock } = runtime.settings;
  const due = await withTransaction(pool, PORTFOLIO_SCOPE, (tx) => tx.query<{ readonly organisation_id: string }>('SELECT DISTINCT organisation_id FROM projects_due_for_purge($1)', [new Date(clock.now())]));
  let purged = 0;
  for (const { organisation_id: organisationId } of due) {
    const service = runtime.forOrganisation(organisationId);
    purged += await withTransaction(pool, { ...PORTFOLIO_SCOPE, organisationId }, async (tx) => {
      const events = await purgeDueProjects(service.dependenciesOf(tx));
      await insertOutbox(tx, { scope: { ...PORTFOLIO_SCOPE, organisationId }, correlationId: `purge-${String(clock.now())}` }, events.map((event) => ({ kind: 'event', type: event.type, aggregateId: event.aggregateId, aggregateVersion: event.aggregateVersion, payload: event.data })));
      return events.length;
    });
  }
  if (purged > 0) {
    runtime.settings.notify();
    logger.emit('jobCompleted', { action: 'project.purge', count: purged });
  }
  return purged;
}
