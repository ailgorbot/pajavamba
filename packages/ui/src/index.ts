/**
 * Façade de l'interface : seul point d'accès au DSFR pour l'application.
 *
 * Couche : présentation (`packages/ui`). Règles : RI-DSF-02 (aucun import direct du DSFR hors de
 * cette façade), RI-DSF-04 (composants DSFR en priorité), RI-ERG-01 (mêmes composants partout).
 */
export { Alert } from '@codegouvfr/react-dsfr/Alert';
export { Badge } from '@codegouvfr/react-dsfr/Badge';
export { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb';
export { Button } from '@codegouvfr/react-dsfr/Button';
export { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
export { CallOut } from '@codegouvfr/react-dsfr/CallOut';
export { Input } from '@codegouvfr/react-dsfr/Input';
export { Notice } from '@codegouvfr/react-dsfr/Notice';
export { Select } from '@codegouvfr/react-dsfr/Select';
export { Table } from '@codegouvfr/react-dsfr/Table';
export { Tabs } from '@codegouvfr/react-dsfr/Tabs';
export { Tag } from '@codegouvfr/react-dsfr/Tag';
export { ToggleSwitch } from '@codegouvfr/react-dsfr/ToggleSwitch';
export { AppShell, type AppShellProps, type NavLink } from './app-shell.tsx';
export { startUi, ThemeSelector, useApplyTheme, type Theme } from './theme.tsx';
