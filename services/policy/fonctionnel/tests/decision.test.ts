/**
 * Tests de la décision d'autorisation.
 *
 * Couche : basse (policy). Règles vérifiées : RG-IAM-002, RG-IAM-003, RI-HAB-02, RI-SEC-02.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { toEntityId, type Credential, type ExecutionContext } from '@pajavamba/kernel';
import { decide, RECENT_MFA_MAX_AGE_MS, type EffectiveGrant } from '../src/index.ts';

const NOW = 1_800_000_000_000;

function contextWith(credential: Credential, channel: ExecutionContext['channel'] = 'ui'): ExecutionContext {
  return {
    organisationId: toEntityId('0192f7c4-0000-7000-8000-000000000001'),
    actor: { kind: 'user', userId: toEntityId('0192f7c4-0000-7000-8000-000000000002') },
    channel,
    credential,
    correlationId: toEntityId('0192f7c4-0000-7000-8000-000000000003'),
  };
}

const SESSION: Credential = { kind: 'session', mfaVerifiedAt: null };

describe('décision d’autorisation', () => {
  it('étant donné une attribution, quand la permission est demandée, alors l’accès est accordé', () => {
    const grants: EffectiveGrant[] = [{ permission: 'project:read', effect: 'allow' }];
    expect(decide(contextWith(SESSION), { permission: 'project:read', risk: 'R0' }, grants, NOW)).toEqual({ allowed: true });
  });

  it('étant donné aucune attribution, quand la permission est demandée, alors l’accès est refusé', () => {
    expect(decide(contextWith(SESSION), { permission: 'project:read', risk: 'R0' }, [], NOW)).toEqual({ allowed: false, reason: 'no_grant' });
  });

  it('étant donné un refus explicite et une autorisation, quel que soit l’ordre, alors le refus prévaut (RG-IAM-002)', () => {
    fc.assert(
      fc.property(fc.shuffledSubarray([{ permission: 'work_item:update', effect: 'allow' as const }, { permission: 'work_item:update', effect: 'deny' as const }], { minLength: 2 }), (grants) => {
        expect(decide(contextWith(SESSION), { permission: 'work_item:update', risk: 'R1' }, grants, NOW)).toEqual({ allowed: false, reason: 'explicit_deny' });
      }),
    );
  });

  it('étant donné une action R3 sans MFA récente, quand elle est demandée, alors elle est refusée (RG-IAM-003)', () => {
    const grants: EffectiveGrant[] = [{ permission: 'role:manage', effect: 'allow' }];
    const stale: Credential = { kind: 'session', mfaVerifiedAt: NOW - RECENT_MFA_MAX_AGE_MS - 1 };
    expect(decide(contextWith(stale), { permission: 'role:manage', risk: 'R3' }, grants, NOW)).toEqual({ allowed: false, reason: 'r3_requires_ui_mfa' });
  });

  it('étant donné une action R3 avec MFA récente depuis l’interface, alors elle est accordée', () => {
    const grants: EffectiveGrant[] = [{ permission: 'role:manage', effect: 'allow' }];
    const fresh: Credential = { kind: 'session', mfaVerifiedAt: NOW - 1_000 };
    expect(decide(contextWith(fresh), { permission: 'role:manage', risk: 'R3' }, grants, NOW)).toEqual({ allowed: true });
  });

  it('étant donné une clé API, quand une action R3 est demandée, alors elle est refusée (RI-HAB-02)', () => {
    const grants: EffectiveGrant[] = [{ permission: 'project:delete', effect: 'allow' }];
    const key: Credential = { kind: 'api_key', readOnly: false };
    expect(decide(contextWith(key, 'api'), { permission: 'project:delete', risk: 'R3' }, grants, NOW)).toEqual({ allowed: false, reason: 'r3_requires_ui_mfa' });
  });

  it('étant donné une clé en lecture seule, quand une écriture est demandée, alors elle est refusée', () => {
    const grants: EffectiveGrant[] = [{ permission: 'work_item:create', effect: 'allow' }];
    const key: Credential = { kind: 'api_key', readOnly: true };
    expect(decide(contextWith(key, 'api'), { permission: 'work_item:create', risk: 'R1' }, grants, NOW)).toEqual({ allowed: false, reason: 'read_only_credential' });
  });
});
