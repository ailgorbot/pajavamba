/**
 * Schémas d'entrée (Zod, fermés) des actions sur les éléments de travail et références de chemin.
 *
 * Couche : moyenne (workitem/structure). Règles : RI-COD-12 (validation Zod en couche moyenne,
 * champs inconnus rejetés), RI-SEC-03.
 */
import type { ActionCall } from '@pajavamba/contracts';
import { parseProjectRef } from '@pajavamba/kernel';
import { HttpProblem } from '@pajavamba/ops';
import { PRIORITIES, type ItemTarget } from '@pajavamba/workitem-fonctionnel';
import { z } from 'zod';

const NOT_FOUND = new HttpProblem({ status: 404, code: 'access.not_found', title: 'Ressource introuvable', detail: "La ressource demandée n'existe pas ou n'est pas accessible." });

/** Création d'un élément. */
export const CreateInput = z.strictObject({
  typeKey: z.string().max(41).describe("Type d'élément"),
  title: z.string().max(255).describe('Titre'),
  description: z.string().max(65_535).default('').describe('Description (Markdown)'),
  acceptanceCriteria: z.string().max(20_000).default('').describe("Critères d'acceptation"),
  priority: z.enum(PRIORITIES).default('medium').describe('Priorité'),
  estimate: z.number().nullable().default(null).describe('Estimation'),
  parentKey: z.string().max(60).nullable().default(null).describe('Clé du parent'),
  confidentiality: z.enum(['normal', 'restricted']).default('normal').describe('Confidentialité'),
});

/** Modification d'un élément. */
export const UpdateInput = z.strictObject({
  title: z.string().max(255).optional(),
  description: z.string().max(65_535).optional(),
  acceptanceCriteria: z.string().max(20_000).optional(),
  priority: z.enum(PRIORITIES).optional(),
  estimate: z.number().nullable().optional(),
  parentKey: z.string().max(60).nullable().optional(),
  confidentiality: z.enum(['normal', 'restricted']).optional(),
});

/** Transition. */
export const TransitionInput = z.strictObject({ toState: z.string().max(41).describe('État cible') });
/** Assignation. */
export const AssignInput = z.strictObject({ assigneeId: z.uuid().nullable().describe('Responsable, ou null pour désassigner') });
/** Reclassement. */
export const RankInput = z.strictObject({ beforeKey: z.string().max(60).nullable().describe('Élément devant lequel se placer, ou null pour la fin') });
/** Commentaire. */
export const CommentInput = z.strictObject({ body: z.string().max(20_000).describe('Commentaire (Markdown)') });

/**
 * Projet et élément désignés par le chemin.
 * @param call appel
 * @returns désignation
 */
export function targetOf(call: ActionCall): ItemTarget {
  const ref = parseProjectRef(call.params['projectRef']);
  if (ref === undefined) throw NOT_FOUND;
  return { ref, itemRef: call.params['itemKey'] ?? '' };
}

/**
 * Retire les champs absents d'une modification partielle.
 * @param input champs reçus
 * @returns champs présents
 */
export function presentFields<T extends object>(input: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  // Conversion justifiée : le filtrage retire exactement les valeurs `undefined` du type.
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as { [K in keyof T]?: Exclude<T[K], undefined> };
}
