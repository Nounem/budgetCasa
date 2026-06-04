import { db } from './database';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type Profil = {
  id: number;
  nom: string;
  salaire: number;
  devise: string;
  nombre_personnes: number;
  nombre_enfants: number;
  api_key_cerebras: string;
};

export type Depense = {
  id: number;
  montant: number;
  description: string;
  categorie_id: number;
  categorie_nom: string;
  categorie_couleur: string;
  date: string;
  mois: number;
  annee: number;
};

export type ChargeFix = {
  id: number;
  nom: string;
  montant: number;
  categorie_id: number | null;
  categorie_nom: string;
  categorie_couleur: string;
  actif: number;
  jour_prelevement: number;
};

export type Categorie = {
  id: number;
  nom: string;
  icone: string;
  couleur: string;
  type: string;
};

// ─── PROFIL ───────────────────────────────────────────────────────────────────

export function getProfil(): Profil | null {
  return db.getFirstSync<Profil>('SELECT * FROM profil LIMIT 1');
}

export function sauvegarderProfil(
  nom: string,
  salaire: number,
  nombre_personnes: number,
  nombre_enfants: number,
  api_key_cerebras: string = ''
): void {
  const existant = getProfil();
  if (existant) {
    db.runSync(
      `UPDATE profil SET nom=?, salaire=?, nombre_personnes=?, nombre_enfants=?, api_key_cerebras=? WHERE id=?`,
      [nom, salaire, nombre_personnes, nombre_enfants, api_key_cerebras, existant.id]
    );
  } else {
    db.runSync(
      `INSERT INTO profil (nom, salaire, nombre_personnes, nombre_enfants, api_key_cerebras) VALUES (?, ?, ?, ?, ?)`,
      [nom, salaire, nombre_personnes, nombre_enfants, api_key_cerebras]
    );
  }
}

// ─── CHARGES FIXES ────────────────────────────────────────────────────────────

// Total de toutes les charges actives (loyer + abonnements + ...)
export function getTotalChargesFixes(): number {
  const result = db.getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(montant), 0) as total FROM charge_fixe WHERE actif = 1'
  );
  return result?.total ?? 0;
}

// ─── DÉPENSES ─────────────────────────────────────────────────────────────────

// Total des dépenses pour un mois donné
export function getTotalDepensesMois(mois: number, annee: number): number {
  const result = db.getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(montant), 0) as total FROM depense WHERE mois=? AND annee=?',
    [mois, annee]
  );
  return result?.total ?? 0;
}

// Les 5 dernières dépenses avec leur catégorie
export function getDepensesRecentes(): Depense[] {
  return db.getAllSync<Depense>(
    `SELECT d.*,
            COALESCE(c.nom, 'Divers') as categorie_nom,
            COALESCE(c.couleur, '#94A3B8') as categorie_couleur
     FROM depense d
     LEFT JOIN categorie c ON d.categorie_id = c.id
     ORDER BY d.date DESC, d.id DESC
     LIMIT 5`
  );
}

// Ajouter une dépense
export function ajouterDepense(
  montant: number,
  description: string,
  categorie_id: number | null
): void {
  const maintenant = new Date();
  db.runSync(
    `INSERT INTO depense (montant, description, categorie_id, mois, annee)
     VALUES (?, ?, ?, ?, ?)`,
    [montant, description, categorie_id, maintenant.getMonth() + 1, maintenant.getFullYear()]
  );
}

// Toutes les dépenses du mois en cours
export function getDepensesMois(mois: number, annee: number): Depense[] {
  return db.getAllSync<Depense>(
    `SELECT d.*,
            COALESCE(c.nom, 'Divers') as categorie_nom,
            COALESCE(c.couleur, '#94A3B8') as categorie_couleur
     FROM depense d
     LEFT JOIN categorie c ON d.categorie_id = c.id
     WHERE d.mois=? AND d.annee=?
     ORDER BY d.date DESC, d.id DESC`,
    [mois, annee]
  );
}

// Modifier une dépense
export function modifierDepense(
  id: number,
  montant: number,
  description: string,
  categorie_id: number | null
): void {
  db.runSync(
    `UPDATE depense SET montant=?, description=?, categorie_id=? WHERE id=?`,
    [montant, description, categorie_id, id]
  );
}

// Supprimer une dépense
export function supprimerDepense(id: number): void {
  db.runSync('DELETE FROM depense WHERE id=?', [id]);
}

// ─── CHARGES FIXES (liste + CRUD) ────────────────────────────────────────────

export function getChargesFixes(): ChargeFix[] {
  return db.getAllSync<ChargeFix>(
    `SELECT cf.*,
            COALESCE(c.nom, 'Divers') as categorie_nom,
            COALESCE(c.couleur, '#94A3B8') as categorie_couleur
     FROM charge_fixe cf
     LEFT JOIN categorie c ON cf.categorie_id = c.id
     ORDER BY cf.actif DESC, cf.montant DESC`
  );
}

export function ajouterChargeFix(
  nom: string,
  montant: number,
  categorie_id: number | null,
  jour_prelevement: number
): void {
  db.runSync(
    `INSERT INTO charge_fixe (nom, montant, categorie_id, jour_prelevement) VALUES (?, ?, ?, ?)`,
    [nom, montant, categorie_id, jour_prelevement]
  );
}

export function toggleChargeFix(id: number, actif: number): void {
  db.runSync('UPDATE charge_fixe SET actif=? WHERE id=?', [actif ? 0 : 1, id]);
}

export function modifierChargeFix(
  id: number,
  nom: string,
  montant: number,
  categorie_id: number | null,
  jour_prelevement: number
): void {
  db.runSync(
    `UPDATE charge_fixe SET nom=?, montant=?, categorie_id=?, jour_prelevement=? WHERE id=?`,
    [nom, montant, categorie_id, jour_prelevement, id]
  );
}

export function supprimerChargeFix(id: number): void {
  db.runSync('DELETE FROM charge_fixe WHERE id=?', [id]);
}

// ─── CATÉGORIES ───────────────────────────────────────────────────────────────

// Historique des 6 derniers mois (pour comparaison)
export type MoisResume = {
  mois: number;
  annee: number;
  total_depenses: number;
  total_charges: number;
};

export function getHistoriqueMois(): MoisResume[] {
  const depenses = db.getAllSync<{ mois: number; annee: number; total: number }>(
    `SELECT mois, annee, COALESCE(SUM(montant), 0) as total
     FROM depense
     GROUP BY mois, annee
     ORDER BY annee DESC, mois DESC
     LIMIT 6`
  );
  const totalCharges = getTotalChargesFixes();
  return depenses.map(d => ({
    mois: d.mois,
    annee: d.annee,
    total_depenses: d.total,
    total_charges: totalCharges,
  }));
}

// Dépenses par catégorie pour un mois donné (pour PDF)
export type DepenseParCategorie = {
  categorie_nom: string;
  categorie_couleur: string;
  total: number;
};

export function getDepensesParCategorie(mois: number, annee: number): DepenseParCategorie[] {
  return db.getAllSync<DepenseParCategorie>(
    `SELECT COALESCE(c.nom, 'Divers') as categorie_nom,
            COALESCE(c.couleur, '#94A3B8') as categorie_couleur,
            SUM(d.montant) as total
     FROM depense d
     LEFT JOIN categorie c ON d.categorie_id = c.id
     WHERE d.mois = ? AND d.annee = ?
     GROUP BY c.id
     ORDER BY total DESC`,
    [mois, annee]
  );
}

export function getCategories(type?: 'fixe' | 'variable'): Categorie[] {
  if (type) {
    return db.getAllSync<Categorie>('SELECT * FROM categorie WHERE type=? ORDER BY nom', [type]);
  }
  return db.getAllSync<Categorie>('SELECT * FROM categorie ORDER BY type, nom');
}
