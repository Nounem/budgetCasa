import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('budget.db');

export function initialiserBase() {
  db.execSync('PRAGMA journal_mode = WAL;');

  // ── Profil ─────────────────────────────────────────────────────────────────
  db.runSync(`
    CREATE TABLE IF NOT EXISTS profil (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      nom               TEXT    NOT NULL DEFAULT 'Mon profil',
      salaire           REAL    NOT NULL DEFAULT 0,
      devise            TEXT    NOT NULL DEFAULT 'EUR',
      nombre_personnes  INTEGER NOT NULL DEFAULT 1,
      nombre_enfants    INTEGER NOT NULL DEFAULT 0,
      api_key_cerebras  TEXT    DEFAULT '',
      created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Catégorie ──────────────────────────────────────────────────────────────
  db.runSync(`
    CREATE TABLE IF NOT EXISTS categorie (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      nom     TEXT NOT NULL,
      icone   TEXT NOT NULL DEFAULT 'help-circle',
      couleur TEXT NOT NULL DEFAULT '#94A3B8',
      type    TEXT NOT NULL CHECK(type IN ('fixe', 'variable'))
    )
  `);

  // ── Charge fixe ────────────────────────────────────────────────────────────
  db.runSync(`
    CREATE TABLE IF NOT EXISTS charge_fixe (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      nom               TEXT    NOT NULL,
      montant           REAL    NOT NULL,
      categorie_id      INTEGER,
      actif             INTEGER NOT NULL DEFAULT 1,
      jour_prelevement  INTEGER DEFAULT 1,
      FOREIGN KEY (categorie_id) REFERENCES categorie(id)
    )
  `);

  // ── Dépense ────────────────────────────────────────────────────────────────
  db.runSync(`
    CREATE TABLE IF NOT EXISTS depense (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      montant      REAL    NOT NULL,
      description  TEXT,
      categorie_id INTEGER,
      beneficiaire TEXT    NOT NULL DEFAULT 'personnel',
      date         TEXT    NOT NULL DEFAULT (date('now')),
      mois         INTEGER NOT NULL,
      annee        INTEGER NOT NULL,
      FOREIGN KEY (categorie_id) REFERENCES categorie(id)
    )
  `);

  // ── Revenu complémentaire ──────────────────────────────────────────────────
  // periodicite = 'mensuel'  → s'applique tous les mois
  // periodicite = 'ponctuel' → s'applique uniquement au mois+annee indiqués
  db.runSync(`
    CREATE TABLE IF NOT EXISTS revenu (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nom         TEXT NOT NULL,
      montant     REAL NOT NULL,
      type        TEXT NOT NULL DEFAULT 'complementaire',
      actif       INTEGER NOT NULL DEFAULT 1,
      periodicite TEXT NOT NULL DEFAULT 'mensuel',
      mois        INTEGER DEFAULT NULL,
      annee       INTEGER DEFAULT NULL
    )
  `);

  // ── Suivi de prêts ─────────────────────────────────────────────────────────
  db.runSync(`
    CREATE TABLE IF NOT EXISTS pret (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nom           TEXT    NOT NULL,
      montant_total REAL    NOT NULL,
      mensualite    REAL    NOT NULL,
      debut_mois    INTEGER NOT NULL,
      debut_annee   INTEGER NOT NULL,
      duree_mois    INTEGER NOT NULL,
      actif         INTEGER NOT NULL DEFAULT 1
    )
  `);

  // ── Budget mensuel ─────────────────────────────────────────────────────────
  db.runSync(`
    CREATE TABLE IF NOT EXISTS budget_mensuel (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      mois                 INTEGER NOT NULL,
      annee                INTEGER NOT NULL,
      salaire              REAL    NOT NULL DEFAULT 0,
      total_charges_fixes  REAL    NOT NULL DEFAULT 0,
      total_depenses       REAL    NOT NULL DEFAULT 0,
      solde_prevu          REAL    NOT NULL DEFAULT 0,
      UNIQUE(mois, annee)
    )
  `);

  // ── Migrations pour bases existantes ──────────────────────────────────────
  const migrations = [
    `ALTER TABLE profil ADD COLUMN api_key_cerebras TEXT DEFAULT ''`,
    `ALTER TABLE depense ADD COLUMN beneficiaire TEXT NOT NULL DEFAULT 'personnel'`,
    `ALTER TABLE revenu ADD COLUMN mois INTEGER DEFAULT NULL`,
    `ALTER TABLE revenu ADD COLUMN annee INTEGER DEFAULT NULL`,
  ];
  migrations.forEach(sql => {
    try { db.runSync(sql); } catch { /* colonne déjà existante */ }
  });

  // ── Catégories par défaut ──────────────────────────────────────────────────
  const count = db.getFirstSync<{ total: number }>('SELECT COUNT(*) as total FROM categorie');

  if (count?.total === 0) {
    [
      ['Logement',     '#EF4444', 'fixe'],
      ['Transport',    '#F97316', 'fixe'],
      ['Abonnements',  '#8B5CF6', 'fixe'],
      ['Santé',        '#EC4899', 'fixe'],
      ['Prêt',         '#6366F1', 'fixe'],
      ['Alimentation', '#22C55E', 'variable'],
      ['Restaurants',  '#EAB308', 'variable'],
      ['Loisirs',      '#3B82F6', 'variable'],
      ['Vêtements',    '#06B6D4', 'variable'],
      ['Divers',       '#94A3B8', 'variable'],
    ].forEach(([nom, couleur, type]) => {
      db.runSync('INSERT INTO categorie (nom, couleur, type) VALUES (?, ?, ?)', [nom, couleur, type]);
    });
  }

  // Catégories manquantes pour bases existantes
  [['Prêt', '#6366F1', 'fixe']].forEach(([nom, couleur, type]) => {
    const existe = db.getFirstSync('SELECT id FROM categorie WHERE nom=?', [nom]);
    if (!existe) db.runSync('INSERT INTO categorie (nom, couleur, type) VALUES (?, ?, ?)', [nom, couleur, type]);
  });
}
