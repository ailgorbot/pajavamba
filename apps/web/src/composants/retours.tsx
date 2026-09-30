/**
 * Composants de retour : erreur de l'API, chargement, état vide, confirmation d'une action
 * irréversible.
 *
 * Couche : interface (composants). Règles : RI-ERG-04 (ce qui s'est passé, comment corriger, code,
 * lien vers la documentation), RI-ERG-02 (confirmation explicite rappelant l'objet), RI-ERG-05
 * (états vides expliqués), RI-ACC-07 (annonces sobres `aria-live`).
 */
import { Alert, Button } from '@pajavamba/ui';
import { useState, type ReactNode } from 'react';
import { ApiError } from '../adaptateurs/api.ts';

const DOC_BASE = 'https://ailgorbot.github.io/pajavamba/reference/erreurs/';

/**
 * Affiche une erreur de façon compréhensible.
 * @param props erreur
 * @returns élément React ou rien
 */
export function ErrorMessage(props: { readonly error: unknown }): ReactNode {
  if (props.error === null || props.error === undefined) return null;
  const error = props.error instanceof ApiError ? props.error : undefined;
  const description = (
    <>
      <p>{error?.detail ?? 'Une erreur inattendue est survenue. Réessayez.'}</p>
      {error !== undefined && error.fieldErrors.length > 0 && (
        <ul>{error.fieldErrors.map((field) => <li key={field.pointer}>{field.pointer.replace('/', '')} : {field.message}</li>)}</ul>
      )}
      {error !== undefined && <p className="fr-text--sm fr-mb-0">Code : <a href={`${DOC_BASE}${error.code}`} target="_blank" rel="noreferrer">{error.code}</a></p>}
    </>
  );
  return <div role="alert" className="fr-mb-3w"><Alert severity="error" small={false} title={error?.title ?? 'Erreur'} description={description} /></div>;
}

/**
 * Indicateur de chargement annoncé aux technologies d'assistance.
 * @returns élément React
 */
export function Loading(): ReactNode {
  return <p aria-live="polite" className="fr-text--sm">Chargement…</p>;
}

/**
 * État vide : explication et action principale.
 * @param props texte et action
 * @returns élément React
 */
export function EmptyState(props: { readonly message: string; readonly action?: ReactNode }): ReactNode {
  return (
    <div className="fr-callout fr-my-3w">
      <p className="fr-callout__text">{props.message}</p>
      {props.action}
    </div>
  );
}

/**
 * Bouton d'action irréversible : une seconde étape de confirmation rappelle l'objet.
 * @param props libellé, objet concerné, action
 * @returns élément React
 */
export function ConfirmButton(props: { readonly label: string; readonly subject: string; readonly disabled?: boolean; onConfirm(): void }): ReactNode {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <Button priority="secondary" disabled={props.disabled === true} onClick={() => setAsking(true)}>{props.label}</Button>;
  }
  return (
    <div role="group" aria-label={`Confirmer : ${props.label}`} className="fr-p-2w pv-card">
      <p className="fr-mb-1w">Confirmez-vous « {props.label} » pour {props.subject} ?</p>
      <ul className="fr-btns-group fr-btns-group--inline fr-btns-group--sm">
        <li><Button onClick={() => { setAsking(false); props.onConfirm(); }}>Confirmer</Button></li>
        <li><Button priority="secondary" onClick={() => setAsking(false)}>Annuler</Button></li>
      </ul>
    </div>
  );
}
