// Cas de test des règles Semgrep du projet : `semgrep --test .semgrep`.
// Les annotations `ruleid` marquent une ligne qui doit être signalée, `ok` une ligne qui doit passer.

export async function exemples(db: { query: (text: string, params?: unknown[]) => Promise<unknown> }, nom: string): Promise<void> {
  // ruleid: pv-sql-concatenation
  await db.query(`SELECT * FROM identity.users WHERE email = '${nom}'`);
  // ruleid: pv-sql-concatenation
  await db.query('SELECT * FROM identity.users WHERE email = ' + nom);
  // ok: pv-sql-concatenation
  await db.query('SELECT * FROM identity.users WHERE email = $1', [nom]);
  // ruleid: pv-evaluation-dynamique
  eval(nom);
}
