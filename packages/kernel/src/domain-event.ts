/**
 * Événements du domaine et contrat de sortie des cas d'usage.
 *
 * Couche : noyau. Règles : RI-ARC-06 (`{ result, events }`), RI-NOM-07, RI-DON-11.
 */
import type { DomainError } from './domain-error.ts';
import type { ExecutionContext } from './execution-context.ts';
import type { Result } from './result.ts';

/** Valeur sérialisable d'un événement (aucun texte libre inutile, §5.7). */
export type EventValue =
  | string
  | number
  | boolean
  | null
  | readonly EventValue[]
  | { readonly [key: string]: EventValue };

/** Événement du domaine, publié via l'outbox du service. */
export interface DomainEvent {
  /** Type versionné `pv.<service>.<objet>.<verbe_passé>.v<N>`. */
  readonly type: string;
  /** Identifiant de l'agrégat concerné. */
  readonly aggregateId: string;
  /** Version de l'agrégat après l'événement (ordre par agrégat). */
  readonly aggregateVersion: number;
  /** Données destinées aux consommateurs internes. */
  readonly data: Readonly<Record<string, EventValue>>;
}

/** Sortie d'un cas d'usage : résultat et événements, sans effet de bord caché. */
export interface UseCaseOutput<T> {
  readonly result: T;
  readonly events: readonly DomainEvent[];
}

/** Signature commune des cas d'usage. */
export type UseCase<I, O> = (
  context: ExecutionContext,
  input: I,
) => Promise<Result<UseCaseOutput<O>, DomainError>>;
