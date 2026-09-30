/**
 * Onglets de la page projet : équipes, membres et rôles, workflows, journal d'activité.
 *
 * Couche : interface (pages). Règles : RI-HAB-02 (gestion des membres : R3), RG-WF-001 (versions
 * publiées immuables, affichées en lecture), RI-ACC-04 (données présentées en tableaux).
 */
import { Button, Select, Table } from '@pajavamba/ui';
import { useState, type SubmitEvent, type ReactNode } from 'react';
import type { Page } from '../adaptateurs/api.ts';
import { useMembers, useResource, useWrite } from '../adaptateurs/requetes.ts';
import { CATEGORY_LABELS, formatDate, ROLE_LABELS, type Project } from '../domaine/modeles.ts';
import { ConfirmButton, EmptyState, ErrorMessage, Loading } from '../composants/retours.tsx';
import { Field } from './acces.tsx';

interface Team {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly kind: string;
  readonly members: readonly { readonly userId: string; readonly teamRole: string; readonly allocationPercent: number }[];
}

interface Assignment {
  readonly id: string;
  readonly userId: string;
  readonly roleKey: string;
  readonly effect: 'allow' | 'deny';
}

const PROJECT_ROLES = ['project_admin', 'product_owner', 'scrum_master', 'contributor', 'reader'];

/**
 * Nom affiché d'un membre de l'organisation.
 * @param members membres
 * @param userId identifiant
 * @returns nom
 */
function nameOf(members: readonly { readonly id: string; readonly displayName: string }[] | undefined, userId: string | null): string {
  return members?.find((member) => member.id === userId)?.displayName ?? '—';
}

/**
 * Formulaire de création d'une équipe rattachée au projet.
 * @param props projet
 * @returns élément React
 */
function CreationEquipe(props: Readonly<{ project: Project }>): ReactNode {
  const write = useWrite();
  const [form, setForm] = useState({ key: '', name: '', kind: 'scrum' });
  const create = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    write.mutate({ method: 'POST', path: `/projects/${props.project.key}/teams`, body: form });
  };
  return (
    <form onSubmit={create} className="fr-col-md-8">
      <h3>Créer une équipe</h3>
      <ErrorMessage error={write.error} />
      <Field label="Clé de l’équipe" hint="Majuscules et chiffres, 2 à 6 caractères" value={form.key} onChange={(value) => setForm({ ...form, key: value.toUpperCase() })} />
      <Field label="Nom" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
      <Select label="Nature (obligatoire)" nativeSelectProps={{ value: form.kind, onChange: (event) => setForm({ ...form, kind: event.target.value }) }}>
        <option value="scrum">Scrum</option><option value="kanban">Kanban</option><option value="scrumban">Scrumban</option><option value="other">Autre</option>
      </Select>
      <Button type="submit">Créer l’équipe</Button>
    </form>
  );
}

/**
 * Onglet des équipes.
 * @param props projet
 * @returns élément React
 */
export function EquipesProjet(props: Readonly<{ project: Project }>): ReactNode {
  const teams = useResource<Page<Team>>(['teams', props.project.key], `/projects/${props.project.key}/teams`);
  const members = useMembers();
  const describe = (team: Team): string => (team.members.length === 0 ? 'Aucun membre.' : team.members.map((member) => `${nameOf(members.data?.data, member.userId)} (${String(member.allocationPercent)} %)`).join(', '));
  return (
    <>
      <ErrorMessage error={teams.error} />
      {teams.isPending && <Loading />}
      {teams.data?.data.length === 0 && <EmptyState message="Aucune équipe n’est rattachée à ce projet." />}
      {teams.data?.data.map((team) => (
        <section key={team.id} className="fr-mb-3w">
          <h3>{team.name} ({team.key})</h3>
          <p>{describe(team)}</p>
        </section>
      ))}
      <CreationEquipe project={props.project} />
    </>
  );
}

/**
 * Formulaire d'attribution d'un rôle de projet.
 * @param props projet et membres de l'organisation
 * @returns élément React
 */
function AttributionRole(props: Readonly<{ project: Project; members: readonly { readonly id: string; readonly displayName: string; readonly email: string }[] }>): ReactNode {
  const write = useWrite();
  const [userId, setUserId] = useState('');
  const [roleKey, setRoleKey] = useState('contributor');
  const add = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    write.mutate({ method: 'POST', path: '/role-assignments', body: { userId, roleKey, projectId: props.project.id, effect: 'allow' } });
  };
  return (
    <form onSubmit={add} className="fr-col-md-8">
      <ErrorMessage error={write.error} />
      <Select label="Personne (obligatoire)" nativeSelectProps={{ value: userId, required: true, onChange: (event) => setUserId(event.target.value) }}>
        <option value="" disabled>Choisir une personne</option>
        {props.members.map((member) => <option key={member.id} value={member.id}>{member.displayName} — {member.email}</option>)}
      </Select>
      <Select label="Rôle (obligatoire)" nativeSelectProps={{ value: roleKey, onChange: (event) => setRoleKey(event.target.value) }}>
        {PROJECT_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
      </Select>
      <Button type="submit" disabled={userId === ''}>Attribuer le rôle</Button>
    </form>
  );
}

/**
 * Onglet des membres et rôles du projet.
 * @param props projet
 * @returns élément React
 */
export function MembresProjet(props: Readonly<{ project: Project }>): ReactNode {
  const assignments = useResource<Page<Assignment>>(['assignments', props.project.id], `/projects/${props.project.id}/members`);
  const members = useMembers();
  const write = useWrite();
  const people = members.data?.data ?? [];
  return (
    <>
      <p className="fr-text--sm">La gestion des membres est une action sensible (R3) : vérifiez votre MFA depuis « Mon profil » dans les 15 minutes qui précèdent.</p>
      <ErrorMessage error={write.error ?? assignments.error} />
      <Table
        caption="Attributions de rôles du projet"
        headers={['Personne', 'Rôle', 'Effet', 'Action']}
        data={(assignments.data?.data ?? []).map((assignment) => [
          nameOf(people, assignment.userId),
          ROLE_LABELS[assignment.roleKey] ?? assignment.roleKey,
          assignment.effect === 'allow' ? 'Autorisation' : 'Refus explicite',
          <ConfirmButton key={assignment.id} label="Retirer" subject={`le rôle de ${nameOf(people, assignment.userId)}`} onConfirm={() => write.mutate({ method: 'DELETE', path: `/role-assignments/${assignment.id}` })} />,
        ])}
      />
      <AttributionRole project={props.project} members={people} />
    </>
  );
}

interface WorkflowView {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly versions: readonly { readonly id: string; readonly number: number; readonly status: string; readonly definition: { readonly states: readonly { readonly key: string; readonly name: string; readonly category: string }[] } }[];
}

/**
 * Onglet des workflows (lecture des versions publiées).
 * @param props projet
 * @returns élément React
 */
export function WorkflowsProjet(props: Readonly<{ project: Project }>): ReactNode {
  const workflows = useResource<Page<WorkflowView>>(['workflows', props.project.key], `/projects/${props.project.key}/workflows`);
  return (
    <>
      <ErrorMessage error={workflows.error} />
      {workflows.data?.data.map((workflow) => {
        const latest = workflow.versions.at(-1);
        return (
          <section key={workflow.id} className="fr-mb-3w">
            <h3>{workflow.name} — version {latest?.number ?? '—'} ({latest?.status === 'published' ? 'publiée, immuable' : latest?.status})</h3>
            <Table caption={`États du workflow ${workflow.name}`} headers={['Ordre', 'État', 'Catégorie']} data={(latest?.definition.states ?? []).map((state, index) => [String(index + 1), state.name, CATEGORY_LABELS[state.category] ?? state.category])} />
          </section>
        );
      })}
    </>
  );
}

interface ActivityEntry {
  readonly occurredAt: string;
  readonly eventCode: string;
  readonly resourceKey: string | null;
  readonly params: Readonly<Record<string, string | number | boolean | null>>;
}

const EVENT_LABELS: Readonly<Record<string, string>> = {
  'pv.portfolio.project.created.v1': 'Projet créé', 'pv.portfolio.project.activated.v1': 'Projet activé', 'pv.portfolio.project.closed.v1': 'Projet clôturé',
  'pv.portfolio.project.reopened.v1': 'Projet rouvert', 'pv.portfolio.project.archived.v1': 'Projet archivé', 'pv.portfolio.project.updated.v1': 'Projet modifié',
  'pv.workitem.work_item.created.v1': 'Élément créé', 'pv.workitem.work_item.updated.v1': 'Élément modifié', 'pv.workitem.work_item.transitioned.v1': 'Changement d’état',
  'pv.workitem.work_item.assigned.v1': 'Assignation', 'pv.workitem.work_item.ranked.v1': 'Reclassement', 'pv.workitem.work_item.deleted.v1': 'Mise en corbeille',
  'pv.workitem.work_item.restored.v1': 'Restauration', 'pv.workitem.comment.added.v1': 'Commentaire ajouté',
};

/**
 * Onglet du journal d'activité.
 * @param props projet
 * @returns élément React
 */
export function ActiviteProjet(props: Readonly<{ project: Project }>): ReactNode {
  const activity = useResource<Page<ActivityEntry>>(['activity', props.project.key], `/projects/${props.project.key}/activity`);
  return (
    <>
      <ErrorMessage error={activity.error} />
      <Table
        caption="Journal d’activité (200 dernières entrées)"
        headers={['Date', 'Événement', 'Ressource', 'Détail']}
        data={(activity.data?.data ?? []).map((entry) => [formatDate(entry.occurredAt), EVENT_LABELS[entry.eventCode] ?? entry.eventCode, entry.resourceKey ?? '—', Object.entries(entry.params).map(([key, value]) => `${key} : ${String(value)}`).join(' ; ')])}
      />
    </>
  );
}
