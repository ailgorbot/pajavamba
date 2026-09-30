/**
 * Exécution des actions d'un service : dépendances construites par transaction, écriture via la
 * chaîne commune, lecture sous contexte RLS.
 *
 * Couche : haute (OPS), formes structurelles uniquement (RI-ARC-04). Règles : RI-ARC-11, RI-API-05.
 */
import type pg from 'pg';
import { requestHashOf } from './action-kit.ts';
import { runReadAction, runWriteAction, type ContextShape, type UseCaseResultShape } from './action-runner.ts';
import type { SqlExecutor } from './database.ts';
import type { DomainErrorShape } from './domain-problem.ts';

/** Environnement d'un service. */
export interface ServiceRuntimeShape<D> {
  readonly pool: pg.Pool;
  readonly scope: { readonly schema: string; readonly role: string };
  /** Réveille le relais d'événements après validation d'une transaction. */
  readonly notify: () => void;
  dependenciesOf(tx: SqlExecutor): D;
}

/** Forme structurelle d'un appel d'action. */
export interface CallShape {
  readonly params: unknown;
  readonly body: unknown;
  readonly headers: { readonly idempotencyKey: string | null; readonly dryRun: boolean };
}

/** Forme structurelle d'une réponse d'action. */
export interface ResponseShape {
  readonly status: number;
  readonly body: unknown;
}

/** Description d'une écriture de service. */
export interface ServiceWrite<D, T, R extends ResponseShape> {
  readonly actionId: string;
  readonly resourceType: string;
  readonly context: ContextShape;
  /** Faux lorsque la réponse contient un secret : elle n'est jamais stockée pour rejeu. */
  readonly replayable: boolean;
  readonly changedFields?: readonly string[];
  execute(dependencies: D): Promise<UseCaseResultShape<T>>;
  respond(result: T): R;
  resourceId(result: T): string | null;
}

/**
 * Exécute une écriture (outbox, audit, idempotence, simulation).
 * @param runtime environnement du service
 * @param call appel
 * @param write description
 * @returns réponse produite, ou réponse rejouée
 */
export async function serviceWrite<D, T, R extends ResponseShape>(runtime: ServiceRuntimeShape<D>, call: CallShape, write: ServiceWrite<D, T, R>): Promise<R | ResponseShape> {
  let response: R | undefined;
  const outcome = await runWriteAction({
    pool: runtime.pool,
    scope: runtime.scope,
    context: write.context,
    actionId: write.actionId,
    resourceType: write.resourceType,
    idempotencyKey: write.replayable ? call.headers.idempotencyKey : null,
    dryRun: call.headers.dryRun,
    requestHash: requestHashOf(call.params, call.body),
    onCommitted: runtime.notify,
    changedFields: write.changedFields ?? [],
    execute: async (tx) => write.execute(runtime.dependenciesOf(tx)),
    respond: (result) => {
      response = write.respond(result);
      return { status: response.status, body: response.body };
    },
    resourceId: (result) => write.resourceId(result),
  });
  return response ?? { status: outcome.status, body: outcome.body };
}

/**
 * Exécute une lecture sous le contexte RLS de l'organisation.
 * @param runtime environnement du service
 * @param organisationId organisation
 * @param read lecture
 * @returns valeur lue
 */
export async function serviceRead<D, T>(
  runtime: ServiceRuntimeShape<D>,
  organisationId: string,
  read: (dependencies: D) => Promise<{ readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: DomainErrorShape }>,
): Promise<T> {
  return runReadAction({ pool: runtime.pool, scope: runtime.scope, organisationId, execute: async (tx) => read(runtime.dependenciesOf(tx)) });
}
