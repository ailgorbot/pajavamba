/**
 * Liste embarquée de mots de passe compromis ou triviaux (contrôle à la définition du mot de passe).
 *
 * Couche : moyenne (identity/structure). Règle : RI-CNX-02. Liste initiale volontairement courte,
 * limitée aux mots de passe d'au moins 12 caractères les plus fréquents des fuites publiques ;
 * son extension (ex. corpus complet) fera l'objet d'une story dédiée.
 */
const COMPROMISED = new Set([
  '123456789012',
  '1234567890123',
  '12345678910111',
  'qwertyuiop123',
  'qwertyuiopasdf',
  'azertyuiop123',
  'azertyuiopqsdf',
  'motdepasse123',
  'motdepasse1234',
  'password1234',
  'password12345',
  'passwordpassword',
  'iloveyou1234',
  'administrator',
  'administrateur',
  'bienvenue1234',
  'welcome12345',
  'letmein12345',
  'soleil123456',
  'football1234',
  '111111111111',
  '000000000000',
  'aaaaaaaaaaaa',
  'abcdefghijkl',
  'abc123456789',
  'pajavamba123',
  'pajavamba2026',
]);

/**
 * Indique si un mot de passe figure dans la liste (comparaison insensible à la casse).
 * @param password mot de passe proposé
 * @returns vrai s'il est compromis
 */
export function isCompromisedPassword(password: string): boolean {
  return COMPROMISED.has(password.toLowerCase());
}
