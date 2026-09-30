/**
 * Catalogue des rôles système et de leurs permissions (matrice par défaut du §7.4).
 *
 * Couche : basse (identity/fonctionnel). Règles : RI-MET-04 (rôles configurables : ce catalogue
 * n'est que la valeur initiale, stockée en base), §7.4.
 */

/** Portée d'un rôle. */
export type RoleScopeType = 'organisation' | 'project';

/** Définition d'un rôle système. */
export interface RoleDefinition {
  readonly key: string;
  readonly name: string;
  readonly scopeType: RoleScopeType;
  readonly permissions: readonly string[];
}

const PROJECT_READ = ['project:read', 'team:read', 'work_item:read', 'log:read_functional', 'report:read'];
const ITEM_WRITE = ['work_item:create', 'work_item:update', 'work_item:transition', 'work_item:assign', 'work_item:comment', 'work_item:rank'];
const PROJECT_LIFECYCLE = ['project:update', 'project:configure', 'project:activate', 'project:close', 'project:reopen', 'project:archive'];
const PROJECT_ADMIN_EXTRA = ['project:manage_members', 'team:manage', 'team:manage_members', 'workflow:configure', 'work_item:read_restricted', 'work_item:delete'];
const ORG_ADMIN = ['organisation:read', 'organisation:configure', 'user:manage', 'role:manage', 'api_key:manage_own', 'project:create', 'project:unarchive', 'project:delete'];

/** Rôles système fournis à l'initialisation. */
export const SYSTEM_ROLES: readonly RoleDefinition[] = [
  { key: 'owner', name: 'Propriétaire', scopeType: 'organisation', permissions: [...ORG_ADMIN, ...PROJECT_READ, ...PROJECT_LIFECYCLE, ...PROJECT_ADMIN_EXTRA] },
  { key: 'admin', name: 'Administrateur', scopeType: 'organisation', permissions: [...ORG_ADMIN, ...PROJECT_READ, ...PROJECT_LIFECYCLE, 'project:manage_members', 'team:manage', 'team:manage_members', 'workflow:configure'] },
  { key: 'auditor', name: 'Auditeur', scopeType: 'organisation', permissions: ['organisation:read', 'audit:read', 'api_key:manage_own', ...PROJECT_READ] },
  { key: 'member', name: 'Membre', scopeType: 'organisation', permissions: ['organisation:read', 'api_key:manage_own'] },
  { key: 'project_admin', name: 'Administrateur de projet', scopeType: 'project', permissions: [...PROJECT_READ, ...ITEM_WRITE, ...PROJECT_LIFECYCLE, ...PROJECT_ADMIN_EXTRA] },
  { key: 'product_owner', name: 'Product Owner', scopeType: 'project', permissions: [...PROJECT_READ, ...ITEM_WRITE, 'work_item:delete'] },
  { key: 'scrum_master', name: 'Scrum Master', scopeType: 'project', permissions: [...PROJECT_READ, ...ITEM_WRITE, 'work_item:delete'] },
  { key: 'contributor', name: 'Contributeur', scopeType: 'project', permissions: [...PROJECT_READ, ...ITEM_WRITE] },
  { key: 'reader', name: 'Lecteur', scopeType: 'project', permissions: PROJECT_READ },
];

/**
 * Retrouve un rôle système par sa clé.
 * @param key clé technique
 * @returns le rôle ou `undefined`
 */
export function findSystemRole(key: string): RoleDefinition | undefined {
  return SYSTEM_ROLES.find((role) => role.key === key);
}
