/**
 * Actions des éléments de travail : lectures (types, détail), commentaires, puis écritures.
 *
 * Couche : moyenne (workitem/structure). Règles : RI-API-01, RG-WI-007.
 */
import { defineAction, type RegisteredAction } from '@pajavamba/contracts';
import { parseInput, requireContext, serviceRead, serviceWrite } from '@pajavamba/ops';
import { commentWorkItem, getWorkItem, listItemTypes, type WorkItemDetail } from '@pajavamba/workitem-fonctionnel';
import { itemBody } from './work-item.body.ts';
import { CommentInput, targetOf } from './work-item.schemas.ts';
import { writeActions, type RuntimeFor } from './work-item.write-actions.ts';

export type { RuntimeFor } from './work-item.write-actions.ts';

/**
 * Représentation API du détail d'un élément.
 * @param detail détail
 * @returns corps JSON
 */
function detailBody(detail: WorkItemDetail): Record<string, unknown> {
  return {
    ...itemBody(detail.item), type: detail.type ?? null, states: detail.states, transitions: detail.transitions, children: detail.children.map(itemBody),
    comments: detail.comments.map((comment) => ({ ...comment, createdAt: new Date(comment.createdAt).toISOString() })),
    history: detail.history.map((entry) => ({ ...entry, occurredAt: new Date(entry.occurredAt).toISOString() })),
  };
}

/**
 * Déclare les lectures des éléments.
 * @param runtimeFor environnement par organisation
 * @returns actions
 */
function readActions(runtimeFor: RuntimeFor): RegisteredAction[] {
  return [
    {
      definition: defineAction({ id: 'work_item_type.list', permission: 'work_item:read', risk: 'R0', method: 'GET', path: '/projects/:projectRef/work-item-types', reversible: true, description: "Liste les types d'éléments et la hiérarchie du projet.", rules: ['RG-WI-002'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const types = await serviceRead(runtimeFor(context.organisationId), context.organisationId, async (dependencies) => listItemTypes(dependencies, context, targetOf(call).ref));
        return { status: 200, body: { data: types, page: { nextCursor: null, limit: types.length } } };
      },
    },
    {
      definition: defineAction({ id: 'work_item.get', permission: 'work_item:read', risk: 'R0', method: 'GET', path: '/projects/:projectRef/work-items/:itemKey', reversible: true, description: "Lit le détail d'un élément : transitions possibles, sous-éléments, commentaires, historique.", rules: ['RG-WI-007'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const detail = await serviceRead(runtimeFor(context.organisationId), context.organisationId, async (dependencies) => getWorkItem(dependencies, context, targetOf(call)));
        return { status: 200, etag: detail.item.version, body: detailBody(detail) };
      },
    },
  ];
}

/**
 * Déclare l'ajout de commentaire.
 * @param runtimeFor environnement par organisation
 * @returns action
 */
function commentAction(runtimeFor: RuntimeFor): RegisteredAction {
  return {
    definition: defineAction({ id: 'work_item.comment', permission: 'work_item:comment', risk: 'R1', method: 'POST', path: '/projects/:projectRef/work-items/:itemKey/comments', reversible: true, description: 'Ajoute un commentaire à un élément.', rules: [] }),
    handle: async (call) => {
      const context = requireContext(call.context);
      const { body } = parseInput(CommentInput, call.body);
      return serviceWrite(runtimeFor(context.organisationId), call, { actionId: 'work_item.comment', resourceType: 'comment', context, replayable: true, execute: async (dependencies) => commentWorkItem(dependencies, context, { ...targetOf(call), body }), respond: (comment) => ({ status: 201, body: { ...comment, createdAt: new Date(comment.createdAt).toISOString() } }), resourceId: (comment) => comment.id });
    },
  };
}

/**
 * Déclare les actions des éléments.
 * @param runtimeFor environnement par organisation
 * @returns actions enregistrées
 */
export function workItemActions(runtimeFor: RuntimeFor): RegisteredAction[] {
  return [...readActions(runtimeFor), commentAction(runtimeFor), ...writeActions(runtimeFor)];
}
