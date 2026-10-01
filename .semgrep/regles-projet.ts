// Cas de test des règles Semgrep du projet : `semgrep --test .semgrep`.
// Les annotations `ruleid` marquent une ligne qui doit être signalée, `ok` une ligne qui doit passer.

const COLUMNS = 'id, email';
const BATCH_SIZE = 100;

interface Ligne {
  readonly id: string;
}

export async function exemples(db: { query: <R>(text: string, params?: unknown[]) => Promise<R[]> }, nom: string, column: string): Promise<void> {
  // ruleid: pv-sql-concatenation
  await db.query(`SELECT * FROM identity.users WHERE email = '${nom}'`);
  // ruleid: pv-sql-concatenation
  await db.query<Ligne>(`SELECT id FROM identity.users WHERE email = '${nom}'`);
  // ruleid: pv-sql-concatenation
  await db.query('SELECT * FROM identity.users WHERE email = ' + nom);
  // ruleid: pv-sql-concatenation
  await db.query<Ligne>(`SELECT ${COLUMNS} FROM identity.users WHERE ${column} = $1`, [nom]);
  // ok: pv-sql-concatenation
  await db.query('SELECT * FROM identity.users WHERE email = $1', [nom]);
  // ok: pv-sql-concatenation
  await db.query<Ligne>(`SELECT ${COLUMNS} FROM identity.users WHERE email = $1 LIMIT ${String(BATCH_SIZE)}`, [nom]);
  // ruleid: pv-evaluation-dynamique
  eval(nom);
}
