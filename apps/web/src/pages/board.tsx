/**
 * Board d'un projet : une colonne par état, déplacement par glisser-déposer ou au clavier
 * (« Déplacer vers… »), limites WIP signalées.
 *
 * Couche : interface (pages). Règles : RI-ACC-03 (alternative clavier « Déplacer vers… »),
 * RI-ACC-05 (dépassement WIP signalé par un texte, pas seulement par la couleur), RI-ACC-07,
 * RG-WF-004, EXG-PERF-003.
 */
import { Badge, Select } from '@pajavamba/ui';
import { Link, useParams } from '@tanstack/react-router';
import { useState, type DragEvent, type ReactNode } from 'react';
import { useBoard, useMembers, useWrite, type Board } from '../adaptateurs/requetes.ts';
import type { ItemSummary, Member, WorkflowState } from '../domaine/modeles.ts';
import { ErrorMessage, Loading } from '../composants/retours.tsx';

const DRAG_TYPE = 'application/x-pajavamba-item';
const WORKFLOW_LABELS: Readonly<Record<string, string>> = { team_item: 'Éléments d’équipe', epic: 'Epics', bug: 'Anomalies' };

type Move = (item: ItemSummary, state: string) => void;

/** Propriétés d'une carte. */
interface CarteProps {
  readonly projectKey: string;
  readonly item: ItemSummary;
  readonly states: readonly WorkflowState[];
  readonly assignee: string;
  readonly onMove: Move;
}

/**
 * Carte d'un élément.
 * @param props élément, états possibles, déplacement
 * @returns élément React
 */
function Carte(props: Readonly<CarteProps>): ReactNode {
  const { item } = props;
  const [dragging, setDragging] = useState(false);
  return (
    <li
      className={`pv-card fr-p-2w fr-mb-2w${dragging ? ' pv-card--dragging' : ''}`}
      draggable
      onDragStart={(event: DragEvent) => { event.dataTransfer.setData(DRAG_TYPE, item.key); setDragging(true); }}
      onDragEnd={() => setDragging(false)}
    >
      <p className="fr-text--sm fr-mb-1v">{item.key}{item.confidentiality === 'restricted' ? ' · confidentiel' : ''}</p>
      <p className="fr-text--bold fr-mb-1w"><Link to="/projets/$cle/elements/$element" params={{ cle: props.projectKey, element: item.key }}>{item.title}</Link></p>
      <p className="fr-text--xs fr-mb-1w">{props.assignee}{item.estimate === null ? '' : ` · ${String(item.estimate)} pt`}</p>
      <Select label={<>Déplacer<span className="fr-sr-only"> {item.key}</span> vers…</>} nativeSelectProps={{ value: item.stateKey, onChange: (event) => props.onMove(item, event.target.value) }}>
        {props.states.map((state) => <option key={state.key} value={state.key}>{state.name}</option>)}
      </Select>
    </li>
  );
}

/**
 * Colonne d'un état, cible de dépôt.
 * @param props colonne, carte et déplacement
 * @returns élément React
 */
function Colonne(props: Readonly<{ projectKey: string; column: Board['columns'][number]; states: readonly WorkflowState[]; members: readonly Member[]; onMove: Move; onDrop: (event: DragEvent, state: string) => void }>): ReactNode {
  const { column } = props;
  const limit = column.state.wipLimit === null ? '' : ` / ${String(column.state.wipLimit)}`;
  return (
    <section
      aria-labelledby={`colonne-${column.state.key}`}
      className={`fr-col-10 fr-col-sm-6 fr-col-md-4 fr-col-lg-3 pv-board__column fr-p-2w${column.overWipLimit ? ' pv-board__column--over' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => props.onDrop(event, column.state.key)}
    >
      <h2 id={`colonne-${column.state.key}`} className="fr-h6">{column.state.name} <Badge small noIcon>{`${String(column.items.length)}${limit}`}</Badge></h2>
      {column.overWipLimit && <p className="fr-error-text">Limite de travail en cours dépassée.</p>}
      <ul className="fr-raw-list">
        {column.items.map((item) => (
          <Carte key={item.id} projectKey={props.projectKey} item={item} states={props.states} assignee={props.members.find((member) => member.id === item.assigneeId)?.displayName ?? 'Non assigné'} onMove={props.onMove} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Choix du workflow affiché, lorsque le projet en compte plusieurs.
 * @param props workflows et sélection
 * @returns élément React ou rien
 */
function ChoixWorkflow(props: Readonly<{ board: Board | undefined; onChange: (workflow: string) => void }>): ReactNode {
  const keys = props.board?.workflowKeys ?? [];
  if (keys.length <= 1) return null;
  return (
    <div className="fr-col-md-4">
      <Select label="Workflow affiché" nativeSelectProps={{ value: props.board?.workflowKey ?? '', onChange: (event) => props.onChange(event.target.value) }}>
        {keys.map((key) => <option key={key} value={key}>{WORKFLOW_LABELS[key] ?? key}</option>)}
      </Select>
    </div>
  );
}

/**
 * Déplacement d'une carte (transition), annoncé aux technologies d'assistance.
 * @param projectKey clé du projet
 * @param board board courant
 * @returns déplacement, dépôt, annonce et erreur
 */
function useDeplacement(projectKey: string, board: Board | undefined): { readonly move: Move; readonly drop: (event: DragEvent, state: string) => void; readonly announce: string; readonly error: unknown } {
  const write = useWrite();
  const [announce, setAnnounce] = useState('');
  const move: Move = (item, state) => {
    if (state === item.stateKey) return;
    const target = board?.columns.find((column) => column.state.key === state)?.state.name ?? state;
    write.mutate({ method: 'POST', path: `/projects/${projectKey}/work-items/${item.key}/actions/transition`, body: { toState: state } }, { onSuccess: () => setAnnounce(`${item.key} déplacé vers « ${target} ».`) });
  };
  const drop = (event: DragEvent, state: string): void => {
    event.preventDefault();
    const key = event.dataTransfer.getData(DRAG_TYPE);
    const item = board?.columns.flatMap((column) => column.items).find((candidate) => candidate.key === key);
    if (item !== undefined) move(item, state);
  };
  return { move, drop, announce, error: write.error };
}

/**
 * Page du board.
 * @returns élément React
 */
export function BoardPage(): ReactNode {
  const { cle = '' } = useParams({ strict: false });
  const [workflow, setWorkflow] = useState('');
  const board = useBoard(cle, workflow);
  const members = useMembers();
  const { move, drop, announce, error } = useDeplacement(cle, board.data);
  const states = board.data?.columns.map((column) => column.state) ?? [];
  return (
    <>
      <p className="fr-text--sm fr-mb-1w"><Link to="/">Projets</Link> › <Link to="/projets/$cle" params={{ cle }}>{cle}</Link> › Board</p>
      <h1>Board {cle}</h1>
      <p aria-live="polite" className="fr-sr-only">{announce}</p>
      <ChoixWorkflow board={board.data} onChange={setWorkflow} />
      <ErrorMessage error={board.error ?? error} />
      {board.isPending && <Loading />}
      <div className="pv-board">
        <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--no-wrap">
          {board.data?.columns.map((column) => <Colonne key={column.state.key} projectKey={cle} column={column} states={states} members={members.data?.data ?? []} onMove={move} onDrop={drop} />)}
        </div>
      </div>
    </>
  );
}
