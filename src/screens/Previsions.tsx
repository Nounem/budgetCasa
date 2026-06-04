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
  Depense, MoisResume, DepenseParCategorie,
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
  depensesTotal: number, nbPersonnes: number, nbEnfants: number, nomMois: string
): Promise<string> {
  const parCat: Record<string, number> = {};
  depenses.forEach(d => { parCat[d.categorie_nom] = (parCat[d.categorie_nom] || 0) + d.montant; });
  const resume = Object.entries(parCat).map(([c, m]) => `${c}: ${m.toFixed(0)}€`).join(', ');

  const prompt = `Tu es un conseiller financier expert. Analyse ce budget mensuel en français.
IMPORTANT: Réponds en texte simple uniquement. Pas de markdown, pas d'astérisques. Utilise des phrases et des sauts de ligne.

PROFIL: Foyer de ${nbPersonnes} personne(s) dont ${nbEnfants} enfant(s)
MOIS: ${nomMois}
SALAIRE NET: ${salaire}€
CHARGES FIXES: ${charges}€ (${((charges/salaire)*100).toFixed(0)}%)
DÉPENSES: ${depensesTotal}€ (${((depensesTotal/salaire)*100).toFixed(0)}%)
SOLDE: ${(salaire - charges - depensesTotal).toFixed(0)}€
DÉTAIL: ${resume || 'Aucune dépense'}

4 paragraphes séparés par une ligne vide: constat général, points positifs, axes d'amélioration, conseil actionnable.`;

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
  parCat: DepenseParCategorie[], analyseIA: string, nomMois: string, annee: number
) {
  const solde = salaire - charges - depenses;
  const lignes = parCat.map(c => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9">${c.categorie_nom}</td>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">
        ${c.total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
    <style>
      body{font-family:Arial,sans-serif;color:#1e293b;padding:40px;max-width:700px;margin:auto}
      h1{color:#065F46;border-bottom:3px solid #065F46;padding-bottom:12px}
      h2{color:#374151;margin-top:32px}
      .card{background:#f8fafc;border-radius:12px;padding:20px;margin:16px 0}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0}
      .solde{font-size:32px;font-weight:bold;color:${solde >= 0 ? '#065F46' : '#dc2626'}}
      table{width:100%;border-collapse:collapse}
      .ia{background:#f5f3ff;border-left:4px solid #7c3aed;padding:16px;border-radius:8px;line-height:1.7}
      .footer{margin-top:40px;color:#94a3b8;font-size:12px;text-align:center}
    </style></head><body>
    <h1>Bilan · ${nomMois} ${annee}</h1>
    <p>Préparé pour <strong>${nom}</strong></p>
    <div class="card">
      <h2>Résumé financier</h2>
      <div class="row"><span>Salaire net</span><strong>${fmt(salaire)}</strong></div>
      <div class="row"><span>Charges fixes</span><strong style="color:#d97706">${fmt(charges)}</strong></div>
      <div class="row"><span>Dépenses variables</span><strong style="color:#dc2626">${fmt(depenses)}</strong></div>
      <div style="padding-top:12px;text-align:right">Solde : <span class="solde">${fmt(solde)}</span></div>
    </div>
    ${parCat.length > 0 ? `<div class="card"><h2>Dépenses par catégorie</h2><table>${lignes}</table></div>` : ''}
    ${analyseIA ? `<div class="card"><h2>Analyse IA</h2><div class="ia">${analyseIA.replace(/\n/g, '<br>')}</div></div>` : ''}
    <div class="footer">Généré par Mon Budget App</div>
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
        donnees.nbPersonnes, donnees.nbEnfants, nomMois
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
        parCat, analyseIA, nomMois, annee
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
