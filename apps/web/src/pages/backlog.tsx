/**
 * Backlog d'un projet : liste ordonnée, création rapide, reclassement au clavier, filtres.
 *
 * Couche : interface (pages). Règles : RI-ACC-03 (alternative clavier à tout glisser-déposer :
 * boutons « Monter » et « Descendre »), RI-ACC-07 (annonce sobre), RG-WI-001, RG-WI-002.
 */
import { Button, Input, Select, Table, ToggleSwitch } from '@pajavamba/ui';
import { Link, useParams } from '@tanstack/react-router';
import { useState, type ReactNode, type SubmitEvent } from 'react';
import type { Page } from '../adaptateurs/api.ts';
import { useBacklog, useMembers, useResource, useWrite } from '../adaptateurs/requetes.ts';
import { PRIORITY_LABELS, type ItemSummary, type Member } from '../domaine/modeles.ts';
import { EmptyState, ErrorMessage, Loading } from '../composants/retours.tsx';

interface ItemType {
  readonly key: string;
  readonly name: string;
  readonly level: number;
  readonly allowedParentKeys: readonly string[];
}

/**
 * Sélecteurs du type et du parent d'un nouvel élément.
 * @param props types, parents possibles, sélection
 * @returns élément React
 */
function ChoixTypeParent(props: Readonly<{ types: readonly ItemType[]; typeKey: string; parents: readonly ItemSummary[]; parentKey: string; onType: (key: string) => void; onParent: (key: string) => void }>): ReactNode {
  return (
    <>
      <div className="fr-col-12 fr-col-md-2">
        <Select label="Type" nativeSelectProps={{ value: props.typeKey, onChange: (event) => props.onType(event.target.value) }}>
          {props.types.map((type) => <option key={type.key} value={type.key}>{type.name}</option>)}
        </Select>
      </div>
      <div className="fr-col-12 fr-col-md-3">
        <Select label="Parent" nativeSelectProps={{ value: props.parentKey, onChange: (event) => props.onParent(event.target.value) }}>
          <option value="">Aucun</option>
          {props.parents.map((item) => <option key={item.key} value={item.key}>{item.key} — {item.title}</option>)}
        </Select>
      </div>
    </>
  );
}

/**
 * Formulaire de création rapide d'un élément.
 * @param props projet, types, éléments pouvant servir de parent
 * @returns élément React
 */
function CreationRapide(props: Readonly<{ projectKey: string; types: readonly ItemType[]; items: readonly ItemSummary[] }>): ReactNode {
  const write = useWrite();
  const [typeKey, setTypeKey] = useState('');
  const [title, setTitle] = useState('');
  const [parentKey, setParentKey] = useState('');
  const selectedType = props.types.find((type) => type.key === typeKey) ?? props.types[0];
  const parents = props.items.filter((item) => selectedType?.allowedParentKeys.includes(item.typeKey) === true);
  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    write.mutate({ method: 'POST', path: `/projects/${props.projectKey}/work-items`, body: { typeKey: selectedType?.key ?? '', title, parentKey: parentKey === '' ? null : parentKey } }, { onSuccess: () => setTitle('') });
  };
  return (
    <form onSubmit={submit} className="fr-grid-row fr-grid-row--gutters fr-grid-row--bottom fr-mb-3w" aria-label="Créer un élément">
      <div className="fr-col-12"><ErrorMessage error={write.error} /></div>
      <div className="fr-col-12 fr-col-md-5">
        <Input label="Titre (obligatoire)" nativeInputProps={{ value: title, required: true, maxLength: 255, onChange: (event) => setTitle(event.target.value) }} />
      </div>
      <ChoixTypeParent types={props.types} typeKey={selectedType?.key ?? ''} parents={parents} parentKey={parentKey} onType={(key) => { setTypeKey(key); setParentKey(''); }} onParent={setParentKey} />
      <div className="fr-col-12 fr-col-md-2"><Button type="submit" disabled={write.isPending || title.trim() === ''}>Ajouter</Button></div>
    </form>
  );
}

/** Propriétés du tableau du backlog. */
interface TableBacklogProps {
  readonly projectKey: string;
  readonly items: readonly ItemSummary[];
  readonly types: readonly ItemType[];
  readonly members: readonly Member[];
  readonly onMove: (index: number, direction: -1 | 1) => void;
}

/**
 * Boutons de reclassement d'un élément.
 * @param props position, élément et déplacement
 * @returns élément React
 */
function Reclassement(props: Readonly<{ index: number; count: number; itemKey: string; onMove: (index: number, direction: -1 | 1) => void }>): ReactNode {
  return (
    <ul className="fr-btns-group fr-btns-group--inline fr-btns-group--sm">
      <li><Button size="small" priority="tertiary" iconId="fr-icon-arrow-up-line" title={`Monter ${props.itemKey}`} disabled={props.index === 0} onClick={() => props.onMove(props.index, -1)} /></li>
      <li><Button size="small" priority="tertiary" iconId="fr-icon-arrow-down-line" title={`Descendre ${props.itemKey}`} disabled={props.index === props.count - 1} onClick={() => props.onMove(props.index, 1)} /></li>
    </ul>
  );
}

/**
 * Tableau ordonné du backlog.
 * @param props éléments, types, membres et reclassement
 * @returns élément React
 */
function TableBacklog(props: Readonly<TableBacklogProps>): ReactNode {
  const { items, projectKey } = props;
  return (
    <Table
      caption={`Backlog ordonné du projet ${projectKey}`}
      headers={['Rang', 'Clé', 'Titre', 'Type', 'État', 'Priorité', 'Estimation', 'Responsable', 'Ordre']}
      data={items.map((item, index) => [
        String(index + 1),
        item.key,
        <Link key="titre" to="/projets/$cle/elements/$element" params={{ cle: projectKey, element: item.key }}>{item.title}</Link>,
        props.types.find((type) => type.key === item.typeKey)?.name ?? item.typeKey,
        item.stateName,
        PRIORITY_LABELS[item.priority] ?? item.priority,
        item.estimate === null ? '—' : String(item.estimate),
        props.members.find((member) => member.id === item.assigneeId)?.displayName ?? '—',
        <Reclassement key="ordre" index={index} count={items.length} itemKey={item.key} onMove={props.onMove} />,
      ])}
    />
  );
}

/**
 * Reclassement d'un élément avant son voisin, annoncé aux technologies d'assistance.
 * @param projectKey clé du projet
 * @param items éléments dans l'ordre affiché
 * @returns déplacement, annonce et erreur
 */
function useReclassement(projectKey: string, items: readonly ItemSummary[]): { readonly move: (index: number, direction: -1 | 1) => void; readonly announce: string; readonly error: unknown } {
  const write = useWrite();
  const [announce, setAnnounce] = useState('');
  const move = (index: number, direction: -1 | 1): void => {
    const item = items[index];
    if (item === undefined) return;
    const beforeKey = (direction === -1 ? items[index - 1]?.key : items[index + 2]?.key) ?? null;
    const sens = direction === -1 ? 'vers le haut' : 'vers le bas';
    write.mutate({ method: 'POST', path: `/projects/${projectKey}/work-items/${item.key}/actions/rank`, body: { beforeKey } }, { onSuccess: () => setAnnounce(`${item.key} déplacé ${sens}.`) });
  };
  return { move, announce, error: write.error };
}

/**
 * Données du backlog : éléments filtrés, types du projet, membres de l'organisation.
 * @param projectKey clé du projet
 * @param filters éléments terminés et texte recherché
 * @returns requête et listes
 */
function useBacklogData(projectKey: string, filters: { readonly includeDone: boolean; readonly text: string }): { readonly backlog: ReturnType<typeof useBacklog>; readonly items: readonly ItemSummary[]; readonly typeList: readonly ItemType[]; readonly memberList: readonly Member[] } {
  const backlog = useBacklog(projectKey, filters.includeDone, filters.text);
  const types = useResource<Page<ItemType>>(['types', projectKey], `/projects/${projectKey}/work-item-types`);
  const members = useMembers();
  return { backlog, items: backlog.data?.data ?? [], typeList: types.data?.data ?? [], memberList: members.data?.data ?? [] };
}

/**
 * Page du backlog.
 * @returns élément React
 */
export function BacklogPage(): ReactNode {
  const { cle = '' } = useParams({ strict: false });
  const [includeDone, setIncludeDone] = useState(false);
  const [text, setText] = useState('');
  const { backlog, items, typeList, memberList } = useBacklogData(cle, { includeDone, text });
  const { move, announce, error } = useReclassement(cle, items);
  const empty = backlog.isSuccess && items.length === 0;
  return (
    <>
      <p className="fr-text--sm fr-mb-1w"><Link to="/">Projets</Link> › <Link to="/projets/$cle" params={{ cle }}>{cle}</Link> › Backlog</p>
      <h1>Backlog {cle}</h1>
      <p aria-live="polite" className="fr-sr-only">{announce}</p>
      <CreationRapide projectKey={cle} types={typeList} items={items} />
      <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--middle">
        <div className="fr-col-12 fr-col-md-6"><Input label="Filtrer (recherche plein texte)" nativeInputProps={{ value: text, type: 'search', onChange: (event) => setText(event.target.value) }} /></div>
        <div className="fr-col-12 fr-col-md-6"><ToggleSwitch label="Afficher les éléments terminés" inputTitle="Afficher les éléments terminés" checked={includeDone} onChange={setIncludeDone} /></div>
      </div>
      <ErrorMessage error={backlog.error ?? error} />
      {backlog.isPending && <Loading />}
      {empty && <EmptyState message="Le backlog est vide. Ajoutez un premier élément avec le formulaire ci-dessus." />}
      {items.length > 0 && <TableBacklog projectKey={cle} items={items} types={typeList} members={memberList} onMove={move} />}
    </>
  );
}
