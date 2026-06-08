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
  beneficiaire: string;
  date: string;
  mois: number;
  annee: number;
};

export type Revenu = {
  id: number;
  nom: string;
  montant: number;
  type: string;
  actif: number;
  periodicite: string;
};

// Bénéficiaires disponibles
export const BENEFICIAIRES = [
  { id: 'personnel', label: 'Personnel',  emoji: '👤' },
  { id: 'enfant',    label: 'Enfant',     emoji: '👶' },
  { id: 'maison',    label: 'Maison',     emoji: '🏠' },
  { id: 'parents',   label: 'Parents',    emoji: '👴' },
  { id: 'autre',     label: 'Autre',      emoji: '📦' },
];

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

// ─── STATISTIQUES ANNUELLES ───────────────────────────────────────────────────

export type StatMois = { mois: number; total: number };

export type BilanAnnuel = {
  annee: number;
  total_revenus: number;
  total_charges: number;
  total_depenses: number;
  epargne: number;
  par_mois: StatMois[];
  mois_max: number;
  mois_min: number;
};

export function getBilanAnnuel(annee: number): BilanAnnuel {
  const profil = getProfil();
  const salaire = profil?.salaire ?? 0;

  // Revenus mensuels récurrents × 12 + ponctuels de l'année
  const revenusMensuels = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(montant), 0) as total FROM revenu WHERE actif=1 AND periodicite='mensuel'`
  )?.total ?? 0;
  const revenus_ponctuels = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(montant), 0) as total FROM revenu WHERE actif=1 AND periodicite='ponctuel' AND annee=?`,
    [annee]
  )?.total ?? 0;
  const total_revenus = (salaire + revenusMensuels) * 12 + revenus_ponctuels;

  // Charges fixes × 12
  const total_charges = getTotalChargesFixes() * 12;

  // Dépenses réelles de l'année
  const total_depenses_res = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(montant), 0) as total FROM depense WHERE annee=?`, [annee]
  )?.total ?? 0;

  // Détail par mois
  const rows = db.getAllSync<{ mois: number; total: number }>(
    `SELECT mois, COALESCE(SUM(montant), 0) as total FROM depense WHERE annee=? GROUP BY mois ORDER BY mois`,
    [annee]
  );
  const par_mois: StatMois[] = Array.from({ length: 12 }, (_, i) => {
    const found = rows.find(r => r.mois === i + 1);
    return { mois: i + 1, total: found?.total ?? 0 };
  });

  const max = Math.max(...par_mois.map(m => m.total));
  const min = Math.min(...par_mois.filter(m => m.total > 0).map(m => m.total));

  return {
    annee,
    total_revenus,
    total_charges,
    total_depenses: total_depenses_res,
    epargne: total_revenus - total_charges - total_depenses_res,
    par_mois,
    mois_max: par_mois.findIndex(m => m.total === max) + 1,
    mois_min: par_mois.filter(m => m.total > 0).findIndex(m => m.total === min) + 1,
  };
}

// ─── PRÊTS ────────────────────────────────────────────────────────────────────

export type Pret = {
  id: number;
  nom: string;
  montant_total: number;
  mensualite: number;
  debut_mois: number;
  debut_annee: number;
  duree_mois: number;
  actif: number;
  // champs calculés
  mois_ecoules: number;
  mois_restants: number;
  montant_rembourse: number;
  montant_restant: number;
  pct_rembourse: number;
};

export function getPrets(): Pret[] {
  const now = new Date();
  const moisActuel = now.getMonth() + 1;
  const anneeActuelle = now.getFullYear();

  return db.getAllSync<Omit<Pret, 'mois_ecoules' | 'mois_restants' | 'montant_rembourse' | 'montant_restant' | 'pct_rembourse'>>(
    'SELECT * FROM pret WHERE actif=1 ORDER BY debut_annee DESC, debut_mois DESC'
  ).map(p => {
    const ecoules = Math.max(0, (anneeActuelle - p.debut_annee) * 12 + (moisActuel - p.debut_mois));
    const restants = Math.max(0, p.duree_mois - ecoules);
    const rembourse = Math.min(p.montant_total, p.mensualite * ecoules);
    const restant = Math.max(0, p.montant_total - rembourse);
    return {
      ...p,
      mois_ecoules: ecoules,
      mois_restants: restants,
      montant_rembourse: rembourse,
      montant_restant: restant,
      pct_rembourse: p.montant_total > 0 ? (rembourse / p.montant_total) * 100 : 0,
    };
  });
}

export function ajouterPret(nom: string, montant_total: number, mensualite: number, debut_mois: number, debut_annee: number, duree_mois: number): void {
  db.runSync(
    'INSERT INTO pret (nom, montant_total, mensualite, debut_mois, debut_annee, duree_mois) VALUES (?, ?, ?, ?, ?, ?)',
    [nom, montant_total, mensualite, debut_mois, debut_annee, duree_mois]
  );
}

export function supprimerPret(id: number): void {
  db.runSync('DELETE FROM pret WHERE id=?', [id]);
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

// Total revenus complémentaires actifs
export function getTotalRevenus(): number {
  const result = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(montant), 0) as total FROM revenu WHERE actif=1 AND periodicite='mensuel'`
  );
  return result?.total ?? 0;
}

// Revenu total = salaire + complémentaires
export function getRevenuTotal(): number {
  const profil = getProfil();
  return (profil?.salaire ?? 0) + getTotalRevenus();
}

// ─── CRUD REVENUS ─────────────────────────────────────────────────────────────

export function getRevenus(): Revenu[] {
  return db.getAllSync<Revenu>('SELECT * FROM revenu ORDER BY montant DESC');
}

export function ajouterRevenu(nom: string, montant: number, type: string, periodicite: string, mois?: number, annee?: number): void {
  db.runSync(
    'INSERT INTO revenu (nom, montant, type, periodicite, mois, annee) VALUES (?, ?, ?, ?, ?, ?)',
    [nom, montant, type, periodicite, mois ?? null, annee ?? null]
  );
}

export function modifierRevenu(id: number, nom: string, montant: number, type: string, periodicite: string): void {
  db.runSync(
    'UPDATE revenu SET nom=?, montant=?, type=?, periodicite=? WHERE id=?',
    [nom, montant, type, periodicite, id]
  );
}

export function toggleRevenu(id: number, actif: number): void {
  db.runSync('UPDATE revenu SET actif=? WHERE id=?', [actif ? 0 : 1, id]);
}

export function supprimerRevenu(id: number): void {
  db.runSync('DELETE FROM revenu WHERE id=?', [id]);
}

// ─── DÉPENSES ─────────────────────────────────────────────────────────────────

// Ajouter une dépense
export function ajouterDepense(
  montant: number,
  description: string,
  categorie_id: number | null,
  beneficiaire: string = 'personnel'
): void {
  const maintenant = new Date();
  db.runSync(
    `INSERT INTO depense (montant, description, categorie_id, beneficiaire, mois, annee)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [montant, description, categorie_id, beneficiaire, maintenant.getMonth() + 1, maintenant.getFullYear()]
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
  categorie_id: number | null,
  beneficiaire: string = 'personnel'
): void {
  db.runSync(
    `UPDATE depense SET montant=?, description=?, categorie_id=?, beneficiaire=? WHERE id=?`,
    [montant, description, categorie_id, beneficiaire, id]
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

// ─── BUDGET CIBLE PAR CATÉGORIE ───────────────────────────────────────────────

export type BudgetCible = {
  id: number;
  categorie_id: number;
  categorie_nom: string;
  categorie_couleur: string;
  montant_max: number;
  actif: number;
  depenses_mois: number;  // calculé
  pct_utilise: number;    // calculé
  depasse: boolean;       // calculé
};

export function getBudgetsCibles(mois: number, annee: number): BudgetCible[] {
  const cibles = db.getAllSync<{
    id: number; categorie_id: number; montant_max: number; actif: number;
    categorie_nom: string; categorie_couleur: string;
  }>(
    `SELECT bc.*, c.nom as categorie_nom, c.couleur as categorie_couleur
     FROM budget_cible bc
     JOIN categorie c ON bc.categorie_id = c.id
     WHERE bc.actif = 1
     ORDER BY c.nom`
  );

  return cibles.map(bc => {
    const dep = db.getFirstSync<{ total: number }>(
      `SELECT COALESCE(SUM(montant), 0) as total FROM depense WHERE categorie_id=? AND mois=? AND annee=?`,
      [bc.categorie_id, mois, annee]
    )?.total ?? 0;
    return {
      ...bc,
      depenses_mois: dep,
      pct_utilise: bc.montant_max > 0 ? (dep / bc.montant_max) * 100 : 0,
      depasse: dep > bc.montant_max,
    };
  });
}

export function setBudgetCible(categorie_id: number, montant_max: number): void {
  const existe = db.getFirstSync('SELECT id FROM budget_cible WHERE categorie_id=?', [categorie_id]);
  if (existe) {
    db.runSync('UPDATE budget_cible SET montant_max=?, actif=1 WHERE categorie_id=?', [montant_max, categorie_id]);
  } else {
    db.runSync('INSERT INTO budget_cible (categorie_id, montant_max) VALUES (?, ?)', [categorie_id, montant_max]);
  }
}

export function supprimerBudgetCible(id: number): void {
  db.runSync('DELETE FROM budget_cible WHERE id=?', [id]);
}

export function getCategories(type?: 'fixe' | 'variable'): Categorie[] {
  if (type) {
    return db.getAllSync<Categorie>('SELECT * FROM categorie WHERE type=? ORDER BY nom', [type]);
  }
  return db.getAllSync<Categorie>('SELECT * FROM categorie ORDER BY type, nom');
}
