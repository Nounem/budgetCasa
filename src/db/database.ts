import * as SQLite from 'expo-sqlite';

// Ouvre (ou crée) le fichier budget.db sur le téléphone
export const db = SQLite.openDatabaseSync('budget.db');

export function initialiserBase() {
  // WAL = Write-Ahead Logging : rend la base plus rapide et fiable
  db.execSync('PRAGMA journal_mode = WAL;');

  // Table profil : les infos de l'utilisateur (une seule ligne)
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

  // Migration : ajouter api_key_cerebras si la colonne n'existe pas encore
  try {
    db.runSync(`ALTER TABLE profil ADD COLUMN api_key_cerebras TEXT DEFAULT ''`);
  } catch {
    // La colonne existe déjà — c'est normal
  }

  // Table categorie : pour classer les dépenses et charges
  db.runSync(`
    CREATE TABLE IF NOT EXISTS categorie (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      nom     TEXT NOT NULL,
      icone   TEXT NOT NULL DEFAULT 'help-circle',
      couleur TEXT NOT NULL DEFAULT '#94A3B8',
      type    TEXT NOT NULL CHECK(type IN ('fixe', 'variable'))
    )
  `);

  // Table charge_fixe : loyer, électricité, abonnements...
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

  // Table depense : les dépenses saisies au quotidien
  db.runSync(`
    CREATE TABLE IF NOT EXISTS depense (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      montant      REAL    NOT NULL,
      description  TEXT,
      categorie_id INTEGER,
      date         TEXT    NOT NULL DEFAULT (date('now')),
      mois         INTEGER NOT NULL,
      annee        INTEGER NOT NULL,
      FOREIGN KEY (categorie_id) REFERENCES categorie(id)
    )
  `);

  // Table budget_mensuel : résumé calculé par mois
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

  // Insérer les catégories par défaut si la table est vide
  const count = db.getFirstSync<{ total: number }>(
    'SELECT COUNT(*) as total FROM categorie'
  );

  if (count?.total === 0) {
    const categoriesFixe = [
      ['Logement',    'home',          '#EF4444', 'fixe'],
      ['Transport',   'car',           '#F97316', 'fixe'],
      ['Abonnements', 'repeat',        '#8B5CF6', 'fixe'],
      ['Santé',       'medical',       '#EC4899', 'fixe'],
      ['Prêt',        'cash',          '#6366F1', 'fixe'],
    ];

    const categoriesVariable = [
      ['Alimentation', 'cart',                  '#22C55E', 'variable'],
      ['Restaurants',  'restaurant',            '#EAB308', 'variable'],
      ['Loisirs',      'game-controller',       '#3B82F6', 'variable'],
      ['Vêtements',    'shirt',                 '#06B6D4', 'variable'],
      ['Divers',       'ellipsis-horizontal',   '#94A3B8', 'variable'],
    ];

    [...categoriesFixe, ...categoriesVariable].forEach(([nom, icone, couleur, type]) => {
      db.runSync(
        'INSERT INTO categorie (nom, icone, couleur, type) VALUES (?, ?, ?, ?)',
        [nom, icone, couleur, type]
      );
    });
  }

  // Ajouter les catégories manquantes pour les bases existantes
  const categoriesManquantes = [
    ['Prêt', 'cash', '#6366F1', 'fixe'],
    ['Loyer', 'home-outline', '#EF4444', 'fixe'],
  ];
  categoriesManquantes.forEach(([nom, icone, couleur, type]) => {
    const existe = db.getFirstSync('SELECT id FROM categorie WHERE nom=?', [nom]);
    if (!existe) {
      db.runSync(
        'INSERT INTO categorie (nom, icone, couleur, type) VALUES (?, ?, ?, ?)',
        [nom, icone, couleur, type]
      );
    }
  });
}
