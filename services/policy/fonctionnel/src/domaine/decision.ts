/**
 * Décision d'autorisation : attributions, refus explicites, niveaux de risque et moyen d'authentification.
 *
 * Couche : basse (policy/fonctionnel). Règles : RG-IAM-002 (le refus explicite prévaut),
 * RG-IAM-003 (R3 uniquement depuis l'interface avec MFA récente), RI-HAB-02, RI-CNX-03,
 * §8.4 (clé en lecture seule limitée aux lectures).
 */
import type { AccessDecision, AccessRequest, Credential, ExecutionContext } from '@pajavamba/kernel';

/** Attribution applicable à l'acteur. */
export interface EffectiveGrant {
  readonly permission: string;
  readonly effect: 'allow' | 'deny';
}

/** Âge maximal de la MFA pour une action R3 : 15 minutes (§8.3). */
export const RECENT_MFA_MAX_AGE_MS = 900_000;

/**
 * Vérifie les exigences liées au moyen d'authentification.
 * @param context contexte d'exécution
 * @param request demande
 * @param now instant courant
 * @returns refus éventuel
 */
function credentialDenial(context: ExecutionContext, request: AccessRequest, now: number): AccessDecision | undefined {
  const credential: Credential = context.credential;
  if (request.risk === 'R3') {
    const recentMfa = credential.kind === 'session' && credential.mfaVerifiedAt !== null && now - credential.mfaVerifiedAt <= RECENT_MFA_MAX_AGE_MS;
    if (context.channel !== 'ui' || !recentMfa) {
      return { allowed: false, reason: 'r3_requires_ui_mfa' };
    }
  }
  if (credential.kind === 'api_key' && credential.readOnly && request.risk !== 'R0') {
    return { allowed: false, reason: 'read_only_credential' };
  }
  return undefined;
}

/**
 * Décide si l'acteur peut exécuter l'action demandée.
 * @param context contexte d'exécution
 * @param request permission, niveau de risque et portée
 * @param state attributions applicables (organisation et projet) et instant courant
 * @returns décision
 */
export function decide(context: ExecutionContext, request: AccessRequest, state: { readonly grants: readonly EffectiveGrant[]; readonly now: number }): AccessDecision {
  const { grants, now } = state;
  if (context.actor.kind === 'system') {
    return { allowed: true };
  }
  const denial = credentialDenial(context, request, now);
  if (denial !== undefined) {
    return denial;
  }
  const matching = grants.filter((grant) => grant.permission === request.permission);
  if (matching.some((grant) => grant.effect === 'deny')) {
    return { allowed: false, reason: 'explicit_deny' };
  }
  return matching.some((grant) => grant.effect === 'allow') ? { allowed: true } : { allowed: false, reason: 'no_grant' };
}
