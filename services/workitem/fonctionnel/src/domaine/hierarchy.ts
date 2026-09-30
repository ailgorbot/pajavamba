/**
 * Hiérarchie configurable : types admis comme parents, absence de cycle, profondeur maximale.
 *
 * Couche : basse (workitem/fonctionnel). Règles : RG-WI-002, RG-WI-003, §3.4 (profondeur ≤ 7).
 */
import { domainError, err, ok, type DomainError, type Result } from '@pajavamba/kernel';
import type { WorkItem } from './work-item.ts';

/** Type d'élément d'un projet (issu du pack, configurable). */
export interface ItemType {
  readonly key: string;
  readonly name: string;
  readonly level: number;
  readonly allowedParentKeys: readonly string[];
  readonly workflowKey: string;
}

/** Profondeur maximale d'une hiérarchie. */
export const MAX_DEPTH = 7;

/**
 * Vérifie qu'un parent est admis pour un type et qu'il ne crée pas de cycle.
 * @param type type de l'élément
 * @param itemId identifiant de l'élément (`null` à la création)
 * @param parent parent proposé
 * @returns chemin d'ancêtres de l'élément, ou erreur
 */
export function checkParent(type: ItemType, itemId: string | null, parent: WorkItem): Result<readonly string[], DomainError> {
  if (!type.allowedParentKeys.includes(parent.typeKey)) {
    return err(domainError('workitem.parent_type_not_allowed', 'conflict', `Un élément de type « ${type.name} » ne peut pas avoir ce parent.`));
  }
  if (itemId !== null && (parent.id === itemId || parent.ancestors.includes(itemId))) {
    return err(domainError('workitem.hierarchy_cycle', 'conflict', 'Ce rattachement créerait un cycle dans la hiérarchie.'));
  }
  const ancestors = [...parent.ancestors, parent.id];
  return ancestors.length >= MAX_DEPTH ? err(domainError('workitem.hierarchy_too_deep', 'conflict', 'La hiérarchie ne peut pas dépasser 7 niveaux.')) : ok(ancestors);
}
