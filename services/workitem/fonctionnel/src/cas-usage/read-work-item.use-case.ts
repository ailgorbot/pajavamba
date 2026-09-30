/**
 * Cas d'usage de lecture et de discussion : détail, transitions possibles, types, commentaires,
 * historique, sous-éléments ; ajout de commentaire.
 *
 * Couche : basse (workitem/fonctionnel). Règles : RG-WI-007, RI-SEC-03, RG-WI-009.
 */
import { domainError, err, ok, type DomainError, type ExecutionContext, type ProjectRef, type Result, type UseCaseOutput } from '@pajavamba/kernel';
import type { ItemType } from '../domaine/hierarchy.ts';
import type { SnapshotState, SnapshotTransition } from '../domaine/transition.ts';
import type { WorkItem } from '../domaine/work-item.ts';
import type { Comment, HistoryEntry, WorkItemDependencies } from '../ports/workitem.ports.ts';
import { loadItem, loadProject, READ, WORKITEM_EVENTS, type ItemTarget } from './item-access.ts';

/** Détail d'un élément. */
export interface WorkItemDetail {
  readonly item: WorkItem;
  readonly type: ItemType | undefined;
  readonly states: readonly SnapshotState[];
  readonly transitions: readonly SnapshotTransition[];
  readonly children: readonly WorkItem[];
  readonly comments: readonly Comment[];
  readonly history: readonly HistoryEntry[];
}

const COMMENT_MAX = 20_000;

/**
 * Lit le détail d'un élément (`work_item.get`).
 * @param dependencies dépendances
 * @param context contexte
 * @param target projet et élément
 * @returns détail
 */
export async function getWorkItem(dependencies: WorkItemDependencies, context: ExecutionContext, target: ItemTarget): Promise<Result<WorkItemDetail, DomainError>> {
  const loaded = await loadItem(dependencies, context, { ...READ, ...target });
  if (!loaded.ok) return loaded;
  const { item } = loaded.value;
  const snapshot = await dependencies.configuration.findWorkflowVersion(item.workflowVersionId);
  const types = await dependencies.configuration.listTypes(item.projectId);
  const transitions = snapshot?.transitions.filter((transition) => (transition.from === null || transition.from === item.stateKey) && transition.to !== item.stateKey) ?? [];
  return ok({
    item,
    type: types.find((type) => type.key === item.typeKey),
    states: snapshot?.states ?? [],
    transitions,
    children: (await dependencies.items.listChildren(item.id)).filter((child) => child.deletedAt === null),
    comments: await dependencies.items.listComments(item.id),
    history: await dependencies.items.listHistory(item.id),
  });
}

/**
 * Liste les types d'éléments du projet (`work_item_type.list`).
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @returns types
 */
export async function listItemTypes(dependencies: WorkItemDependencies, context: ExecutionContext, ref: ProjectRef): Promise<Result<readonly ItemType[], DomainError>> {
  const project = await loadProject(dependencies, context, { ...READ, ref });
  return project.ok ? ok(await dependencies.configuration.listTypes(project.value.id)) : project;
}

/**
 * Ajoute un commentaire (`work_item.comment`) ; mentions et notifications relèvent du lot 4.
 * @param dependencies dépendances
 * @param context contexte
 * @param input projet, élément et texte (Markdown)
 * @returns commentaire créé
 */
export async function commentWorkItem(dependencies: WorkItemDependencies, context: ExecutionContext, input: ItemTarget & { readonly body: string }): Promise<Result<UseCaseOutput<Comment>, DomainError>> {
  const loaded = await loadItem(dependencies, context, { ...input, permission: 'work_item:comment', risk: 'R1', writable: true });
  if (!loaded.ok) return loaded;
  const text = input.body.trim();
  if (text.length === 0 || text.length > COMMENT_MAX) return err(domainError('workitem.invalid_comment', 'validation', 'Le commentaire doit contenir entre 1 et 20 000 caractères.'));
  const comment: Comment = { id: dependencies.ids.next(), workItemId: loaded.value.item.id, authorId: context.actor.kind === 'user' ? context.actor.userId : null, body: text, createdVia: context.channel, createdAt: dependencies.clock.now() };
  await dependencies.items.insertComment(comment);
  return ok({ result: comment, events: [{ type: WORKITEM_EVENTS.commentAdded, aggregateId: loaded.value.item.id, aggregateVersion: loaded.value.item.version, data: { projectId: loaded.value.item.projectId, key: loaded.value.item.key, commentId: comment.id } }] });
}
