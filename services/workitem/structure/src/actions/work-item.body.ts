/**
 * Représentation API d'un élément de travail.
 *
 * Couche : moyenne (workitem/structure). Règles : RI-NOM-06 (champs `camelCase`), RI-API-03
 * (dates ISO 8601 UTC).
 */
import type { WorkItem } from '@pajavamba/workitem-fonctionnel';

/**
 * Sérialise un élément.
 * @param item élément
 * @returns corps JSON
 */
export function itemBody(item: WorkItem): Record<string, unknown> {
  const iso = (value: number | null): string | null => (value === null ? null : new Date(value).toISOString());
  return {
    id: item.id,
    key: item.key,
    number: item.number,
    typeKey: item.typeKey,
    title: item.title,
    description: item.description,
    acceptanceCriteria: item.acceptanceCriteria,
    stateKey: item.stateKey,
    stateCategory: item.stateCategory,
    priority: item.priority,
    parentId: item.parentId,
    assigneeId: item.assigneeId,
    reporterId: item.reporterId,
    estimate: item.estimate,
    rank: item.rank,
    confidentiality: item.confidentiality,
    createdVia: item.createdVia,
    createdAt: iso(item.createdAt),
    resolvedAt: iso(item.resolvedAt),
    deletedAt: iso(item.deletedAt),
    version: item.version,
  };
}
