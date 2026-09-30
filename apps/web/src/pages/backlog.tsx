/**
 * Backlog d'un projet : liste ordonnée, création rapide, reclassement au clavier, filtres.
 *
 * Couche : interface (pages). Règles : RI-ACC-03 (alternative clavier à tout glisser-déposer :
 * boutons « Monter » et « Descendre »), RI-ACC-07 (annonce sobre), RG-WI-001, RG-WI-002.
 */
import { Button, Input, Select, Table, ToggleSwitch } from '@pajavamba/ui';
import { Link, useParams } from '@tanstack/react-router';
import { useState, type SubmitEvent, type ReactNode } from 'react';
import type { Page } from '../adaptateurs/api.ts';
import { useBacklog, useMembers, useResource, useWrite } from '../adaptateurs/requetes.ts';
import { PRIORITY_LABELS, type ItemSummary } from '../domaine/modeles.ts';
import { EmptyState, ErrorMessage, Loading } from '../composants/retours.tsx';

interface ItemType {
  readonly key: string;
  readonly name: string;
  readonly level: number;
  readonly allowedParentKeys: readonly string[];
}

/**
 * Formulaire de création rapide d'un élément.
 * @param props projet, types, éléments pouvant servir de parent
 * @returns élément React
 */
function CreationRapide(props: { readonly projectKey: string; readonly types: readonly ItemType[]; readonly items: readonly ItemSummary[] }): ReactNode {
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
      <div className="fr-col-12 fr-col-md-2">
        <Select label="Type" nativeSelectProps={{ value: selectedType?.key ?? '', onChange: (event) => { setTypeKey(event.target.value); setParentKey(''); } }}>
          {props.types.map((type) => <option key={type.key} value={type.key}>{type.name}</option>)}
        </Select>
      </div>
      <div className="fr-col-12 fr-col-md-5">
        <Input label="Titre (obligatoire)" nativeInputProps={{ value: title, required: true, maxLength: 255, onChange: (event) => setTitle(event.target.value) }} />
      </div>
      <div className="fr-col-12 fr-col-md-3">
        <Select label="Parent" nativeSelectProps={{ value: parentKey, onChange: (event) => setParentKey(event.target.value) }}>
          <option value="">Aucun</option>
          {parents.map((item) => <option key={item.key} value={item.key}>{item.key} — {item.title}</option>)}
        </Select>
      </div>
      <div className="fr-col-12 fr-col-md-2"><Button type="submit" disabled={write.isPending || title.trim() === ''}>Ajouter</Button></div>
    </form>
  );
}

/**
 * Page du backlog.
 * @returns élément React
 */
export function BacklogPage(): ReactNode {
  const { cle = '' } = useParams({ strict: false });
  const [includeDone, setIncludeDone] = useState(false);
  const [text, setText] = useState('');
  const backlog = useBacklog(cle, includeDone, text);
  const types = useResource<Page<ItemType>>(['types', cle], `/projects/${cle}/work-item-types`);
  const members = useMembers();
  const write = useWrite();
  const [announce, setAnnounce] = useState('');
  const items = backlog.data?.data ?? [];
  const move = (index: number, direction: -1 | 1): void => {
    const item = items[index];
    if (item === undefined) return;
    const beforeKey = direction === -1 ? items[index - 1]?.key ?? null : items[index + 2]?.key ?? null;
    write.mutate({ method: 'POST', path: `/projects/${cle}/work-items/${item.key}/actions/rank`, body: { beforeKey } }, { onSuccess: () => setAnnounce(`${item.key} déplacé ${direction === -1 ? 'vers le haut' : 'vers le bas'}.`) });
  };
  return (
    <>
      <p className="fr-text--sm fr-mb-1w"><Link to="/">Projets</Link> › <Link to="/projets/$cle" params={{ cle }}>{cle}</Link> › Backlog</p>
      <h1>Backlog {cle}</h1>
      <p aria-live="polite" className="fr-sr-only">{announce}</p>
      <CreationRapide projectKey={cle} types={types.data?.data ?? []} items={items} />
      <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--middle">
        <div className="fr-col-12 fr-col-md-6"><Input label="Filtrer (recherche plein texte)" nativeInputProps={{ value: text, type: 'search', onChange: (event) => setText(event.target.value) }} /></div>
        <div className="fr-col-12 fr-col-md-6"><ToggleSwitch label="Afficher les éléments terminés" inputTitle="Afficher les éléments terminés" checked={includeDone} onChange={setIncludeDone} /></div>
      </div>
      <ErrorMessage error={backlog.error ?? write.error} />
      {backlog.isPending && <Loading />}
      {!backlog.isPending && items.length === 0 && <EmptyState message="Le backlog est vide. Ajoutez un premier élément avec le formulaire ci-dessus." />}
      {items.length > 0 && (
        <Table
          caption={`Backlog ordonné du projet ${cle}`}
          headers={['Rang', 'Clé', 'Titre', 'Type', 'État', 'Priorité', 'Estimation', 'Responsable', 'Ordre']}
          data={items.map((item, index) => [
            String(index + 1),
            item.key,
            <Link key="titre" to="/projets/$cle/elements/$element" params={{ cle, element: item.key }}>{item.title}</Link>,
            types.data?.data.find((type) => type.key === item.typeKey)?.name ?? item.typeKey,
            item.stateName,
            PRIORITY_LABELS[item.priority] ?? item.priority,
            item.estimate === null ? '—' : String(item.estimate),
            members.data?.data.find((member) => member.id === item.assigneeId)?.displayName ?? '—',
            <ul key="ordre" className="fr-btns-group fr-btns-group--inline fr-btns-group--sm">
              <li><Button size="small" priority="tertiary" iconId="fr-icon-arrow-up-line" title={`Monter ${item.key}`} disabled={index === 0} onClick={() => move(index, -1)} /></li>
              <li><Button size="small" priority="tertiary" iconId="fr-icon-arrow-down-line" title={`Descendre ${item.key}`} disabled={index === items.length - 1} onClick={() => move(index, 1)} /></li>
            </ul>,
          ])}
        />
      )}
    </>
  );
}
