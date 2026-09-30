/**
 * Démarrage du système de design et réglage du thème (clair, sombre, système).
 *
 * Couche : présentation (`packages/ui`). Règles : RI-DSF-05 (thèmes via les paramètres
 * d'affichage du DSFR), RI-DSF-02 (import du DSFR confiné à la façade).
 */
import { startReactDsfr } from '@codegouvfr/react-dsfr/spa';
import { useIsDark } from '@codegouvfr/react-dsfr/useIsDark';
import type { ReactNode } from 'react';

/** Thème d'affichage. */
export type Theme = 'system' | 'light' | 'dark';

/**
 * Démarre le système de design (à appeler une fois, avant le rendu).
 */
export function startUi(): void {
  startReactDsfr({ defaultColorScheme: 'system' });
}

/**
 * Applique un thème d'affichage.
 * @returns fonction d'application du thème
 */
export function useApplyTheme(): (theme: Theme) => void {
  const { setIsDark } = useIsDark();
  return (theme) => {
    setIsDark(theme === 'system' ? 'system' : theme === 'dark');
  };
}

/** Propriétés du sélecteur de thème. */
export interface ThemeSelectorProps {
  readonly value: Theme;
  readonly onChange: (theme: Theme) => void;
}

const THEME_LABELS: Readonly<Record<Theme, string>> = { system: 'Système', light: 'Clair', dark: 'Sombre' };
const THEMES: readonly Theme[] = ['system', 'light', 'dark'];

/**
 * Sélecteur de thème compact (pied de page, profil).
 * @param props valeur et changement
 * @returns élément React
 */
export function ThemeSelector(props: Readonly<ThemeSelectorProps>): ReactNode {
  const apply = useApplyTheme();
  return (
    <div className="fr-select-group fr-mb-0">
      <label className="fr-label" htmlFor="pv-theme">Thème d’affichage</label>
      <select
        className="fr-select"
        id="pv-theme"
        value={props.value}
        onChange={(event) => {
          const theme = THEMES.find((candidate) => candidate === event.target.value) ?? 'system';
          apply(theme);
          props.onChange(theme);
        }}
      >
        {THEMES.map((theme) => <option key={theme} value={theme}>{THEME_LABELS[theme]}</option>)}
      </select>
    </div>
  );
}
