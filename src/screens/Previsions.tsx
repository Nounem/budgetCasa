import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Heart, BarChart3, Brain, FileText, TrendingUp } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import {
  getProfil, getTotalChargesFixes, getTotalDepensesMois,
  getDepensesMois, getHistoriqueMois, getDepensesParCategorie,
  getBilanAnnuel, getPrets,
  Depense, MoisResume, DepenseParCategorie, BilanAnnuel, Pret,
} from '../db/queries';

const P = {
  fond: '#F7F6F3', blanc: '#FFFFFF', emerald: '#065F46',
  emeraldMid: '#059669', emeraldLight: '#D1FAE5',
  ardoise: '#1E293B', gris: '#6B7280', grisClair: '#F3F4F6',
  bordure: '#E5E7EB', rouge: '#DC2626', rougeLight: '#FEE2E2',
  ambre: '#D97706', ambreLight: '#FEF3C7',
  violet: '#7C3AED', violetLight: '#F5F3FF',
  bleu: '#2563EB',
};

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

const NOMS_MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const MOIS_LONGS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function getMoisActuel() {
  const d = new Date();
  return {
    mois: d.getMonth() + 1, annee: d.getFullYear(),
    nomMois: MOIS_LONGS[d.getMonth()],
  };
}

function getJoursRestants(): number {
  const d = new Date();
  const dernierJour = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return Math.max(1, dernierJour.getDate() - d.getDate() + 1);
}

// ─── SCORE DE SANTÉ ───────────────────────────────────────────────────────────

function calculerScore(salaire: number, charges: number, depenses: number) {
  if (salaire === 0) return { score: 0, niveau: 'Non défini', couleur: P.gris, details: [] };
  let score = 100;
  const details: { texte: string; ok: boolean }[] = [];
  const tauxCharges  = (charges  / salaire) * 100;
  const tauxDepenses = (depenses / salaire) * 100;
  const tauxEpargne  = 100 - tauxCharges - tauxDepenses;

  if (tauxCharges > 50)      { score -= 30; details.push({ texte: 'Charges fixes > 50% du salaire', ok: false }); }
  else if (tauxCharges > 35) { score -= 15; details.push({ texte: 'Charges fixes élevées (>35%)', ok: false }); }
  else                       { details.push({ texte: 'Charges fixes maîtrisées', ok: true }); }

  if (tauxDepenses > 40)      { score -= 25; details.push({ texte: 'Dépenses variables très élevées', ok: false }); }
  else if (tauxDepenses > 25) { score -= 10; details.push({ texte: 'Dépenses variables à surveiller', ok: false }); }
  else                        { details.push({ texte: 'Dépenses variables raisonnables', ok: true }); }

  if (tauxEpargne >= 20)       { details.push({ texte: `Excellent taux d'épargne (${Math.round(tauxEpargne)}%)`, ok: true }); }
  else if (tauxEpargne >= 10)  { score -= 10; details.push({ texte: 'Taux d\'épargne moyen', ok: false }); }
  else                         { score -= 20; details.push({ texte: 'Épargne insuffisante', ok: false }); }

  score = Math.max(0, Math.min(100, score));
  let niveau = 'Excellent', couleur = P.emeraldMid;
  if (score < 40)      { niveau = 'Critique';    couleur = P.rouge; }
  else if (score < 60) { niveau = 'À améliorer'; couleur = P.ambre; }
  else if (score < 80) { niveau = 'Correct';     couleur = P.bleu; }
  return { score, niveau, couleur, details };
}

// ─── GRAPHIQUE CATÉGORIES ─────────────────────────────────────────────────────

function GraphiqueCategories({ depenses, total }: { depenses: Depense[]; total: number }) {
  const parCat: Record<string, { montant: number; couleur: string }> = {};
  depenses.forEach(d => {
    if (!parCat[d.categorie_nom]) parCat[d.categorie_nom] = { montant: 0, couleur: d.categorie_couleur };
    parCat[d.categorie_nom].montant += d.montant;
  });
  const cats = Object.entries(parCat).sort((a, b) => b[1].montant - a[1].montant).slice(0, 6);
  if (cats.length === 0) return <Text style={styles.vide_sous}>Aucune dépense ce mois</Text>;
  return (
    <View style={{ gap: 12 }}>
      {cats.map(([nom, data]) => {
        const pct = total > 0 ? (data.montant / total) * 100 : 0;
        return (
          <View key={nom}>
            <View style={styles.bar_header}>
              <View style={styles.bar_left}>
                <View style={[styles.bar_dot, { backgroundColor: data.couleur }]} />
                <Text style={styles.bar_nom}>{nom}</Text>
              </View>
              <Text style={styles.bar_montant}>{fmt(data.montant)}</Text>
              <Text style={[styles.bar_pct, { color: data.couleur }]}>{Math.round(pct)}%</Text>
            </View>
            <View style={styles.bar_fond}>
              <View style={[styles.bar_rempli, { width: `${pct}%` as any, backgroundColor: data.couleur }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── COMPARAISON MOIS ─────────────────────────────────────────────────────────

function ComparaisonSection({ historique }: { historique: MoisResume[] }) {
  if (historique.length === 0) return null;
  const max = Math.max(...historique.map(m => m.total_depenses), 1);
  return (
    <View style={styles.carte}>
      <View style={styles.carte_header}>
        <TrendingUp size={16} color={P.bleu} strokeWidth={2} />
        <Text style={styles.carte_titre}>Évolution des dépenses</Text>
      </View>
      <View style={{ gap: 10, marginTop: 16 }}>
        {[...historique].reverse().map(m => {
          const pct = (m.total_depenses / max) * 100;
          return (
            <View key={`${m.mois}-${m.annee}`}>
              <View style={styles.bar_header}>
                <Text style={[styles.bar_nom, { width: 44 }]}>{NOMS_MOIS[m.mois - 1]}</Text>
                <View style={[styles.bar_fond, { flex: 1, marginHorizontal: 8 }]}>
                  <View style={[styles.bar_rempli, { width: `${pct}%` as any, backgroundColor: P.bleu }]} />
                </View>
                <Text style={styles.bar_montant}>{fmt(m.total_depenses)}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── API OPENROUTER ───────────────────────────────────────────────────────────

async function analyserAvecIA(
  apiKey: string, salaire: number, charges: number, depenses: Depense[],
  depensesTotal: number, nbPersonnes: number, nbEnfants: number, nomMois: string,
  prets: Pret[]
): Promise<string> {
  // Détail par catégorie
  const parCat: Record<string, number> = {};
  depenses.forEach(d => { parCat[d.categorie_nom] = (parCat[d.categorie_nom] || 0) + d.montant; });
  const resumeCat = Object.entries(parCat)
    .sort((a, b) => b[1] - a[1])
    .map(([c, m]) => `${c}: ${m.toFixed(0)}€`)
    .join(', ');

  // Détail par bénéficiaire
  const parBenef: Record<string, number> = {};
  depenses.forEach(d => { parBenef[d.beneficiaire] = (parBenef[d.beneficiaire] || 0) + d.montant; });
  const resumeBenef = Object.entries(parBenef)
    .map(([b, m]) => `${b}: ${m.toFixed(0)}€`)
    .join(', ');

  // Prêts
  const resumePrets = prets.length > 0
    ? prets.map(p => `${p.nom} (${p.mensualite.toFixed(0)}€/mois, ${p.mois_restants} mois restants, ${Math.round(p.pct_rembourse)}% remboursé)`).join(' | ')
    : 'Aucun prêt';

  const solde = salaire - charges - depensesTotal;
  const tauxEpargne = salaire > 0 ? ((solde / salaire) * 100).toFixed(0) : '0';

  const prompt = `Tu es un conseiller financier expert et bienveillant. Analyse ce budget réel en français avec des conseils précis et actionnables basés sur les données exactes.
IMPORTANT: Réponds en texte simple. Pas de markdown, pas d'astérisques. 4 paragraphes séparés par une ligne vide.

═══ PROFIL FAMILLE ═══
Foyer: ${nbPersonnes} personne(s) dont ${nbEnfants} enfant(s)
Mois analysé: ${nomMois}

═══ REVENUS ET CHARGES ═══
Revenus totaux: ${salaire.toFixed(0)}€
Charges fixes: ${charges.toFixed(0)}€ (${salaire > 0 ? ((charges/salaire)*100).toFixed(0) : 0}% des revenus)
Dépenses variables: ${depensesTotal.toFixed(0)}€ (${salaire > 0 ? ((depensesTotal/salaire)*100).toFixed(0) : 0}% des revenus)
Solde disponible: ${solde.toFixed(0)}€
Taux d'épargne: ${tauxEpargne}%

═══ DÉTAIL DES DÉPENSES PAR CATÉGORIE ═══
${resumeCat || 'Aucune dépense enregistrée'}

═══ RÉPARTITION PAR BÉNÉFICIAIRE ═══
${resumeBenef || 'Non renseigné'}

═══ PRÊTS EN COURS ═══
${resumePrets}

Réponds avec exactement 4 paragraphes:
1. Constat précis de la situation financière de ce foyer ce mois.
2. Ce qui va bien dans ce budget (cite des chiffres réels).
3. Ce qui peut être optimisé (cite des catégories ou montants précis).
4. Un conseil concret et actionnable pour le mois prochain.`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://monbudgetapp.local',
      'X-Title': 'Mon Budget App',
    },
    body: JSON.stringify({
      model: 'google/gemma-4-31b-it:free',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
    }),
  });
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? '')
    .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '').replace(/^[-•]\s/gm, '').replace(/^\d+\.\s/gm, '').trim();
}

// ─── EXPORT PDF ───────────────────────────────────────────────────────────────

async function exporterPDF(
  nom: string, salaire: number, charges: number, depenses: number,
  parCat: DepenseParCategorie[], analyseIA: string, nomMois: string, annee: number,
  depensesList: Depense[], pretsList: Pret[]
) {
  const solde = salaire - charges - depenses;

  // Tableau catégories
  const lignesCat = parCat.map(c => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9">${c.categorie_nom}</td>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">
        ${c.total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </td>
    </tr>`).join('');

  // Tableau bénéficiaires
  const parBenef: Record<string, number> = {};
  depensesList.forEach(d => { parBenef[d.beneficiaire] = (parBenef[d.beneficiaire] || 0) + d.montant; });
  const LABELS: Record<string, string> = { personnel: '👤 Personnel', enfant: '👶 Enfant', maison: '🏠 Maison', parents: '👴 Parents', autre: '📦 Autre' };
  const lignesBenef = Object.entries(parBenef).map(([b, m]) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9">${LABELS[b] ?? b}</td>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">
        ${m.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </td>
    </tr>`).join('');

  // Tableau prêts
  const lignesPrets = pretsList.map(p => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9">${p.nom}</td>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:center">${p.mensualite.toFixed(0)}€/mois</td>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:center">${Math.round(p.pct_rembourse)}%</td>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">${p.montant_restant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} restant</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
    <style>
      body{font-family:Arial,sans-serif;color:#1e293b;padding:40px;max-width:700px;margin:auto}
      h1{color:#065F46;border-bottom:3px solid #065F46;padding-bottom:12px;margin-bottom:4px}
      h2{color:#374151;margin-top:28px;margin-bottom:8px;font-size:16px}
      .subtitle{color:#6b7280;font-size:13px;margin-bottom:20px}
      .card{background:#f8fafc;border-radius:12px;padding:20px;margin:12px 0}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0}
      .solde{font-size:28px;font-weight:bold;color:${solde >= 0 ? '#065F46' : '#dc2626'}}
      .badge{display:inline-block;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;margin-left:8px}
      .badge-ok{background:#d1fae5;color:#065F46}
      .badge-warn{background:#fee2e2;color:#dc2626}
      table{width:100%;border-collapse:collapse;font-size:14px}
      th{background:#f1f5f9;padding:10px 8px;text-align:left;font-size:12px;color:#6b7280;font-weight:600}
      .ia{background:#f5f3ff;border-left:4px solid #7c3aed;padding:16px;border-radius:8px;line-height:1.7;font-size:14px}
      .footer{margin-top:40px;color:#94a3b8;font-size:12px;text-align:center;border-top:1px solid #e2e8f0;padding-top:20px}
      .progress{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;margin-top:4px}
      .progress-fill{height:100%;background:#065F46;border-radius:4px}
    </style></head><body>

    <h1>budgetCasa · Bilan ${nomMois} ${annee}</h1>
    <p class="subtitle">Préparé pour <strong>${nom}</strong></p>

    <div class="card">
      <h2>Résumé financier</h2>
      <div class="row"><span>Revenus totaux</span><strong>${fmt(salaire)}</strong></div>
      <div class="row"><span>Charges fixes</span><strong style="color:#d97706">${fmt(charges)} (${salaire > 0 ? ((charges/salaire)*100).toFixed(0) : 0}%)</strong></div>
      <div class="row"><span>Dépenses variables</span><strong style="color:#dc2626">${fmt(depenses)} (${salaire > 0 ? ((depenses/salaire)*100).toFixed(0) : 0}%)</strong></div>
      <div style="padding-top:16px;display:flex;align-items:center;gap:12px">
        <span>Solde :</span>
        <span class="solde">${fmt(solde)}</span>
        <span class="badge ${solde >= 0 ? 'badge-ok' : 'badge-warn'}">${salaire > 0 ? ((solde/salaire)*100).toFixed(0) : 0}% du revenu</span>
      </div>
    </div>

    ${parCat.length > 0 ? `
    <div class="card">
      <h2>Dépenses par catégorie</h2>
      <table><thead><tr><th>Catégorie</th><th style="text-align:right">Montant</th></tr></thead>
      <tbody>${lignesCat}</tbody></table>
    </div>` : ''}

    ${Object.keys(parBenef).length > 0 ? `
    <div class="card">
      <h2>Dépenses par bénéficiaire</h2>
      <table><thead><tr><th>Pour qui</th><th style="text-align:right">Montant</th></tr></thead>
      <tbody>${lignesBenef}</tbody></table>
    </div>` : ''}

    ${pretsList.length > 0 ? `
    <div class="card">
      <h2>Prêts en cours</h2>
      <table><thead><tr><th>Prêt</th><th>Mensualité</th><th>Avancement</th><th style="text-align:right">Restant</th></tr></thead>
      <tbody>${lignesPrets}</tbody></table>
    </div>` : ''}

    ${analyseIA ? `
    <div class="card">
      <h2>Analyse IA personnalisée</h2>
      <div class="ia">${analyseIA.replace(/\n/g, '<br>')}</div>
    </div>` : ''}

    <div class="footer">Généré par <strong>budgetCasa</strong> · ${nomMois} ${annee}</div>
    </body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Bilan ${nomMois} ${annee}` });
}

// ─── ÉCRAN PRINCIPAL ──────────────────────────────────────────────────────────

export default function Previsions() {
  const [donnees, setDonnees] = useState({
    salaire: 0, charges: 0, depenses: 0,
    depensesList: [] as Depense[], nbPersonnes: 1, nbEnfants: 0,
    apiKey: '', pret: false,
  });
  const [historique, setHistorique]   = useState<MoisResume[]>([]);
  const [analyseIA, setAnalyseIA]     = useState('');
  const [chargementIA, setChargIA]    = useState(false);
  const [exportEnCours, setExport]    = useState(false);
  const [onglet, setOnglet]           = useState<'mois' | 'annee'>('mois');
  const [bilan, setBilan]             = useState<BilanAnnuel | null>(null);
  const [prets, setPrets]             = useState<Pret[]>([]);

  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web') return;
    const { mois, annee } = getMoisActuel();
    const profil = getProfil();
    const deps = getDepensesMois(mois, annee);
    setDonnees({
      salaire: profil?.salaire ?? 0,
      charges: getTotalChargesFixes(),
      depenses: getTotalDepensesMois(mois, annee),
      depensesList: deps,
      nbPersonnes: profil?.nombre_personnes ?? 1,
      nbEnfants: profil?.nombre_enfants ?? 0,
      apiKey: profil?.api_key_cerebras ?? '',
      pret: true,
    });
    setHistorique(getHistoriqueMois());
    setBilan(getBilanAnnuel(annee));
    setPrets(getPrets());
    setAnalyseIA('');
  }, []));

  async function lancerIA() {
    if (!donnees.apiKey) return;
    setChargIA(true); setAnalyseIA('');
    try {
      const { nomMois } = getMoisActuel();
      const r = await analyserAvecIA(
        donnees.apiKey, donnees.salaire, donnees.charges,
        donnees.depensesList, donnees.depenses,
        donnees.nbPersonnes, donnees.nbEnfants, nomMois,
        prets
      );
      setAnalyseIA(r);
    } catch (e: any) { setAnalyseIA(`Erreur : ${e.message}`); }
    finally { setChargIA(false); }
  }

  async function lancerPDF() {
    setExport(true);
    try {
      const { mois, annee, nomMois } = getMoisActuel();
      const profil = getProfil();
      const parCat = getDepensesParCategorie(mois, annee);
      await exporterPDF(
        profil?.nom ?? '', donnees.salaire, donnees.charges, donnees.depenses,
        parCat, analyseIA, nomMois, annee,
        donnees.depensesList, prets
      );
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setExport(false); }
  }

  const { score, niveau, couleur, details } = calculerScore(donnees.salaire, donnees.charges, donnees.depenses);
  const solde = donnees.salaire - donnees.charges - donnees.depenses;
  const joursRestants = getJoursRestants();
  const { nomMois, annee } = getMoisActuel();

  return (
    <ScrollView style={styles.ecran} contentContainerStyle={styles.contenu}
      showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.header_titre}>Prévisions</Text>
        <Text style={styles.header_sous}>{nomMois} {annee}</Text>
      </View>

      {/* Sélecteur onglets */}
      <View style={styles.onglets_row}>
        {[
          { id: 'mois', label: 'Ce mois' },
          { id: 'annee', label: `Année ${annee}` },
        ].map(o => (
          <TouchableOpacity key={o.id}
            style={[styles.onglet_btn, onglet === o.id && styles.onglet_btn_actif]}
            onPress={() => setOnglet(o.id as 'mois' | 'annee')}>
            <Text style={[styles.onglet_texte, onglet === o.id && styles.onglet_texte_actif]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ══ VUE ANNUELLE ══════════════════════════════════════════════════════ */}
      {onglet === 'annee' && bilan && (
        <>
          {/* Bilan annuel */}
          <View style={styles.carte}>
            <View style={styles.carte_header}>
              <TrendingUp size={16} color={P.emeraldMid} strokeWidth={2} />
              <Text style={styles.carte_titre}>Bilan {bilan.annee}</Text>
            </View>
            <View style={[styles.bento_grid, { marginTop: 16 }]}>
              <View style={[styles.bento, { flex: 1 }]}>
                <Text style={styles.bento_label}>Revenus totaux</Text>
                <Text style={[styles.bento_valeur, { color: P.emeraldMid, fontSize: 16 }]}>{fmt(bilan.total_revenus)}</Text>
              </View>
              <View style={[styles.bento, { flex: 1 }]}>
                <Text style={styles.bento_label}>Charges totales</Text>
                <Text style={[styles.bento_valeur, { color: P.ambre, fontSize: 16 }]}>{fmt(bilan.total_charges)}</Text>
              </View>
            </View>
            <View style={[styles.bento_grid, { marginTop: 8 }]}>
              <View style={[styles.bento, { flex: 1 }]}>
                <Text style={styles.bento_label}>Dépenses réelles</Text>
                <Text style={[styles.bento_valeur, { color: P.rouge, fontSize: 16 }]}>{fmt(bilan.total_depenses)}</Text>
              </View>
              <View style={[styles.bento, { flex: 1, backgroundColor: bilan.epargne >= 0 ? P.emeraldLight : P.rougeLight }]}>
                <Text style={styles.bento_label}>Épargne réelle</Text>
                <Text style={[styles.bento_valeur, { color: bilan.epargne >= 0 ? P.emerald : P.rouge, fontSize: 16 }]}>
                  {fmt(bilan.epargne)}
                </Text>
              </View>
            </View>
          </View>

          {/* Graphique mois par mois */}
          <View style={styles.carte}>
            <View style={styles.carte_header}>
              <BarChart3 size={16} color={P.bleu} strokeWidth={2} />
              <Text style={styles.carte_titre}>Dépenses mois par mois</Text>
            </View>
            <View style={{ marginTop: 16, gap: 8 }}>
              {bilan.par_mois.filter(m => m.total > 0).map(m => {
                const max = Math.max(...bilan.par_mois.map(x => x.total), 1);
                const pct = (m.total / max) * 100;
                const isBest = m.mois === bilan.mois_max;
                return (
                  <View key={m.mois}>
                    <View style={styles.bar_header}>
                      <Text style={[styles.bar_nom, { width: 36 }]}>
                        {NOMS_MOIS[m.mois - 1]}
                      </Text>
                      <View style={[styles.bar_fond, { flex: 1, marginHorizontal: 8 }]}>
                        <View style={[styles.bar_rempli, {
                          width: `${pct}%` as any,
                          backgroundColor: isBest ? P.rouge : P.bleu,
                        }]} />
                      </View>
                      <Text style={[styles.bar_montant, { color: isBest ? P.rouge : P.ardoise }]}>
                        {fmt(m.total)}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {bilan.par_mois.every(m => m.total === 0) && (
                <Text style={styles.vide_sous}>Aucune dépense cette année</Text>
              )}
            </View>
          </View>

          {/* Prêts en cours */}
          {prets.length > 0 && (
            <View style={styles.carte}>
              <View style={styles.carte_header}>
                <FileText size={16} color={P.violet} strokeWidth={2} />
                <Text style={styles.carte_titre}>Prêts en cours</Text>
              </View>
              <View style={{ marginTop: 16, gap: 16 }}>
                {prets.map(p => (
                  <View key={p.id}>
                    <View style={styles.bar_header}>
                      <Text style={[styles.bar_nom, { flex: 1, fontSize: 14, fontWeight: '600' }]}>{p.nom}</Text>
                      <Text style={styles.bar_montant}>{fmt(p.montant_restant)} restant</Text>
                    </View>
                    <View style={styles.bar_fond}>
                      <View style={[styles.bar_rempli, {
                        width: `${p.pct_rembourse}%` as any,
                        backgroundColor: P.emeraldMid,
                      }]} />
                    </View>
                    <View style={[styles.bar_header, { marginTop: 4 }]}>
                      <Text style={[styles.bento_label, { flex: 1 }]}>
                        {Math.round(p.pct_rembourse)}% remboursé · {p.mois_restants} mois restants
                      </Text>
                      <Text style={styles.bento_label}>{fmt(p.mensualite)}/mois</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}

      {/* ══ VUE MENSUELLE ═════════════════════════════════════════════════════ */}
      {onglet === 'mois' && (
        <>

      {/* Score de santé */}
      <View style={styles.carte}>
        <View style={styles.carte_header}>
          <Heart size={16} color={couleur} strokeWidth={2} />
          <Text style={styles.carte_titre}>Score de santé</Text>
        </View>
        <View style={styles.score_row}>
          <Text style={[styles.score_chiffre, { color: couleur }]}>{score}</Text>
          <View style={{ flex: 1, paddingLeft: 16 }}>
            <Text style={[styles.score_niveau, { color: couleur }]}>{niveau}</Text>
            <View style={[styles.bar_fond, { marginTop: 10 }]}>
              <View style={[styles.bar_rempli, { width: `${score}%` as any, backgroundColor: couleur }]} />
            </View>
            <Text style={styles.score_sur}>sur 100 points</Text>
          </View>
        </View>
        <View style={styles.details_list}>
          {details.map((d, i) => (
            <View key={i} style={styles.detail_row}>
              <View style={[styles.detail_dot, { backgroundColor: d.ok ? P.emeraldMid : P.ambre }]} />
              <Text style={styles.detail_texte}>{d.texte}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Prévision fin de mois */}
      <View style={styles.bento_grid}>
        <View style={[styles.bento, { flex: 1.2 }]}>
          <Text style={styles.bento_label}>Solde actuel</Text>
          <Text style={[styles.bento_valeur, { color: solde >= 0 ? P.emeraldMid : P.rouge }]}>
            {fmt(solde)}
          </Text>
        </View>
        <View style={[styles.bento, { flex: 0.8 }]}>
          <Text style={styles.bento_label}>Budget / jour</Text>
          <Text style={styles.bento_valeur}>
            {fmt(joursRestants > 0 ? solde / joursRestants : 0)}
          </Text>
        </View>
      </View>
      <View style={styles.bento_grid}>
        <View style={[styles.bento, { flex: 0.8 }]}>
          <Text style={styles.bento_label}>Jours restants</Text>
          <Text style={styles.bento_valeur}>{joursRestants} j</Text>
        </View>
        <View style={[styles.bento, { flex: 1.2 }]}>
          <Text style={styles.bento_label}>Taux d'épargne</Text>
          <Text style={[styles.bento_valeur, { color: P.emeraldMid }]}>
            {donnees.salaire > 0 ? Math.round((solde / donnees.salaire) * 100) : 0}%
          </Text>
        </View>
      </View>

      {/* Comparaison mois */}
      <ComparaisonSection historique={historique} />

      {/* Graphique catégories */}
      <View style={styles.carte}>
        <View style={styles.carte_header}>
          <BarChart3 size={16} color={P.violet} strokeWidth={2} />
          <Text style={styles.carte_titre}>Dépenses par catégorie</Text>
        </View>
        <View style={{ marginTop: 16 }}>
          <GraphiqueCategories depenses={donnees.depensesList} total={donnees.depenses} />
        </View>
      </View>

      {/* Export PDF */}
      <TouchableOpacity style={styles.btn_pdf} onPress={lancerPDF} disabled={exportEnCours}>
        {exportEnCours
          ? <ActivityIndicator color={P.blanc} />
          : <>
              <FileText size={18} color={P.blanc} strokeWidth={2} />
              <Text style={styles.btn_texte}>Exporter le bilan PDF</Text>
            </>
        }
      </TouchableOpacity>

      {/* Analyse IA */}
      <View style={styles.carte}>
        <View style={styles.carte_header}>
          <Brain size={16} color={P.violet} strokeWidth={2} />
          <Text style={styles.carte_titre}>Analyse IA</Text>
        </View>

        {!donnees.apiKey ? (
          <View style={styles.ia_vide}>
            <Text style={styles.ia_vide_texte}>
              Renseigne ta clé API OpenRouter dans Paramètres pour activer l'analyse.
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.btn_ia, chargementIA && { opacity: 0.7 }]}
            onPress={lancerIA} disabled={chargementIA}>
            {chargementIA
              ? <ActivityIndicator color={P.blanc} />
              : <>
                  <Brain size={18} color={P.blanc} strokeWidth={2} />
                  <Text style={styles.btn_texte}>Analyser mon budget</Text>
                </>
            }
          </TouchableOpacity>
        )}

        {analyseIA.length > 0 && (
          <View style={{ marginTop: 16, gap: 10 }}>
            {analyseIA.split('\n\n').filter(p => p.trim()).map((p, i) => (
              <View key={i} style={styles.ia_para}>
                <Text style={styles.ia_texte}>{p.trim()}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={{ height: 110 }} />

        </> /* fin onglet mois */
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: P.fond },
  contenu: { padding: 20 },

  header: { paddingTop: 56, paddingBottom: 20 },
  header_titre: { fontSize: 28, fontWeight: '800', color: P.ardoise, letterSpacing: -0.5 },
  header_sous: { fontSize: 13, color: P.gris, marginTop: 3 },

  carte: {
    backgroundColor: P.blanc, borderRadius: 20, padding: 20, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  carte_header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  carte_titre: { fontSize: 15, fontWeight: '700', color: P.ardoise },

  score_row: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  score_chiffre: { fontSize: 56, fontWeight: '800', letterSpacing: -2 },
  score_niveau: { fontSize: 16, fontWeight: '700' },
  score_sur: { fontSize: 11, color: P.gris, marginTop: 4 },

  details_list: { marginTop: 16, gap: 8 },
  detail_row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detail_dot: { width: 7, height: 7, borderRadius: 4 },
  detail_texte: { fontSize: 13, color: P.gris },

  bento_grid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  bento: {
    backgroundColor: P.blanc, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  bento_label: { fontSize: 11, color: P.gris, fontWeight: '500', marginBottom: 6 },
  bento_valeur: { fontSize: 20, fontWeight: '700', color: P.ardoise },

  bar_header: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  bar_left: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  // Onglets mois/année
  onglets_row: {
    flexDirection: 'row', gap: 8, marginBottom: 16,
    backgroundColor: P.grisClair, borderRadius: 14, padding: 4,
  },
  onglet_btn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
  },
  onglet_btn_actif: { backgroundColor: P.blanc, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  onglet_texte: { fontSize: 14, fontWeight: '600', color: P.gris },
  onglet_texte_actif: { color: P.ardoise },

  bar_dot: { width: 8, height: 8, borderRadius: 4 },
  bar_nom: { fontSize: 13, color: P.ardoise, fontWeight: '500' },
  bar_montant: { fontSize: 12, fontWeight: '700', color: P.ardoise, marginRight: 8 },
  bar_pct: { fontSize: 12, fontWeight: '700', minWidth: 34, textAlign: 'right' },
  bar_fond: { height: 6, backgroundColor: P.grisClair, borderRadius: 3, overflow: 'hidden' },
  bar_rempli: { height: '100%', borderRadius: 3 },

  btn_pdf: {
    backgroundColor: P.ardoise, borderRadius: 16, padding: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 8, marginBottom: 12,
  },
  btn_ia: {
    backgroundColor: P.violet, borderRadius: 14, padding: 15,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 8, marginTop: 12,
  },
  btn_texte: { color: P.blanc, fontSize: 15, fontWeight: '700' },

  ia_vide: {
    backgroundColor: P.grisClair, borderRadius: 12, padding: 14, marginTop: 12,
  },
  ia_vide_texte: { fontSize: 13, color: P.gris, textAlign: 'center', lineHeight: 20 },
  ia_para: {
    backgroundColor: P.violetLight, borderRadius: 12, padding: 14,
    borderLeftWidth: 3, borderLeftColor: P.violet,
  },
  ia_texte: { fontSize: 14, color: '#3B0764', lineHeight: 22 },

  vide_sous: { fontSize: 13, color: P.gris, textAlign: 'center', paddingVertical: 16 },
});
