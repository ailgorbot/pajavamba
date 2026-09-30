/**
 * Racine de composition du service query (câblage manuel, RI-ARC-09) : actions de lecture et
 * projection.
 *
 * Couche : moyenne (query/structure). Règles : RI-API-01, RI-API-03, RI-SRV-07.
 */
import { join } from 'node:path';
import { defineAction, type ActionCall, type EventConsumer, type RegisteredAction } from '@pajavamba/contracts';
import { ok, parseProjectRef, uuidToPublicId, type AccessPolicy, type ProjectRef } from '@pajavamba/kernel';
import { HttpProblem, requireContext, serviceRead, type MigrationSet, type ServiceRuntimeShape, type SqlExecutor } from '@pajavamba/ops';
import { activity, backlog, board, search, type ItemView, type QueryDependencies } from '@pajavamba/query-fonctionnel';
import type pg from 'pg';
import { createProjectionConsumer } from '../evenements/projection.consumer.ts';
import { queryRepository } from '../persistance/query.repository.ts';

/** Migrations du service query. */
export const QUERY_MIGRATIONS: MigrationSet = { service: 'query', directory: join(import.meta.dirname, '../../migrations') };

const NOT_FOUND = new HttpProblem({ status: 404, code: 'access.not_found', title: 'Ressource introuvable', detail: "La ressource demandée n'existe pas ou n'est pas accessible." });
const MAX_QUERY_LENGTH = 200;

/** Paramètres du service query. */
export interface QuerySettings {
  readonly pool: pg.Pool;
  readonly policy: AccessPolicy;
}

/** Service query câblé. */
export interface QueryService {
  readonly actions: readonly RegisteredAction[];
  readonly consumers: readonly EventConsumer[];
}

/**
 * Référence de projet du chemin.
 * @param call appel
 * @returns référence
 */
function refOf(call: ActionCall): ProjectRef {
  const ref = parseProjectRef(call.params['projectRef']);
  if (ref === undefined) throw NOT_FOUND;
  return ref;
}

/**
 * Paramètre textuel borné.
 * @param value valeur
 * @returns texte ou `null`
 */
function textParam(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed.slice(0, MAX_QUERY_LENGTH);
}

/**
 * Page de données.
 * @param data éléments
 * @returns corps paginé
 */
function page(data: readonly unknown[]): { readonly data: readonly unknown[]; readonly page: { readonly nextCursor: null; readonly limit: number } } {
  return { data, page: { nextCursor: null, limit: data.length } };
}

/**
 * Déclare les actions de lecture.
 * @param runtime environnement
 * @returns actions
 */
function actions(runtime: ServiceRuntimeShape<QueryDependencies>): RegisteredAction[] {
  const read = async <T>(call: ActionCall, work: Parameters<typeof serviceRead<QueryDependencies, T>>[2]): Promise<T> => serviceRead(runtime, requireContext(call.context).organisationId, work);
  const itemsBody = (items: readonly ItemView[]): readonly unknown[] => items.map((item) => ({ ...item, projectPublicId: uuidToPublicId(item.projectId) }));
  return [
    {
      definition: defineAction({ id: 'backlog.get', permission: 'work_item:read', risk: 'R0', method: 'GET', path: '/projects/:projectRef/backlog', reversible: true, description: 'Backlog ordonné du projet (filtres : type, texte, éléments terminés).', rules: ['RG-WI-007'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const options = { includeDone: call.query['includeDone'] === 'true', typeKey: textParam(call.query['type']), text: textParam(call.query['q']) };
        const result = await read(call, async (dependencies) => backlog(dependencies, context, refOf(call), options));
        return { status: 200, body: page(itemsBody(result.items)) };
      },
    },
    {
      definition: defineAction({ id: 'board.get', permission: 'work_item:read', risk: 'R0', method: 'GET', path: '/projects/:projectRef/board', reversible: true, description: "Board du projet : colonnes par état du workflow, limites WIP signalées.", rules: ['RG-WF-004', 'RG-WI-007'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const result = await read(call, async (dependencies) => board(dependencies, context, refOf(call), textParam(call.query['workflow'])));
        return { status: 200, body: { workflowKeys: result.workflowKeys, workflowKey: result.workflowKey, columns: result.columns.map((column) => ({ ...column, items: itemsBody(column.items) })) } };
      },
    },
    {
      definition: defineAction({ id: 'search.items', permission: 'work_item:read', risk: 'R0', method: 'GET', path: '/search', reversible: true, description: 'Recherche plein texte (français) dans les projets accessibles.', rules: ['RG-WI-007'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const text = textParam(call.query['q']);
        const items = text === null ? [] : await read(call, async (dependencies) => ok(await search(dependencies, context, text)));
        return { status: 200, body: page(itemsBody(items)) };
      },
    },
    {
      definition: defineAction({ id: 'activity.list', permission: 'log:read_functional', risk: 'R0', method: 'GET', path: '/projects/:projectRef/activity', reversible: true, description: "Journal d'activité fonctionnel du projet.", rules: [] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const entries = await read(call, async (dependencies) => activity(dependencies, context, refOf(call)));
        return { status: 200, body: page(entries) };
      },
    },
  ];
}

/**
 * Câble le service query.
 * @param settings paramètres
 * @returns service câblé
 */
export function createQueryService(settings: QuerySettings): QueryService {
  const runtime: ServiceRuntimeShape<QueryDependencies> = { pool: settings.pool, scope: { schema: 'query', role: 'pv_query_app' }, notify: () => undefined, dependenciesOf: (tx: SqlExecutor) => ({ views: queryRepository(tx), policy: settings.policy }) };
  return { actions: actions(runtime), consumers: [createProjectionConsumer(settings.pool)] };
}
