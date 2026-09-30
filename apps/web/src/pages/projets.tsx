/**
 * Liste des projets et création d'un projet.
 *
 * Couche : interface (pages). Règles : RG-PRJ-001 (clé), RI-ERG-05 (état vide), RI-ACC-05
 * (statut porté par un libellé, pas seulement par la couleur), RI-ACC-08.
 */
import { Badge, Button, Select, Table, ToggleSwitch } from '@pajavamba/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState, type ReactNode, type SubmitEvent } from 'react';
import { useMe, useProjects, useWrite } from '../adaptateurs/requetes.ts';
import { can, PACK_LABELS, PROJECT_STATUS_LABELS, type Project } from '../domaine/modeles.ts';
import { EmptyState, ErrorMessage, Loading } from '../composants/retours.tsx';
import { Field } from './acces.tsx';

const STATUS_SEVERITY: Readonly<Partial<Record<Project['status'], 'success' | 'error' | 'info'>>> = { active: 'success', pending_deletion: 'error', draft: 'info' };

/**
 * Badge du statut d'un projet.
 * @param props statut
 * @returns élément React
 */
export function StatusBadge(props: Readonly<{ status: Project['status'] }>): ReactNode {
  const severity = STATUS_SEVERITY[props.status];
  return <Badge {...(severity === undefined ? {} : { severity })} small>{PROJECT_STATUS_LABELS[props.status]}</Badge>;
}

/**
 * Tableau des projets accessibles.
 * @param props projets
 * @returns élément React
 */
function TableProjets(props: Readonly<{ projects: readonly Project[] }>): ReactNode {
  return (
    <Table
      caption="Projets accessibles"
      headers={['Clé', 'Nom', 'Modèle', 'Statut', 'Éléments ouverts']}
      data={props.projects.map((project) => [
        project.key,
        <Link key={project.key} to="/projets/$cle" params={{ cle: project.key }}>{project.name}</Link>,
        PACK_LABELS[project.methodologyPackKey] ?? project.methodologyPackKey,
        <StatusBadge key="statut" status={project.status} />,
        String(project.openItemCount),
      ])}
    />
  );
}

/**
 * Page d'accueil : projets accessibles.
 * @returns élément React
 */
export function ProjetsPage(): ReactNode {
  const [includeArchived, setIncludeArchived] = useState(false);
  const projects = useProjects(includeArchived);
  const me = useMe();
  const list = projects.data?.data ?? [];
  const creation = can(me.data ?? undefined, 'project:create') ? <Button linkProps={{ href: '/projets/nouveau' }} iconId="fr-icon-add-line">Créer un projet</Button> : null;
  return (
    <>
      <h1>Projets</h1>
      <div className="fr-grid-row fr-grid-row--middle fr-mb-3w">
        <div className="fr-col">{creation}</div>
        <div className="fr-col-auto"><ToggleSwitch label="Afficher les projets archivés" inputTitle="Afficher les projets archivés" checked={includeArchived} onChange={setIncludeArchived} /></div>
      </div>
      <ErrorMessage error={projects.error} />
      {projects.isPending && <Loading />}
      {projects.isSuccess && list.length === 0 && <EmptyState message="Aucun projet ne vous est accessible pour l’instant. Un administrateur peut créer un projet ou vous y inviter." action={creation} />}
      {list.length > 0 && <TableProjets projects={list} />}
    </>
  );
}

/** Saisie d'un nouveau projet. */
interface NouveauProjet {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly methodologyPackKey: string;
  readonly visibility: string;
}

/**
 * Champs du formulaire de création.
 * @param props saisie et modification
 * @returns élément React
 */
function ChampsProjet(props: Readonly<{ form: NouveauProjet; onChange: (form: NouveauProjet) => void }>): ReactNode {
  const { form, onChange } = props;
  return (
    <>
      <Field label="Clé du projet" hint="Majuscules et chiffres, 2 à 10 caractères, immuable (ex. PAJA)" value={form.key} onChange={(key) => onChange({ ...form, key: key.toUpperCase() })} />
      <Field label="Nom" value={form.name} onChange={(name) => onChange({ ...form, name })} />
      <Field label="Présentation" required={false} value={form.description} onChange={(description) => onChange({ ...form, description })} />
      <Select label="Modèle méthodologique (obligatoire)" nativeSelectProps={{ value: form.methodologyPackKey, onChange: (event) => onChange({ ...form, methodologyPackKey: event.target.value }) }}>
        {Object.entries(PACK_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </Select>
      <Select label="Visibilité (obligatoire)" nativeSelectProps={{ value: form.visibility, onChange: (event) => onChange({ ...form, visibility: event.target.value }) }}>
        <option value="private">Privé</option>
        <option value="internal">Interne à l’organisation</option>
        <option value="public">Public</option>
      </Select>
    </>
  );
}

/**
 * Page de création d'un projet.
 * @returns élément React
 */
export function NouveauProjetPage(): ReactNode {
  const [form, setForm] = useState<NouveauProjet>({ key: '', name: '', description: '', methodologyPackKey: 'scrum', visibility: 'private' });
  const write = useWrite<Project>();
  const navigate = useNavigate();
  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    write.mutate({ method: 'POST', path: '/projects', body: form }, { onSuccess: (project) => void navigate({ to: '/projets/$cle', params: { cle: project.key } }) });
  };
  return (
    <>
      <h1>Créer un projet</h1>
      <p>Le projet est créé en brouillon ; vous pourrez l’activer une fois sa configuration prête.</p>
      <ErrorMessage error={write.error} />
      <form onSubmit={submit} className="fr-col-md-8">
        <ChampsProjet form={form} onChange={setForm} />
        <Button type="submit" disabled={write.isPending}>Créer le projet</Button>
      </form>
    </>
  );
}
