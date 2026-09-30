/**
 * Page d'un projet : vue d'ensemble et cycle de vie (assistant de clôture), équipes, membres,
 * workflows, journal d'activité.
 *
 * Couche : interface (pages). Règles : RG-PRJ-003 à RG-PRJ-007, RI-MET-01 (aucune clôture forcée),
 * RI-ERG-02 (confirmation des actions irréversibles), RI-HAB-02 (actions R3 : MFA récente).
 */
import { Alert, Button, Tabs } from '@pajavamba/ui';
import { Link, useParams } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { useProject, useWrite } from '../adaptateurs/requetes.ts';
import { formatDate, PACK_LABELS, type Project } from '../domaine/modeles.ts';
import { ConfirmButton, ErrorMessage, Loading } from '../composants/retours.tsx';
import { Field } from './acces.tsx';
import { ActiviteProjet, EquipesProjet, MembresProjet, WorkflowsProjet } from './projet-onglets.tsx';
import { StatusBadge } from './projets.tsx';

/** Propriétés communes des actions du cycle de vie. */
interface EtapeProps {
  readonly project: Project;
  readonly subject: string;
  readonly pending: boolean;
  readonly run: (action: string, body?: Record<string, string>) => void;
}

/**
 * Brouillon : activation ou suppression.
 * @param props projet et exécution
 * @returns élément React
 */
function EtapeBrouillon(props: Readonly<EtapeProps>): ReactNode {
  return (
    <ul className="fr-btns-group fr-btns-group--inline">
      <li><Button disabled={!props.project.configurationReady || props.pending} onClick={() => props.run('activate')}>Activer le projet</Button></li>
      <li><ConfirmButton label="Supprimer le brouillon" subject={props.subject} onConfirm={() => props.run('request-deletion')} /></li>
    </ul>
  );
}

/**
 * Projet actif : assistant de clôture (aucune clôture forcée).
 * @param props projet et exécution
 * @returns élément React
 */
function EtapeActif(props: Readonly<EtapeProps>): ReactNode {
  const [text, setText] = useState('');
  const blockers = props.project.closureBlockers ?? [];
  return (
    <>
      <h3>Assistant de clôture</h3>
      {blockers.length > 0
        ? <Alert severity="warning" small title="Points bloquants" description={<ul>{blockers.map((blocker) => <li key={blocker.code}>{blocker.message}</li>)}</ul>} />
        : <p>Aucun point bloquant : le projet peut être clôturé après saisie du bilan.</p>}
      <Field label="Bilan de clôture" value={text} onChange={setText} />
      <ConfirmButton label="Clôturer le projet" subject={props.subject} disabled={blockers.length > 0 || text.trim() === ''} onConfirm={() => props.run('close', { text })} />
    </>
  );
}

/**
 * Projet clôturé : réouverture ou archivage.
 * @param props projet et exécution
 * @returns élément React
 */
function EtapeCloture(props: Readonly<EtapeProps>): ReactNode {
  const [text, setText] = useState('');
  return (
    <>
      <Field label="Justification de la réouverture" required={false} value={text} onChange={setText} />
      <ul className="fr-btns-group fr-btns-group--inline">
        <li><Button priority="secondary" disabled={text.trim() === ''} onClick={() => props.run('reopen', { text })}>Rouvrir (sous 90 jours)</Button></li>
        <li><ConfirmButton label="Archiver le projet" subject={props.subject} onConfirm={() => props.run('archive')} /></li>
      </ul>
    </>
  );
}

/**
 * Projet archivé : désarchivage ou demande de suppression.
 * @param props projet et exécution
 * @returns élément React
 */
function EtapeArchive(props: Readonly<EtapeProps>): ReactNode {
  return (
    <ul className="fr-btns-group fr-btns-group--inline">
      <li><Button priority="secondary" onClick={() => props.run('unarchive')}>Désarchiver</Button></li>
      <li><ConfirmButton label="Demander la suppression (délai de grâce de 30 jours)" subject={props.subject} onConfirm={() => props.run('request-deletion')} /></li>
    </ul>
  );
}

/**
 * Suppression programmée : annulation possible jusqu'à l'échéance.
 * @param props projet et exécution
 * @returns élément React
 */
function EtapeSuppression(props: Readonly<EtapeProps>): ReactNode {
  return (
    <>
      <p>Purge programmée le {formatDate(props.project.deletionScheduledFor)}.</p>
      <Button onClick={() => props.run('cancel-deletion')}>Annuler la suppression</Button>
    </>
  );
}

const ETAPES: Readonly<Record<Project['status'], (props: Readonly<EtapeProps>) => ReactNode>> = {
  draft: EtapeBrouillon,
  active: EtapeActif,
  closed: EtapeCloture,
  archived: EtapeArchive,
  pending_deletion: EtapeSuppression,
};

/**
 * Actions du cycle de vie disponibles selon le statut.
 * @param props projet
 * @returns élément React
 */
function CycleDeVie(props: Readonly<{ project: Project }>): ReactNode {
  const { project } = props;
  const write = useWrite<Project>();
  const run = (action: string, body: Record<string, string> = {}): void => write.mutate({ method: 'POST', path: `/projects/${project.key}/actions/${action}`, body });
  const Etape = ETAPES[project.status];
  return (
    <section aria-labelledby="cycle-de-vie" className="fr-mt-4w">
      <h2 id="cycle-de-vie">Cycle de vie</h2>
      <ErrorMessage error={write.error} />
      <p className="fr-text--sm">Les actions « Désarchiver » et « Suppression » exigent une vérification MFA récente (moins de 15 minutes), à effectuer depuis <Link to="/profil">Mon profil</Link>.</p>
      <Etape project={project} subject={`le projet ${project.key}`} pending={write.isPending} run={run} />
    </section>
  );
}

/**
 * Vue d'ensemble d'un projet.
 * @param props projet
 * @returns élément React
 */
function VueEnsemble(props: Readonly<{ project: Project }>): ReactNode {
  const { project } = props;
  return (
    <>
      <dl className="fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-6 fr-col-md-3"><dt className="fr-text--bold">Statut</dt><dd><StatusBadge status={project.status} /></dd></div>
        <div className="fr-col-6 fr-col-md-3"><dt className="fr-text--bold">Modèle</dt><dd>{PACK_LABELS[project.methodologyPackKey] ?? project.methodologyPackKey}</dd></div>
        <div className="fr-col-6 fr-col-md-3"><dt className="fr-text--bold">Éléments non terminés</dt><dd>{project.openItemCount}</dd></div>
        <div className="fr-col-6 fr-col-md-3"><dt className="fr-text--bold">Configuration</dt><dd>{project.configurationReady ? 'Prête (types et workflows publiés)' : 'En préparation…'}</dd></div>
      </dl>
      {project.description !== '' && <p>{project.description}</p>}
      {project.closureSummary !== null && <p><strong>Bilan de clôture :</strong> {project.closureSummary}</p>}
      <CycleDeVie project={project} />
    </>
  );
}

/**
 * Page d'un projet.
 * @returns élément React
 */
export function ProjetPage(): ReactNode {
  const { cle } = useParams({ strict: false });
  const project = useProject(cle ?? '');
  if (project.isPending) return <Loading />;
  if (project.data === undefined) return <ErrorMessage error={project.error} />;
  const data = project.data;
  return (
    <>
      <p className="fr-text--sm fr-mb-1w"><Link to="/">Projets</Link> › {data.key}</p>
      <h1>{data.name} <span className="fr-text--lg">({data.key})</span></h1>
      <ul className="fr-btns-group fr-btns-group--inline fr-mb-3w">
        <li><Button linkProps={{ href: `/projets/${data.key}/backlog` }} iconId="fr-icon-list-unordered">Backlog</Button></li>
        <li><Button priority="secondary" linkProps={{ href: `/projets/${data.key}/board` }} iconId="fr-icon-layout-grid-line">Board</Button></li>
      </ul>
      <Tabs
        label="Sections du projet"
        tabs={[
          { label: 'Vue d’ensemble', content: <VueEnsemble project={data} /> },
          { label: 'Équipes', content: <EquipesProjet project={data} /> },
          { label: 'Membres et rôles', content: <MembresProjet project={data} /> },
          { label: 'Workflows', content: <WorkflowsProjet project={data} /> },
          { label: 'Activité', content: <ActiviteProjet project={data} /> },
        ]}
      />
    </>
  );
}
