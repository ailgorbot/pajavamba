/**
 * Catalogue des permissions atomiques et de leur niveau de risque (§7.3).
 *
 * Couche : contrats. Règles : RI-HAB-01 (une permission et un niveau par action), RI-HAB-07,
 * RI-NOM-07 (permission `<ressource>:<action>`).
 */
import type { RiskLevel } from '@pajavamba/kernel';

/** Entrée du catalogue des permissions. */
export interface PermissionDefinition {
  readonly risk: RiskLevel;
  readonly description: string;
}

/** Catalogue des permissions utilisées par le MVP (sous-ensemble du §7.3). */
export const PERMISSIONS = {
  'organisation:read': { risk: 'R0', description: "Lire les informations de l'organisation" },
  'organisation:configure': { risk: 'R3', description: "Modifier les paramètres de l'organisation" },
  'user:manage': { risk: 'R3', description: 'Inviter, désactiver, réactiver des utilisateurs' },
  'role:manage': { risk: 'R3', description: 'Attribuer, retirer, refuser des rôles' },
  'audit:read': { risk: 'R3', description: "Lire le journal d'audit" },
  'log:read_functional': { risk: 'R0', description: "Lire le journal d'activité" },
  'api_key:manage_own': { risk: 'R3', description: 'Créer, régénérer, révoquer sa clé' },
  'project:read': { risk: 'R0', description: 'Lire un projet' },
  'project:create': { risk: 'R1', description: 'Créer un projet' },
  'project:update': { risk: 'R1', description: "Modifier les informations d'un projet" },
  'project:configure': { risk: 'R2', description: 'Types, hiérarchie, champs, boards' },
  'project:manage_members': { risk: 'R3', description: 'Membres et rôles du projet' },
  'project:activate': { risk: 'R1', description: 'Activer un projet' },
  'project:close': { risk: 'R2', description: 'Clôturer un projet' },
  'project:reopen': { risk: 'R2', description: 'Rouvrir un projet' },
  'project:archive': { risk: 'R2', description: 'Archiver un projet' },
  'project:unarchive': { risk: 'R3', description: 'Désarchiver un projet' },
  'project:delete': { risk: 'R3', description: 'Supprimer un projet' },
  'team:read': { risk: 'R0', description: 'Lire les équipes' },
  'team:manage': { risk: 'R1', description: 'Gérer les équipes' },
  'team:manage_members': { risk: 'R3', description: 'Gérer les appartenances aux équipes' },
  'work_item:read': { risk: 'R0', description: 'Lire les éléments' },
  'work_item:read_restricted': { risk: 'R0', description: 'Lire les éléments confidentiels' },
  'work_item:create': { risk: 'R1', description: 'Créer un élément' },
  'work_item:update': { risk: 'R1', description: 'Modifier un élément' },
  'work_item:transition': { risk: 'R1', description: "Changer l'état d'un élément" },
  'work_item:assign': { risk: 'R1', description: 'Assigner un élément' },
  'work_item:comment': { risk: 'R1', description: 'Commenter un élément' },
  'work_item:rank': { risk: 'R1', description: 'Ordonner le backlog' },
  'work_item:delete': { risk: 'R2', description: 'Supprimer un élément (corbeille)' },
  'workflow:configure': { risk: 'R2', description: 'Créer et publier des workflows' },
  'report:read': { risk: 'R0', description: 'Lire les rapports' },
} as const satisfies Readonly<Record<string, PermissionDefinition>>;

/** Nom d'une permission du catalogue. */
export type Permission = keyof typeof PERMISSIONS;

/**
 * Indique si une chaîne est une permission du catalogue.
 * @param value chaîne à contrôler
 * @returns vrai si la permission existe
 */
export function isPermission(value: string): value is Permission {
  return Object.hasOwn(PERMISSIONS, value);
}

/**
 * Retourne le niveau de risque d'une permission.
 * @param permission permission du catalogue
 * @returns niveau de risque
 */
export function riskOf(permission: Permission): RiskLevel {
  return PERMISSIONS[permission].risk;
}
