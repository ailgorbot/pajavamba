/**
 * Pages d'accès : connexion (avec code MFA si nécessaire), initialisation de l'instance,
 * acceptation d'une invitation.
 *
 * Couche : interface (pages). Règles : RI-ACC-08 (étiquettes visibles, champs obligatoires
 * signalés, erreurs reliées), RI-CNX-09 (message d'échec uniforme), RI-SCR-07.
 */
import { Button, Input } from '@pajavamba/ui';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent, type ReactNode } from 'react';
import { ApiError, setCsrfToken } from '../adaptateurs/api.ts';
import { useWrite } from '../adaptateurs/requetes.ts';
import { ErrorMessage } from '../composants/retours.tsx';

/**
 * Champ de formulaire contrôlé.
 * @param props libellé, valeur, type, aide
 * @returns élément React
 */
export function Field(props: { readonly label: string; readonly value: string; readonly type?: string; readonly hint?: string; readonly required?: boolean; readonly autoComplete?: string; onChange(value: string): void }): ReactNode {
  return (
    <Input
      label={`${props.label}${props.required === false ? '' : ' (obligatoire)'}`}
      hintText={props.hint}
      nativeInputProps={{ value: props.value, type: props.type ?? 'text', required: props.required !== false, autoComplete: props.autoComplete ?? 'off', onChange: (event) => props.onChange(event.target.value) }}
    />
  );
}

/**
 * Page de connexion.
 * @returns élément React
 */
export function ConnexionPage(): ReactNode {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  const write = useWrite<{ readonly csrfToken: string }>();
  const navigate = useNavigate();
  const client = useQueryClient();
  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    write.mutate({ method: 'POST', path: '/sessions', body: { email, password, ...(needsMfa ? { totpCode } : {}) } }, {
      onSuccess: async (result) => {
        setCsrfToken(result.csrfToken);
        await client.invalidateQueries();
        void navigate({ to: '/' });
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'identity.mfa_required') setNeedsMfa(true);
      },
    });
  };
  return (
    <div className="fr-grid-row fr-grid-row--center">
      <div className="fr-col-12 fr-col-md-6">
        <h1>Connexion à PajaVamba</h1>
        {!(write.error instanceof ApiError && write.error.code === 'identity.mfa_required') && <ErrorMessage error={write.error} />}
        <form onSubmit={submit} noValidate={false}>
          <div>
            <Field label="Adresse électronique" type="email" autoComplete="username" value={email} onChange={setEmail} />
            <Field label="Mot de passe" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
            {needsMfa && <Field label="Code à usage unique" hint="Code à 6 chiffres de votre application d'authentification" autoComplete="one-time-code" value={totpCode} onChange={setTotpCode} />}
          </div>
          <Button type="submit" disabled={write.isPending}>Se connecter</Button>
        </form>
      </div>
    </div>
  );
}

/**
 * Page d'initialisation de l'instance (création de l'organisation et du propriétaire).
 * @returns élément React
 */
export function InitialisationPage(): ReactNode {
  const [form, setForm] = useState({ setupCode: '', organisationName: '', organisationSlug: '', email: '', displayName: '', password: '' });
  const write = useWrite();
  const navigate = useNavigate();
  const client = useQueryClient();
  const set = (name: keyof typeof form) => (value: string): void => setForm({ ...form, [name]: value });
  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    write.mutate({ method: 'POST', path: '/setup', body: form }, { onSuccess: async () => { await client.invalidateQueries(); void navigate({ to: '/connexion' }); } });
  };
  return (
    <div className="fr-grid-row fr-grid-row--center">
      <div className="fr-col-12 fr-col-md-8">
        <h1>Initialiser l’instance</h1>
        <p>Le code d’initialisation a été généré à l’installation, dans le fichier de secrets <code>setup_code</code> du serveur (aucun secret par défaut).</p>
        <ErrorMessage error={write.error} />
        <form onSubmit={submit}>
          <Field label="Code d’initialisation" type="password" value={form.setupCode} onChange={set('setupCode')} />
          <Field label="Nom de l’organisation" value={form.organisationName} onChange={set('organisationName')} />
          <Field label="Identifiant de l’organisation" hint="3 à 40 caractères : lettres minuscules, chiffres et tirets" value={form.organisationSlug} onChange={set('organisationSlug')} />
          <Field label="Votre adresse électronique" type="email" autoComplete="username" value={form.email} onChange={set('email')} />
          <Field label="Votre nom affiché" value={form.displayName} onChange={set('displayName')} />
          <Field label="Mot de passe" type="password" autoComplete="new-password" hint="12 caractères minimum ; évitez les mots de passe courants" value={form.password} onChange={set('password')} />
          <Button type="submit" disabled={write.isPending}>Créer l’organisation et le compte propriétaire</Button>
        </form>
      </div>
    </div>
  );
}

/**
 * Page d'acceptation d'une invitation.
 * @returns élément React
 */
export function InvitationPage(): ReactNode {
  const code = new URLSearchParams(window.location.search).get('code') ?? '';
  const [password, setPassword] = useState('');
  const write = useWrite();
  const navigate = useNavigate();
  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    write.mutate({ method: 'POST', path: '/invitations/accept', body: { code, password } }, { onSuccess: () => void navigate({ to: '/connexion' }) });
  };
  return (
    <div className="fr-grid-row fr-grid-row--center">
      <div className="fr-col-12 fr-col-md-6">
        <h1>Accepter l’invitation</h1>
        <ErrorMessage error={write.error} />
        <form onSubmit={submit}>
          <Field label="Choisissez votre mot de passe" type="password" autoComplete="new-password" hint="12 caractères minimum" value={password} onChange={setPassword} />
          <Button type="submit" disabled={write.isPending || code === ''}>Activer mon compte</Button>
        </form>
      </div>
    </div>
  );
}
