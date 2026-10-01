#!/bin/sh
# Sentinelles de la story L0-13 : chaque contrôle doit refuser un exemple fautif écrit à la volée.
# Couches (dependency-cruiser), constructions interdites et seuils (ESLint). Échoue si un contrôle laisse passer.
set -u
DOSSIER=services/identity/fonctionnel/src
COUCHES=$DOSSIER/sentinelle-couches.ts
INTERDITS=$DOSSIER/sentinelle-interdits.ts
SEUILS=$DOSSIER/sentinelle-seuils.ts
trap 'rm -f "$COUCHES" "$INTERDITS" "$SEUILS"' EXIT
echo_erreur() { echo "::error::$1"; exit 1; }

printf "import { createIdentityService } from '@pajavamba/identity-structure';\nexport const sentinelle = createIdentityService;\n" > "$COUCHES"
if ! pnpm exec depcruise --config .dependency-cruiser.cjs "$DOSSIER" | grep -q "fonctionnel-vers-structure"; then
  echo_erreur "dependency-cruiser a laissé la couche fonctionnelle importer la couche moyenne"
fi
rm -f "$COUCHES"

printf "export const valeur: any = 1;\nexport enum Couleur { Rouge }\nexport default valeur;\n" > "$INTERDITS"
for regle in no-explicit-any 'enum interdit' 'export default interdit'; do
  if ! pnpm exec eslint "$INTERDITS" | grep -q "$regle"; then
    echo_erreur "ESLint n'a pas refusé : $regle"
  fi
done

node -e 'const l=["export function longue(): number {","  let total = 0;"];for(let i=0;i<27;i++)l.push("  total += "+i+";");l.push("  return total;","}");process.stdout.write(l.join("\n")+"\n")' > "$SEUILS"
if ! pnpm exec eslint "$SEUILS" | grep -q "max-lines-per-function"; then
  echo_erreur "ESLint a accepté une fonction de 31 lignes"
fi
echo "Sentinelles qualité : les trois contrôles refusent bien les exemples fautifs."
