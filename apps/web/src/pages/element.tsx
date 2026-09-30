/**
 * Détail d'un élément : édition (verrouillage optimiste), transitions, assignation, commentaires,
 * sous-éléments, historique, corbeille.
 *
 * Couche : interface (pages). Règles : RI-API-05 (If-Match), RG-WI-005, RG-WI-008, RI-ERG-02,
 * RI-ACC-08, RI-SEC-06 (texte affiché sans interprétation HTML).
 */
import { Button, Input, Select, Table } from '@pajavamba/ui';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useState, type SubmitEvent, type ReactNode } from 'react';
import { useItem, useMembers, useWrite } from '../adaptateurs/requetes.ts';
import { CATEGORY_LABELS, formatDate, PRIORITY_LABELS, type ItemDetail } from '../domaine/modeles.ts';
import { ConfirmButton, ErrorMessage, Loading } from '../composants/retours.tsx';

/**
 * Formulaire d'édition d'un élément.
 * @param props projet et élément
 * @returns élément React
 */
function Edition(props: { readonly projectKey: string; readonly item: ItemDetail }): ReactNode {
  const { item } = props;
  const write = useWrite();
  const [form, setForm] = useState({ title: item.title, description: item.description, acceptanceCriteria: item.acceptanceCriteria, priority: item.priority, estimate: item.estimate === null ? '' : String(item.estimate), confidentiality: item.confidentiality });
  useEffect(() => {
    setForm({ title: item.title, description: item.description, acceptanceCriteria: item.acceptanceCriteria, priority: item.priority, estimate: item.estimate === null ? '' : String(item.estimate), confidentiality: item.confidentiality });
  }, [item]);
  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    write.mutate({ method: 'PATCH', path: `/projects/${props.projectKey}/work-items/${item.key}`, ifMatch: item.version, body: { ...form, estimate: form.estimate === '' ? null : Number(form.estimate.replace(',', '.')) } });
  };
  return (
    <form onSubmit={submit} aria-label="Modifier l’élément">
      <ErrorMessage error={write.error} />
      <Input label="Titre (obligatoire)" nativeInputProps={{ value: form.title, required: true, maxLength: 255, onChange: (event) => setForm({ ...form, title: event.target.value }) }} />
      <Input label="Description (Markdown)" textArea nativeTextAreaProps={{ value: form.description, rows: 6, onChange: (event) => setForm({ ...form, description: event.target.value }) }} />
      <Input label="Critères d’acceptation (Gherkin ou Markdown)" textArea nativeTextAreaProps={{ value: form.acceptanceCriteria, rows: 5, onChange: (event) => setForm({ ...form, acceptanceCriteria: event.target.value }) }} />
      <div className="fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-12 fr-col-md-4">
          <Select label="Priorité" nativeSelectProps={{ value: form.priority, onChange: (event) => setForm({ ...form, priority: event.target.value }) }}>
            {Object.entries(PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Select>
        </div>
        <div className="fr-col-12 fr-col-md-4"><Input label="Estimation" nativeInputProps={{ value: form.estimate, inputMode: 'decimal', onChange: (event) => setForm({ ...form, estimate: event.target.value }) }} /></div>
        <div className="fr-col-12 fr-col-md-4">
          <Select label="Confidentialité" nativeSelectProps={{ value: form.confidentiality, onChange: (event) => setForm({ ...form, confidentiality: event.target.value === 'restricted' ? 'restricted' : 'normal' }) }}>
            <option value="normal">Normale</option><option value="restricted">Confidentiel</option>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={write.isPending}>Enregistrer</Button>
    </form>
  );
}

/**
 * Panneau latéral : état, transitions, assignation, corbeille.
 * @param props projet et élément
 * @returns élément React
 */
function Pilotage(props: { readonly projectKey: string; readonly item: ItemDetail }): ReactNode {
  const { item } = props;
  const write = useWrite();
  const members = useMembers();
  const navigate = useNavigate();
  const base = `/projects/${props.projectKey}/work-items/${item.key}`;
  const state = item.states.find((candidate) => candidate.key === item.stateKey);
  return (
    <aside aria-label="Pilotage de l’élément">
      <ErrorMessage error={write.error} />
      <p><strong>État :</strong> {state?.name ?? item.stateKey} ({CATEGORY_LABELS[item.stateCategory] ?? item.stateCategory})</p>
      <h2 className="fr-h6">Changer d’état</h2>
      <ul className="fr-btns-group fr-btns-group--sm">
        {item.transitions.map((transition) => (
          <li key={transition.key}><Button priority="secondary" size="small" onClick={() => write.mutate({ method: 'POST', path: `${base}/actions/transition`, body: { toState: transition.to } })}>{transition.name}</Button></li>
        ))}
      </ul>
      <Select label="Responsable" nativeSelectProps={{ value: item.assigneeId ?? '', onChange: (event) => write.mutate({ method: 'POST', path: `${base}/actions/assign`, body: { assigneeId: event.target.value === '' ? null : event.target.value } }) }}>
        <option value="">Non assigné</option>
        {(members.data?.data ?? []).map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
      </Select>
      <p className="fr-text--sm">Créé le {formatDate(item.createdAt)} · version {item.version}</p>
      <ConfirmButton label="Mettre à la corbeille" subject={`l’élément ${item.key} (restaurable 30 jours)`} onConfirm={() => write.mutate({ method: 'DELETE', path: base, ifMatch: item.version }, { onSuccess: () => void navigate({ to: '/projets/$cle/backlog', params: { cle: props.projectKey } }) })} />
    </aside>
  );
}

/**
 * Commentaires d'un élément.
 * @param props projet et élément
 * @returns élément React
 */
function Commentaires(props: { readonly projectKey: string; readonly item: ItemDetail }): ReactNode {
  const write = useWrite();
  const members = useMembers();
  const [body, setBody] = useState('');
  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    write.mutate({ method: 'POST', path: `/projects/${props.projectKey}/work-items/${props.item.key}/comments`, body: { body } }, { onSuccess: () => setBody('') });
  };
  return (
    <section aria-labelledby="commentaires" className="fr-mt-4w">
      <h2 id="commentaires">Commentaires</h2>
      {props.item.comments.length === 0 && <p>Aucun commentaire.</p>}
      <ul className="fr-raw-list">
        {props.item.comments.map((comment) => (
          <li key={comment.id} className="pv-card fr-p-2w fr-mb-2w">
            <p className="fr-text--sm fr-mb-1w">{members.data?.data.find((member) => member.id === comment.authorId)?.displayName ?? 'Personne'} — {formatDate(comment.createdAt)}</p>
            <p className="fr-mb-0">{comment.body}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={submit}>
        <ErrorMessage error={write.error} />
        <Input label="Nouveau commentaire" textArea nativeTextAreaProps={{ value: body, rows: 3, maxLength: 20_000, onChange: (event) => setBody(event.target.value) }} />
        <Button type="submit" disabled={body.trim() === ''}>Commenter</Button>
      </form>
    </section>
  );
}

/**
 * Page de détail d'un élément.
 * @returns élément React
 */
export function ElementPage(): ReactNode {
  const { cle = '', element = '' } = useParams({ strict: false });
  const item = useItem(cle, element);
  if (item.isPending) return <Loading />;
  if (item.data === undefined) return <ErrorMessage error={item.error} />;
  const data = item.data;
  return (
    <>
      <p className="fr-text--sm fr-mb-1w"><Link to="/">Projets</Link> › <Link to="/projets/$cle" params={{ cle }}>{cle}</Link> › <Link to="/projets/$cle/backlog" params={{ cle }}>Backlog</Link> › {data.key}</p>
      <h1>{data.key} — {data.title}</h1>
      <p className="fr-text--sm">{data.type?.name ?? data.typeKey}{data.confidentiality === 'restricted' ? ' · confidentiel' : ''}</p>
      <div className="fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-12 fr-col-md-8">
          <Edition projectKey={cle} item={data} />
          {data.children.length > 0 && (
            <Table caption="Sous-éléments" headers={['Clé', 'Titre', 'Catégorie']} data={data.children.map((child) => [child.key, <Link key={child.key} to="/projets/$cle/elements/$element" params={{ cle, element: child.key }}>{child.title}</Link>, CATEGORY_LABELS[child.stateCategory] ?? child.stateCategory])} />
          )}
          <Commentaires projectKey={cle} item={data} />
          <Table caption="Historique" headers={['Date', 'Action', 'Champs modifiés']} data={data.history.map((entry) => [formatDate(entry.occurredAt), entry.action, Object.keys(entry.changes).join(', ') || '—'])} />
        </div>
        <div className="fr-col-12 fr-col-md-4"><Pilotage projectKey={cle} item={data} /></div>
      </div>
    </>
  );
}
