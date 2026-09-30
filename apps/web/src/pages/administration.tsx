/**
 * Administration de l'organisation (utilisateurs, invitations, rôles d'organisation), audit,
 * recherche globale et pages légales.
 *
 * Couche : interface (pages). Règles : RI-HAB-02 (actions R3), RG-IAM-005, RG-ORG-001, RI-AUD-02,
 * RI-DSF-07 (pages légales), RI-ACC-11.
 */
import { Alert, Button, Input, Select, Table } from '@pajavamba/ui';
import { Link } from '@tanstack/react-router';
import { useState, type SubmitEvent, type ReactNode } from 'react';
import type { Page } from '../adaptateurs/api.ts';
import { useMembers, useResource, useWrite } from '../adaptateurs/requetes.ts';
import { formatDate, ROLE_LABELS, type ItemSummary, type Member } from '../domaine/modeles.ts';
import { ConfirmButton, EmptyState, ErrorMessage, Loading } from '../composants/retours.tsx';
import { Field } from './acces.tsx';

/**
 * Formulaire d'invitation ; le lien n'est affiché qu'une fois.
 * @returns élément React
 */
function Invitation(): ReactNode {
  const invite = useWrite<{ readonly invitationCode: string }>();
  const [form, setForm] = useState({ email: '', displayName: '', orgRole: 'member' });
  const submit = (event: SubmitEvent<HTMLFormElement>): void => { event.preventDefault(); invite.mutate({ method: 'POST', path: '/users', body: form }); };
  const link = invite.data === undefined ? '' : window.location.origin + '/invitation?code=' + invite.data.invitationCode;
  return (
    <>
      <h2>Inviter une personne</h2>
      <ErrorMessage error={invite.error} />
      {invite.data !== undefined && <Alert severity="success" title="Invitation créée" description={<p>Transmettez ce lien à la personne (valable 72 heures, affiché une seule fois) : <code>{link}</code></p>} />}
      <form onSubmit={submit} className="fr-col-md-8">
        <Field label="Adresse électronique" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
        <Field label="Nom affiché" value={form.displayName} onChange={(displayName) => setForm({ ...form, displayName })} />
        <Select label="Rôle d’organisation (obligatoire)" nativeSelectProps={{ value: form.orgRole, onChange: (event) => setForm({ ...form, orgRole: event.target.value }) }}>
          <option value="member">Membre</option><option value="auditor">Auditeur</option><option value="admin">Administrateur</option>
        </Select>
        <Button type="submit">Inviter</Button>
      </form>
    </>
  );
}

/**
 * Page d'administration.
 * @returns élément React
 */
export function AdministrationPage(): ReactNode {
  const members = useMembers();
  const write = useWrite();
  const toggle = (member: Member): ReactNode => (member.status === 'deactivated'
    ? <Button key={member.id} size="small" priority="secondary" onClick={() => write.mutate({ method: 'POST', path: `/users/${member.id}/actions/reactivate` })}>Réactiver</Button>
    : <ConfirmButton key={member.id} label="Désactiver" subject={member.displayName + ' (sessions et clé révoquées immédiatement)'} onConfirm={() => write.mutate({ method: 'POST', path: `/users/${member.id}/actions/deactivate` })} />);
  return (
    <>
      <h1>Administration de l’organisation</h1>
      <p className="fr-text--sm">Ces actions sont sensibles (R3) : vérifiez votre MFA depuis <Link to="/profil">Mon profil</Link> dans les 15 minutes qui précèdent.</p>
      <ErrorMessage error={members.error ?? write.error} />
      <Table caption="Membres de l’organisation" headers={['Nom', 'Adresse', 'Rôle', 'Statut', 'Action']} data={(members.data?.data ?? []).map((member) => [member.displayName, member.email, ROLE_LABELS[member.orgRole] ?? member.orgRole, member.status, toggle(member)])} />
      <Invitation />
    </>
  );
}

/**
 * Résumé de la vérification de la chaîne d'audit.
 * @param result nombre d'entrées et première entrée invalide
 * @returns texte
 */
function describeVerification(result: { readonly entries: number; readonly firstInvalidSeq: number | null }): string {
  const invalid = result.firstInvalidSeq === null ? '' : ' ; première entrée invalide : ' + String(result.firstInvalidSeq);
  return `${String(result.entries)} entrées vérifiées${invalid}.`;
}

interface AuditEntry {
  readonly seq: number;
  readonly occurredAt: string;
  readonly actorId: string | null;
  readonly channel: string;
  readonly action: string;
  readonly resourceType: string;
  readonly decision: string;
  readonly changedFields: readonly string[];
}

/**
 * Page du journal d'audit (auditeur).
 * @returns élément React
 */
export function AuditPage(): ReactNode {
  const entries = useResource<Page<AuditEntry>>(['audit'], '/audit');
  const verification = useResource<{ readonly entries: number; readonly intact: boolean; readonly firstInvalidSeq: number | null }>(['audit-verification'], '/audit/verification');
  return (
    <>
      <h1>Journal d’audit</h1>
      <ErrorMessage error={entries.error} />
      {verification.data !== undefined && (
        <Alert severity={verification.data.intact ? 'success' : 'error'} small title={verification.data.intact ? 'Chaîne intègre' : 'Chaîne altérée'} description={describeVerification(verification.data)} />
      )}
      <Table caption="Entrées les plus récentes" headers={['N°', 'Date', 'Action', 'Ressource', 'Canal', 'Décision', 'Champs modifiés']} data={(entries.data?.data ?? []).map((entry) => [String(entry.seq), formatDate(entry.occurredAt), entry.action, entry.resourceType, entry.channel, entry.decision === 'allow' ? 'Autorisée' : 'Refusée', entry.changedFields.join(', ') || '—'])} />
    </>
  );
}

/**
 * Page de recherche plein texte.
 * @returns élément React
 */
export function RecherchePage(): ReactNode {
  const [text, setText] = useState(new URLSearchParams(window.location.search).get('q') ?? '');
  const [submitted, setSubmitted] = useState(text);
  const results = useResource<Page<ItemSummary>>(['search', submitted], `/search?q=${encodeURIComponent(submitted)}`, submitted.trim() !== '');
  return (
    <>
      <h1>Recherche</h1>
      <form role="search" onSubmit={(event) => { event.preventDefault(); setSubmitted(text); }} className="fr-grid-row fr-grid-row--bottom fr-grid-row--gutters">
        <div className="fr-col-12 fr-col-md-8"><Input label="Rechercher dans les éléments" hintText="Recherche plein texte en français (clé ou mots du titre)" nativeInputProps={{ type: 'search', value: text, onChange: (event) => setText(event.target.value) }} /></div>
        <div className="fr-col-12 fr-col-md-4"><Button type="submit" iconId="fr-icon-search-line">Rechercher</Button></div>
      </form>
      <ErrorMessage error={results.error} />
      {results.isFetching && <Loading />}
      {results.data?.data.length === 0 && <EmptyState message="Aucun élément ne correspond à votre recherche." />}
      {(results.data?.data.length ?? 0) > 0 && (
        <Table caption={`Résultats pour « ${submitted} »`} headers={['Clé', 'Titre', 'Projet', 'État']} data={(results.data?.data ?? []).map((item) => [item.key, <Link key={item.key} to="/projets/$cle/elements/$element" params={{ cle: item.projectKey, element: item.key }}>{item.title}</Link>, item.projectKey, item.stateName])} />
      )}
    </>
  );
}

/**
 * Pages légales (contenu de recette, à compléter par l'exploitant).
 * @param props page demandée
 * @returns élément React
 */
export function PageLegale(props: Readonly<{ page: 'accessibilite' | 'mentions' | 'donnees' }>): ReactNode {
  if (props.page === 'accessibilite') {
    return (
      <>
        <h1>Déclaration d’accessibilité</h1>
        <p>PajaVamba vise la conformité au RGAA 4.1.2. État de conformité de cette version de recette : <strong>non conforme</strong> (audit prévu avant la version 1.0).</p>
        <p>Dispositions déjà en place : navigation au clavier, liens d’évitement, alternative « Déplacer vers… » au glisser-déposer du board, tableaux de données, thèmes clair et sombre.</p>
      </>
    );
  }
  if (props.page === 'mentions') {
    return <><h1>Mentions légales</h1><p>Instance de recette de PajaVamba, logiciel libre. Éditeur et hébergeur à renseigner par l’exploitant de l’instance.</p></>;
  }
  return (
    <>
      <h1>Données personnelles</h1>
      <p>Seules les données nécessaires sont traitées (adresse électronique, nom affiché, attributions, traces d’audit). Aucun cookie tiers : seul le cookie de session strictement nécessaire est déposé. Aucune donnée n’est transmise à un fournisseur d’intelligence artificielle dans cette version.</p>
    </>
  );
}
