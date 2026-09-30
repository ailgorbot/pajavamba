/**
 * État serveur de l'interface (TanStack Query) : lectures et invalidations après écriture.
 *
 * Couche : interface (adaptateurs). Règles : RI-API-02, RI-ERG-06 (mise à jour avec retour
 * arrière : l'interface relit toujours l'état serveur après une écriture).
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { ItemDetail, ItemSummary, Me, Member, Project, WorkflowState } from '../domaine/modeles.ts';
import { api, ApiError, setCsrfToken, type Page } from './api.ts';

/** Délai de relecture des vues de lecture, alimentées de façon asynchrone (EXG-PERF-005). */
const PROJECTION_DELAY_MS = 400;
const HTTP_UNAUTHORIZED = 401;

/**
 * Profil de l'utilisateur connecté ; `null` si aucune session.
 * @returns requête
 */
export function useMe(): UseQueryResult<Me | null> {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const me = await api<Me>('GET', '/me');
        setCsrfToken(me.csrfToken);
        return me;
      } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_UNAUTHORIZED) return null;
        throw error;
      }
    },
    retry: false,
  });
}

/**
 * État d'initialisation de l'instance.
 * @returns requête
 */
export function useSetupStatus(): UseQueryResult<{ readonly initialized: boolean }> {
  return useQuery({ queryKey: ['setup'], queryFn: async () => api<{ readonly initialized: boolean }>('GET', '/setup') });
}

/**
 * Lecture générique d'une ressource.
 * @param key clé de cache
 * @param path chemin
 * @param enabled activation
 * @returns requête
 */
export function useResource<T>(key: readonly unknown[], path: string, enabled = true): UseQueryResult<T> {
  return useQuery({ queryKey: key, queryFn: async () => api<T>('GET', path), enabled });
}

/**
 * Projets accessibles.
 * @param includeArchived inclure les projets archivés
 * @returns requête
 */
export function useProjects(includeArchived: boolean): UseQueryResult<Page<Project>> {
  return useResource(['projects', includeArchived], `/projects?includeArchived=${String(includeArchived)}`);
}

/**
 * Projet et points bloquants de clôture.
 * @param key clé du projet
 * @returns requête
 */
export function useProject(key: string): UseQueryResult<Project> {
  return useResource(['project', key], `/projects/${key}`);
}

/**
 * Backlog d'un projet.
 * @param key clé du projet
 * @param includeDone inclure les éléments terminés
 * @param text filtre texte
 * @returns requête
 */
export function useBacklog(key: string, includeDone: boolean, text: string): UseQueryResult<Page<ItemSummary>> {
  return useResource(['backlog', key, includeDone, text], `/projects/${key}/backlog?includeDone=${String(includeDone)}&q=${encodeURIComponent(text)}`);
}

/** Board d'un projet. */
export interface Board {
  readonly workflowKeys: readonly string[];
  readonly workflowKey: string | null;
  readonly columns: readonly { readonly state: WorkflowState; readonly items: readonly ItemSummary[]; readonly overWipLimit: boolean }[];
}

/**
 * Board d'un projet.
 * @param key clé du projet
 * @param workflow workflow affiché
 * @returns requête
 */
export function useBoard(key: string, workflow: string): UseQueryResult<Board> {
  return useResource(['board', key, workflow], `/projects/${key}/board?workflow=${encodeURIComponent(workflow)}`);
}

/**
 * Détail d'un élément.
 * @param projectKey clé du projet
 * @param itemKey clé de l'élément
 * @returns requête
 */
export function useItem(projectKey: string, itemKey: string): UseQueryResult<ItemDetail> {
  return useResource(['item', itemKey], `/projects/${projectKey}/work-items/${itemKey}`);
}

/**
 * Membres de l'organisation.
 * @param enabled activation
 * @returns requête
 */
export function useMembers(enabled = true): UseQueryResult<Page<Member>> {
  return useResource(['members'], '/users', enabled);
}

/** Écriture générique. */
export interface Write {
  readonly method: 'POST' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly body?: unknown;
  readonly ifMatch?: number;
}

/**
 * Mutation générique : invalide tout l'état serveur, puis le relit après propagation des projections.
 * @returns mutation
 */
export function useWrite<T = unknown>(): UseMutationResult<T, unknown, Write> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (write: Write) => api<T>(write.method, write.path, { ...(write.body === undefined ? {} : { body: write.body }), ...(write.ifMatch === undefined ? {} : { ifMatch: write.ifMatch }) }),
    onSettled: async () => {
      await client.invalidateQueries();
      setTimeout(() => void client.invalidateQueries(), PROJECTION_DELAY_MS);
    },
  });
}
