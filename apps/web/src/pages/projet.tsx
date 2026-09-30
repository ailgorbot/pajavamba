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

/**
 * Actions du cycle de vie disponibles selon le statut.
 * @param props projet
 * @returns élément React
 */
function CycleDeVie(props: { readonly project: Project }): ReactNode {
  const { project } = props;
  const write = useWrite<Project>();
  const [text, setText] = useState('');
  const run = (action: string, body: Record<string, string> = {}): void => write.mutate({ method: 'POST', path: `/projects/${project.key}/actions/${action}`, body });
  const subject = `le projet ${project.key}`;
  return (
    <section aria-labelledby="cycle-de-vie" className="fr-mt-4w">
      <h2 id="cycle-de-vie">Cycle de vie</h2>
      <ErrorMessage error={write.error} />
      <p className="fr-text--sm">Les actions « Désarchiver » et « Suppression » exigent une vérification MFA récente (moins de 15 minutes), à effectuer depuis <Link to="/profil">Mon profil</Link>.</p>
      {project.status === 'draft' && (
        <ul className="fr-btns-group fr-btns-group--inline">
          <li><Button disabled={!project.configurationReady || write.isPending} onClick={() => run('activate')}>Activer le projet</Button></li>
          <li><ConfirmButton label="Supprimer le brouillon" subject={subject} onConfirm={() => run('request-deletion')} /></li>
        </ul>
      )}
      {project.status === 'active' && (
        <>
          <h3>Assistant de clôture</h3>
          {(project.closureBlockers ?? []).length > 0
            ? <Alert severity="warning" small title="Points bloquants" description={<ul>{(project.closureBlockers ?? []).map((blocker) => <li key={blocker.code}>{blocker.message}</li>)}</ul>} />
            : <p>Aucun point bloquant : le projet peut être clôturé après saisie du bilan.</p>}
          <Field label="Bilan de clôture" value={text} onChange={setText} />
          <ConfirmButton label="Clôturer le projet" subject={subject} disabled={(project.closureBlockers ?? []).length > 0 || text.trim() === ''} onConfirm={() => run('close', { text })} />
        </>
      )}
      {project.status === 'closed' && (
        <>
          <Field label="Justification de la réouverture" required={false} value={text} onChange={setText} />
          <ul className="fr-btns-group fr-btns-group--inline">
            <li><Button priority="secondary" disabled={text.trim() === ''} onClick={() => run('reopen', { text })}>Rouvrir (sous 90 jours)</Button></li>
            <li><ConfirmButton label="Archiver le projet" subject={subject} onConfirm={() => run('archive')} /></li>
          </ul>
        </>
      )}
      {project.status === 'archived' && (
        <ul className="fr-btns-group fr-btns-group--inline">
          <li><Button priority="secondary" onClick={() => run('unarchive')}>Désarchiver</Button></li>
          <li><ConfirmButton label="Demander la suppression (délai de grâce de 30 jours)" subject={subject} onConfirm={() => run('request-deletion')} /></li>
        </ul>
      )}
      {project.status === 'pending_deletion' && (
        <>
          <p>Purge programmée le {formatDate(project.deletionScheduledFor)}.</p>
          <Button onClick={() => run('cancel-deletion')}>Annuler la suppression</Button>
        </>
      )}
    </section>
  );
}

/**
 * Vue d'ensemble d'un projet.
 * @param props projet
 * @returns élément React
 */
function VueEnsemble(props: { readonly project: Project }): ReactNode {
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
