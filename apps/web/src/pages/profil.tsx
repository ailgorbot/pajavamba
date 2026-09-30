/**
 * Mon profil : nom, thème, sessions, MFA (enrôlement TOTP, vérification récente), clé API.
 *
 * Couche : interface (pages). Règles : RI-CNX-03 (MFA), RI-HAB-02 (actions R3 après MFA récente),
 * RI-SCR-03 (jeton et codes affichés une seule fois), RG-IAM-005.
 */
import { Alert, Button, CallOut, Table, ThemeSelector } from '@pajavamba/ui';
import { useState, type SubmitEvent, type ReactNode } from 'react';
import type { Page } from '../adaptateurs/api.ts';
import { useMe, useResource, useWrite } from '../adaptateurs/requetes.ts';
import { formatDate, type Me } from '../domaine/modeles.ts';
import { ConfirmButton, ErrorMessage, Loading } from '../composants/retours.tsx';
import { Field } from './acces.tsx';

/**
 * Enrôlement d'une application d'authentification (TOTP) et remise des codes de récupération.
 * @returns élément React
 */
function EnrolementTotp(): ReactNode {
  const start = useWrite<{ readonly otpauthUri: string; readonly secret: string }>();
  const confirm = useWrite<{ readonly recoveryCodes: readonly string[] }>();
  const [code, setCode] = useState('');
  if (confirm.data !== undefined) {
    return <Alert severity="success" title="Application d’authentification enrôlée" description={<><p>Conservez ces codes de récupération : ils ne seront plus jamais affichés.</p><ul>{confirm.data.recoveryCodes.map((recovery) => <li key={recovery}><code>{recovery}</code></li>)}</ul></>} />;
  }
  const submit = (event: SubmitEvent<HTMLFormElement>): void => { event.preventDefault(); confirm.mutate({ method: 'POST', path: '/me/mfa/totp/confirm', body: { code } }); };
  return (
    <>
      <ErrorMessage error={start.error ?? confirm.error} />
      {start.data === undefined
        ? <Button onClick={() => start.mutate({ method: 'POST', path: '/me/mfa/totp' })}>Activer une application d’authentification (TOTP)</Button>
        : (
          <form onSubmit={submit}>
            <CallOut title="Ajoutez le compte dans votre application">Saisissez la clé <code>{start.data.secret}</code> (type TOTP, 6 chiffres, 30 secondes) ou ouvrez <a href={start.data.otpauthUri}>ce lien otpauth</a> sur votre téléphone.</CallOut>
            <Field label="Code affiché par l’application" autoComplete="one-time-code" value={code} onChange={setCode} />
            <Button type="submit">Confirmer l’enrôlement</Button>
          </form>
        )}
    </>
  );
}

/**
 * Vérification MFA récente, exigée par les actions sensibles (R3).
 * @param props profil
 * @returns élément React
 */
function VerificationMfa(props: Readonly<{ me: Me }>): ReactNode {
  const verify = useWrite();
  const [code, setCode] = useState('');
  const submit = (event: SubmitEvent<HTMLFormElement>): void => { event.preventDefault(); verify.mutate({ method: 'POST', path: '/me/mfa/verify', body: { code } }, { onSuccess: () => setCode('') }); };
  return (
    <form onSubmit={submit}>
      <p>MFA activée. Dernière vérification : {formatDate(props.me.mfa.verifiedAt)}. Les actions sensibles (gestion des accès, clé API, suppression) exigent une vérification de moins de 15 minutes.</p>
      <ErrorMessage error={verify.error} />
      {verify.isSuccess && <p aria-live="polite" className="fr-valid-text">Vérification enregistrée.</p>}
      <Field label="Code à usage unique" autoComplete="one-time-code" value={code} onChange={setCode} />
      <Button type="submit">Vérifier maintenant</Button>
    </form>
  );
}

/**
 * Bloc MFA : enrôlement TOTP ou vérification récente.
 * @param props profil
 * @returns élément React
 */
function Mfa(props: Readonly<{ me: Me }>): ReactNode {
  return props.me.mfa.enrolled ? <VerificationMfa me={props.me} /> : <EnrolementTotp />;
}

/**
 * Bloc clé API personnelle.
 * @param props profil
 * @returns élément React
 */
function CleApi(props: Readonly<{ me: Me }>): ReactNode {
  const create = useWrite<{ readonly token: string }>();
  const revoke = useWrite();
  const [name, setName] = useState('Ma clé');
  const [readOnly, setReadOnly] = useState(true);
  const submit = (event: SubmitEvent<HTMLFormElement>): void => { event.preventDefault(); create.mutate({ method: 'POST', path: '/me/api-key', body: { name, readOnly } }); };
  return (
    <>
      <p>La clé s’utilise dans l’en-tête <code>Authorization: Bearer …</code> avec l’identifiant du projet dans l’URL ; elle n’encode aucun droit. Ne la saisissez jamais dans un outil tiers en ligne.</p>
      <ErrorMessage error={create.error ?? revoke.error} />
      {create.data !== undefined && <Alert severity="warning" title="Copiez votre clé maintenant" description={<p>Elle ne sera plus affichée : <code>{create.data.token}</code></p>} />}
      {props.me.apiKey !== null && <p>Clé active : <strong>{props.me.apiKey.name}</strong> ({props.me.apiKey.publicId}, {props.me.apiKey.readOnly ? 'lecture seule' : 'lecture et écriture'}), créée le {formatDate(props.me.apiKey.createdAt)}, dernier usage : {formatDate(props.me.apiKey.lastUsedAt)}.</p>}
      <form onSubmit={submit}>
        <Field label="Nom de la clé" value={name} onChange={setName} />
        <div className="fr-checkbox-group fr-mb-2w">
          <input type="checkbox" id="lecture-seule" checked={readOnly} onChange={(event) => setReadOnly(event.target.checked)} />
          <label className="fr-label" htmlFor="lecture-seule">Lecture seule</label>
        </div>
        <ul className="fr-btns-group fr-btns-group--inline">
          <li><Button type="submit">{props.me.apiKey === null ? 'Créer ma clé' : 'Régénérer ma clé'}</Button></li>
          {props.me.apiKey !== null && <li><ConfirmButton label="Révoquer ma clé" subject="votre clé API" onConfirm={() => revoke.mutate({ method: 'DELETE', path: '/me/api-key' })} /></li>}
        </ul>
      </form>
    </>
  );
}

/**
 * Page du profil.
 * @returns élément React
 */
export function ProfilPage(): ReactNode {
  const me = useMe();
  const sessions = useResource<Page<{ readonly id: string; readonly createdAt: string; readonly lastSeenAt: string; readonly mfa: boolean }>>(['sessions'], '/me/sessions');
  const write = useWrite();
  const [name, setName] = useState<string | null>(null);
  if (me.data === undefined || me.data === null) return <Loading />;
  const data = me.data;
  return (
    <>
      <h1>Mon profil</h1>
      <p>{data.user.email} — organisation {data.organisation.name}</p>
      <ErrorMessage error={write.error} />
      <form onSubmit={(event) => { event.preventDefault(); write.mutate({ method: 'PATCH', path: '/me', body: { displayName: name ?? data.user.displayName } }); }} className="fr-col-md-6">
        <Field label="Nom affiché" value={name ?? data.user.displayName} onChange={setName} />
        <Button type="submit">Enregistrer</Button>
      </form>
      <div className="fr-col-md-4 fr-mt-3w"><ThemeSelector value={data.user.theme} onChange={(theme) => write.mutate({ method: 'PATCH', path: '/me', body: { theme } })} /></div>
      <h2 className="fr-mt-4w">Authentification à plusieurs facteurs</h2>
      <Mfa me={data} />
      <h2 className="fr-mt-4w">Clé API personnelle</h2>
      <CleApi me={data} />
      <h2 className="fr-mt-4w">Mes sessions</h2>
      <Table caption="Sessions actives" headers={['Ouverture', 'Dernière activité', 'MFA', 'Action']} data={(sessions.data?.data ?? []).map((session) => [formatDate(session.createdAt), formatDate(session.lastSeenAt), session.mfa ? 'Oui' : 'Non', <Button key={session.id} size="small" priority="secondary" onClick={() => write.mutate({ method: 'DELETE', path: `/me/sessions/${session.id}` })}>Révoquer</Button>])} />
    </>
  );
}
