/**
 * Modèles de l'interface (formes des réponses de l'API) et libellés français.
 *
 * Couche : interface (domaine), sans React ni réseau. Règles : RI-NOM-10 (termes du glossaire),
 * RI-ERG-11 (dates au format français).
 */

/** Profil de l'utilisateur connecté. */
export interface Me {
  readonly user: { readonly id: string; readonly email: string; readonly displayName: string; readonly theme: 'system' | 'light' | 'dark' };
  readonly organisation: { readonly id: string; readonly slug: string; readonly name: string };
  readonly permissions: readonly string[];
  readonly mfa: { readonly enrolled: boolean; readonly verifiedAt: string | null };
  readonly apiKey: { readonly publicId: string; readonly name: string; readonly readOnly: boolean; readonly createdAt: string; readonly lastUsedAt: string | null } | null;
  readonly csrfToken: string | null;
}

/** Statut du cycle de vie d'un projet. */
export type ProjectStatus = 'draft' | 'active' | 'closed' | 'archived' | 'pending_deletion';

/** Projet. */
export interface Project {
  readonly id: string;
  readonly uuid: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly status: ProjectStatus;
  readonly visibility: string;
  readonly methodologyPackKey: string;
  readonly configurationReady: boolean;
  readonly openItemCount: number;
  readonly closedAt: string | null;
  readonly closureSummary: string | null;
  readonly deletionScheduledFor: string | null;
  readonly version: number;
  readonly closureBlockers?: readonly { readonly code: string; readonly message: string }[];
}

/** Élément tel qu'affiché dans les listes. */
export interface ItemSummary {
  readonly id: string;
  readonly key: string;
  readonly typeKey: string;
  readonly title: string;
  readonly stateKey: string;
  readonly stateName: string;
  readonly stateCategory: 'todo' | 'in_progress' | 'done';
  readonly priority: string;
  readonly assigneeId: string | null;
  readonly estimate: number | null;
  readonly projectKey: string;
  readonly confidentiality: string;
}

/** État d'un workflow. */
export interface WorkflowState {
  readonly key: string;
  readonly name: string;
  readonly category: 'todo' | 'in_progress' | 'done';
  readonly wipLimit: number | null;
}

/** Détail d'un élément. */
export interface ItemDetail {
  readonly id: string;
  readonly key: string;
  readonly typeKey: string;
  readonly title: string;
  readonly description: string;
  readonly acceptanceCriteria: string;
  readonly stateKey: string;
  readonly stateCategory: string;
  readonly priority: string;
  readonly parentId: string | null;
  readonly assigneeId: string | null;
  readonly estimate: number | null;
  readonly confidentiality: 'normal' | 'restricted';
  readonly createdAt: string;
  readonly version: number;
  readonly type: { readonly key: string; readonly name: string } | null;
  readonly states: readonly WorkflowState[];
  readonly transitions: readonly { readonly key: string; readonly name: string; readonly to: string }[];
  readonly children: readonly { readonly key: string; readonly title: string; readonly stateCategory: string }[];
  readonly comments: readonly { readonly id: string; readonly authorId: string | null; readonly body: string; readonly createdAt: string }[];
  readonly history: readonly { readonly occurredAt: string; readonly actorId: string | null; readonly action: string; readonly changes: Readonly<Record<string, { readonly from: string | null; readonly to: string | null }>> }[];
}

/** Membre de l'organisation. */
export interface Member {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: string;
  readonly orgRole: string;
}

/** Libellés des statuts de projet. */
export const PROJECT_STATUS_LABELS: Readonly<Record<ProjectStatus, string>> = {
  draft: 'Brouillon',
  active: 'Actif',
  closed: 'Clôturé',
  archived: 'Archivé',
  pending_deletion: 'Suppression programmée',
};

/** Libellés des priorités. */
export const PRIORITY_LABELS: Readonly<Record<string, string>> = { lowest: 'Très basse', low: 'Basse', medium: 'Moyenne', high: 'Haute', highest: 'Très haute' };

/** Libellés des catégories d'état. */
export const CATEGORY_LABELS: Readonly<Record<string, string>> = { todo: 'À faire', in_progress: 'En cours', done: 'Terminé' };

/** Libellés des modèles méthodologiques. */
export const PACK_LABELS: Readonly<Record<string, string>> = { scrum: 'Scrum', kanban: 'Kanban', scrumban: 'Scrumban', custom: 'Personnalisé' };

/** Libellés des rôles. */
export const ROLE_LABELS: Readonly<Record<string, string>> = {
  owner: 'Propriétaire', admin: 'Administrateur', auditor: 'Auditeur', member: 'Membre',
  project_admin: 'Administrateur de projet', product_owner: 'Product Owner', scrum_master: 'Scrum Master', contributor: 'Contributeur', reader: 'Lecteur',
};

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Formate une date ISO en français.
 * @param iso date ISO 8601
 * @returns date lisible
 */
export function formatDate(iso: string | null): string {
  return iso === null ? '—' : DATE_FORMAT.format(new Date(iso));
}

/**
 * Indique si l'utilisateur détient une permission d'organisation (affichage uniquement :
 * l'autorisation est toujours vérifiée côté serveur, RI-SEC-01).
 * @param me profil
 * @param permission permission
 * @returns vrai si la permission est accordée au niveau de l'organisation
 */
export function can(me: Me | undefined, permission: string): boolean {
  return me?.permissions.includes(permission) === true;
}
