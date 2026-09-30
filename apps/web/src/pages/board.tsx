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
import { useBoard, useMembers, useWrite } from '../adaptateurs/requetes.ts';
import type { ItemSummary, WorkflowState } from '../domaine/modeles.ts';
import { ErrorMessage, Loading } from '../composants/retours.tsx';

const DRAG_TYPE = 'application/x-pajavamba-item';

/**
 * Carte d'un élément.
 * @param props élément, états possibles, déplacement
 * @returns élément React
 */
function Carte(props: { readonly projectKey: string; readonly item: ItemSummary; readonly states: readonly WorkflowState[]; readonly assignee: string; onMove(item: ItemSummary, state: string): void }): ReactNode {
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
 * Page du board.
 * @returns élément React
 */
export function BoardPage(): ReactNode {
  const { cle = '' } = useParams({ strict: false });
  const [workflow, setWorkflow] = useState('');
  const board = useBoard(cle, workflow);
  const members = useMembers();
  const write = useWrite();
  const [announce, setAnnounce] = useState('');
  const states = board.data?.columns.map((column) => column.state) ?? [];
  const move = (item: ItemSummary, state: string): void => {
    if (state === item.stateKey) return;
    const target = states.find((candidate) => candidate.key === state)?.name ?? state;
    write.mutate({ method: 'POST', path: `/projects/${cle}/work-items/${item.key}/actions/transition`, body: { toState: state } }, { onSuccess: () => setAnnounce(`${item.key} déplacé vers « ${target} ».`) });
  };
  const drop = (event: DragEvent, state: string): void => {
    event.preventDefault();
    const key = event.dataTransfer.getData(DRAG_TYPE);
    const item = board.data?.columns.flatMap((column) => column.items).find((candidate) => candidate.key === key);
    if (item !== undefined) move(item, state);
  };
  return (
    <>
      <p className="fr-text--sm fr-mb-1w"><Link to="/">Projets</Link> › <Link to="/projets/$cle" params={{ cle }}>{cle}</Link> › Board</p>
      <h1>Board {cle}</h1>
      <p aria-live="polite" className="fr-sr-only">{announce}</p>
      {(board.data?.workflowKeys.length ?? 0) > 1 && (
        <div className="fr-col-md-4">
          <Select label="Workflow affiché" nativeSelectProps={{ value: board.data?.workflowKey ?? '', onChange: (event) => setWorkflow(event.target.value) }}>
            {(board.data?.workflowKeys ?? []).map((key) => <option key={key} value={key}>{key === 'team_item' ? 'Éléments d’équipe' : key === 'epic' ? 'Epics' : key === 'bug' ? 'Anomalies' : key}</option>)}
          </Select>
        </div>
      )}
      <ErrorMessage error={board.error ?? write.error} />
      {board.isPending && <Loading />}
      <div className="pv-board">
        <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--no-wrap">
          {board.data?.columns.map((column) => (
            <section
              key={column.state.key}
              aria-labelledby={`colonne-${column.state.key}`}
              className={`fr-col-10 fr-col-sm-6 fr-col-md-4 fr-col-lg-3 pv-board__column fr-p-2w${column.overWipLimit ? ' pv-board__column--over' : ''}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event, column.state.key)}
            >
              <h2 id={`colonne-${column.state.key}`} className="fr-h6">
                {column.state.name} <Badge small noIcon>{String(column.items.length)}{column.state.wipLimit === null ? '' : ` / ${String(column.state.wipLimit)}`}</Badge>
              </h2>
              {column.overWipLimit && <p className="fr-error-text">Limite de travail en cours dépassée.</p>}
              <ul className="fr-raw-list">
                {column.items.map((item) => (
                  <Carte key={item.id} projectKey={cle} item={item} states={states} assignee={members.data?.data.find((member) => member.id === item.assigneeId)?.displayName ?? 'Non assigné'} onMove={move} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
