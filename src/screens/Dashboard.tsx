import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Bell, ArrowDownLeft, ArrowUpRight, Wallet, CalendarDays } from 'lucide-react-native';

import { getProfil, getTotalChargesFixes, getTotalDepensesMois, getDepensesRecentes, getRevenuTotal, Depense } from '../db/queries';
import { DonutChart, Segment } from '../components/DonutChart';

// ─── PALETTE ──────────────────────────────────────────────────────────────────

const P = {
  fond:      '#F7F6F3',  // crème chaud
  blanc:     '#FFFFFF',
  emerald:   '#065F46',  // vert émeraude profond
  emeraldMid:'#059669',
  emeraldLight:'#D1FAE5',
  ardoise:   '#1E293B',
  gris:      '#6B7280',
  grisClair: '#F3F4F6',
  bordure:   '#E5E7EB',
  rouge:     '#DC2626',
  rougeLight:'#FEE2E2',
  ambre:     '#D97706',
  ambreLight:'#FEF3C7',
  violet:    '#7C3AED',
};

// ─── UTILS ────────────────────────────────────────────────────────────────────

function fmt(n: number, decimales = 0): string {
  return n.toLocaleString('fr-FR', {
    style: 'currency', currency: 'EUR',
    maximumFractionDigits: decimales,
    minimumFractionDigits: decimales,
  });
}

function getMois() {
  const d = new Date();
  const noms = ['Janvier','Février','Mars','Avril','Mai','Juin',
                 'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const dernierJour = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return {
    mois: d.getMonth() + 1,
    annee: d.getFullYear(),
    nom: noms[d.getMonth()],
    joursRestants: Math.max(1, dernierJour - d.getDate() + 1),
    jourActuel: d.getDate(),
    totalJours: dernierJour,
  };
}

// ─── CARTE STAT (bento) ───────────────────────────────────────────────────────

function CarteStat({
  label, valeur, couleur = P.ardoise, fond = P.blanc, icone,
  style,
}: {
  label: string; valeur: string; couleur?: string;
  fond?: string; icone: React.ReactNode; style?: object;
}) {
  return (
    <View style={[styles.bento_carte, { backgroundColor: fond }, style]}>
      <View style={styles.bento_icone_wrapper}>{icone}</View>
      <Text style={styles.bento_label}>{label}</Text>
      <Text style={[styles.bento_valeur, { color: couleur }]}>{valeur}</Text>
    </View>
  );
}

// ─── CARTE PRINCIPALE (hero) ──────────────────────────────────────────────────

function HeroCarte({
  solde, joursRestants, jourActuel, totalJours,
}: {
  solde: number;
  joursRestants: number; jourActuel: number; totalJours: number;
}) {
  const positif = solde >= 0;
  const pctMois = (jourActuel / totalJours) * 100;

  return (
    <View style={[styles.hero, { borderLeftColor: positif ? P.emeraldMid : P.rouge }]}>
      <View style={styles.hero_top}>
        <View>
          <Text style={styles.hero_label}>Disponible ce mois</Text>
          <Text style={[styles.hero_montant, { color: positif ? P.emerald : P.rouge }]}>
            {fmt(solde)}
          </Text>
        </View>
        <View style={[styles.hero_badge,
          { backgroundColor: positif ? P.emeraldLight : P.rougeLight }]}>
          {positif
            ? <ArrowUpRight size={18} color={P.emeraldMid} strokeWidth={2.5} />
            : <ArrowDownLeft size={18} color={P.rouge} strokeWidth={2.5} />
          }
        </View>
      </View>

      <View style={styles.hero_barre_fond}>
        <View style={[styles.hero_barre_rempli, {
          width: `${pctMois}%` as any,
          backgroundColor: positif ? P.emeraldMid : P.rouge,
        }]} />
      </View>

      <View style={styles.hero_footer}>
        <Text style={styles.hero_footer_texte}>
          Jour {jourActuel} / {totalJours}
        </Text>
        <Text style={styles.hero_footer_texte}>
          {fmt(joursRestants > 0 ? solde / joursRestants : 0, 0)}/jour restant
        </Text>
      </View>
    </View>
  );
}

// ─── SECTION SUGGESTIONS FAMILLE ─────────────────────────────────────────────

function SuggestionsSection({ salaire, nbPersonnes, nbEnfants }: {
  salaire: number; nbPersonnes: number; nbEnfants: number;
}) {
  if (nbPersonnes <= 1 && nbEnfants === 0) return null;
  const adultes = Math.max(1, nbPersonnes - nbEnfants);
  const suggestions = [
    { label: 'Alimentation',   valeur: adultes * 250 + nbEnfants * 150 },
    { label: 'Transport',      valeur: adultes * 80 },
    { label: 'Santé',          valeur: nbPersonnes * 40 },
    ...(nbEnfants > 0 ? [{ label: 'Activités enfants', valeur: nbEnfants * 80 }] : []),
  ];

  return (
    <View style={styles.suggestions}>
      <Text style={styles.section_titre}>
        Budget recommandé · {nbPersonnes} pers.
      </Text>
      <View style={styles.suggestions_grid}>
        {suggestions.map(s => (
          <View key={s.label} style={styles.suggestion_item}>
            <Text style={styles.suggestion_label}>{s.label}</Text>
            <Text style={styles.suggestion_valeur}>{fmt(s.valeur)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.suggestion_epargne}>
        <Text style={styles.suggestion_epargne_label}>Épargne minimum recommandée (10%)</Text>
        <Text style={styles.suggestion_epargne_valeur}>{fmt(salaire * 0.10)}/mois</Text>
      </View>
    </View>
  );
}

// ─── ÉCRAN ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [d, setD] = useState({
    nom: '', salaire: 0, charges: 0, depenses: 0,
    recentes: [] as Depense[], nbPersonnes: 1, nbEnfants: 0, pret: false,
  });

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return;
      const { mois, annee } = getMois();
      const profil = getProfil();
      setD({
        nom: profil?.nom ?? '',
        salaire: getRevenuTotal(),
        charges: getTotalChargesFixes(),
        depenses: getTotalDepensesMois(mois, annee),
        recentes: getDepensesRecentes(),
        nbPersonnes: profil?.nombre_personnes ?? 1,
        nbEnfants: profil?.nombre_enfants ?? 0,
        pret: true,
      });
    }, [])
  );

  const { nom, joursRestants, jourActuel, totalJours } = getMois();
  const solde = d.salaire - d.charges - d.depenses;

  const segments: Segment[] = d.salaire > 0 ? [
    { valeur: (d.charges  / d.salaire) * 100, couleur: P.ambre,   label: 'Charges' },
    { valeur: (d.depenses / d.salaire) * 100, couleur: P.rouge,   label: 'Dépenses' },
    { valeur: Math.max(0, (solde    / d.salaire) * 100), couleur: P.emeraldMid, label: 'Épargne' },
  ] : [];

  if (d.salaire === 0 && d.pret) {
    return (
      <View style={styles.vide}>
        <Wallet size={56} color={P.emerald} strokeWidth={1.5} />
        <Text style={styles.vide_titre}>Commençons</Text>
        <Text style={styles.vide_texte}>Renseigne ton salaire dans Paramètres</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.ecran} contentContainerStyle={styles.contenu}
      showsVerticalScrollIndicator={false}>

      {/* ── Header ─────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.header_g}>
          <View style={styles.avatar}>
            <Text style={styles.avatar_lettre}>
              {(d.nom || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.header_greeting}>Bonjour</Text>
            <Text style={styles.header_nom}>{d.nom || 'Utilisateur'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.bell_btn}>
          <Bell size={20} color={P.ardoise} strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      {/* ── Mois ───────────────────────────────────── */}
      <View style={styles.mois_row}>
        <CalendarDays size={14} color={P.gris} strokeWidth={1.8} />
        <Text style={styles.mois_texte}>{nom} · {joursRestants} jours restants</Text>
      </View>

      {/* ── Hero ───────────────────────────────────── */}
      <HeroCarte
        solde={solde}
        joursRestants={joursRestants}
        jourActuel={jourActuel}
        totalJours={totalJours}
      />

      {/* ── Bento stats ────────────────────────────── */}
      <View style={styles.bento_grid}>
        <CarteStat
          label="Salaire"
          valeur={fmt(d.salaire)}
          couleur={P.ardoise}
          icone={<Wallet size={16} color={P.emeraldMid} strokeWidth={2} />}
          style={{ flex: 1.1 }}
        />
        <CarteStat
          label="Charges fixes"
          valeur={fmt(d.charges)}
          couleur={P.ambre}
          fond={P.ambreLight}
          icone={<Repeat2 size={16} color={P.ambre} strokeWidth={2} />}
          style={{ flex: 0.9 }}
        />
      </View>
      <View style={styles.bento_grid}>
        <CarteStat
          label="Dépenses ce mois"
          valeur={fmt(d.depenses)}
          couleur={P.rouge}
          fond={P.rougeLight}
          icone={<CreditCard size={16} color={P.rouge} strokeWidth={2} />}
          style={{ flex: 0.9 }}
        />
        <CarteStat
          label="Épargne prévue"
          valeur={fmt(Math.max(0, solde))}
          couleur={P.emerald}
          fond={P.emeraldLight}
          icone={<ArrowUpRight size={16} color={P.emeraldMid} strokeWidth={2} />}
          style={{ flex: 1.1 }}
        />
      </View>

      {/* ── Répartition ────────────────────────────── */}
      {segments.length > 0 && (
        <View style={styles.repartition}>
          <Text style={styles.section_titre}>Répartition du salaire</Text>
          <View style={styles.repartition_inner}>
            <DonutChart segments={segments} taille={140} couleurFond={P.blanc} />
            <View style={styles.repartition_legende}>
              {[
                { label: 'Charges', couleur: P.ambre, montant: d.charges, pct: d.salaire > 0 ? (d.charges / d.salaire) * 100 : 0 },
                { label: 'Dépenses', couleur: P.rouge, montant: d.depenses, pct: d.salaire > 0 ? (d.depenses / d.salaire) * 100 : 0 },
                { label: 'Épargne', couleur: P.emeraldMid, montant: Math.max(0, solde), pct: d.salaire > 0 ? Math.max(0, (solde / d.salaire) * 100) : 0 },
              ].map(l => (
                <View key={l.label} style={styles.legende_item}>
                  <View style={[styles.legende_dot, { backgroundColor: l.couleur }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.legende_label}>{l.label}</Text>
                    <Text style={styles.legende_montant}>{fmt(l.montant)}</Text>
                  </View>
                  <Text style={[styles.legende_pct, { color: l.couleur }]}>
                    {Math.round(l.pct)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* ── Suggestions famille ────────────────────── */}
      <SuggestionsSection
        salaire={d.salaire}
        nbPersonnes={d.nbPersonnes}
        nbEnfants={d.nbEnfants}
      />

      {/* ── Dernières dépenses ─────────────────────── */}
      {d.recentes.length > 0 && (
        <View style={styles.recentes}>
          <Text style={styles.section_titre}>Récent</Text>
          {d.recentes.map(dep => (
            <View key={dep.id} style={styles.depense_item}>
              <View style={[styles.depense_icone, { backgroundColor: dep.categorie_couleur + '20' }]}>
                <View style={[styles.depense_dot, { backgroundColor: dep.categorie_couleur }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.depense_desc} numberOfLines={1}>
                  {dep.description || dep.categorie_nom}
                </Text>
                <Text style={styles.depense_cat}>{dep.categorie_nom}</Text>
              </View>
              <Text style={styles.depense_montant}>-{fmt(dep.montant)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Espace pour la tab bar flottante */}
      <View style={{ height: 110 }} />
    </ScrollView>
  );
}

// Icônes importées pour CarteStat
import { Repeat2, CreditCard } from 'lucide-react-native';

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: P.fond },
  contenu: { paddingHorizontal: 20 },

  vide: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: P.fond, gap: 12, padding: 32,
  },
  vide_titre: { fontSize: 22, fontWeight: '700', color: P.ardoise },
  vide_texte: { fontSize: 15, color: P.gris, textAlign: 'center' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingBottom: 8,
  },
  header_g: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  header_greeting: { fontSize: 12, color: P.gris, letterSpacing: 0.3 },
  header_nom: { fontSize: 18, fontWeight: '700', color: P.ardoise },
  avatar: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: P.emerald, justifyContent: 'center', alignItems: 'center',
  },
  avatar_lettre: { fontSize: 18, fontWeight: '700', color: P.blanc },
  bell_btn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: P.blanc, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },

  mois_row: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 16, marginTop: 4,
  },
  mois_texte: { fontSize: 12, color: P.gris, fontWeight: '500' },

  // Hero
  hero: {
    backgroundColor: P.blanc, borderRadius: 20, padding: 20,
    marginBottom: 12, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
  },
  hero_top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  hero_label: { fontSize: 12, color: P.gris, fontWeight: '500', marginBottom: 4, letterSpacing: 0.5 },
  hero_montant: { fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  hero_badge: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  hero_barre_fond: { height: 4, backgroundColor: P.grisClair, borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  hero_barre_rempli: { height: '100%', borderRadius: 2 },
  hero_footer: { flexDirection: 'row', justifyContent: 'space-between' },
  hero_footer_texte: { fontSize: 11, color: P.gris },

  // Bento
  bento_grid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  bento_carte: {
    flex: 1, borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  bento_icone_wrapper: { marginBottom: 10 },
  bento_label: { fontSize: 11, color: P.gris, fontWeight: '500', marginBottom: 4 },
  bento_valeur: { fontSize: 17, fontWeight: '700' },

  // Répartition
  repartition: {
    backgroundColor: P.blanc, borderRadius: 20, padding: 20,
    marginTop: 4, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
  },
  repartition_inner: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  repartition_legende: { flex: 1, gap: 10 },
  legende_item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legende_dot: { width: 8, height: 8, borderRadius: 4 },
  legende_label: { fontSize: 12, color: P.gris },
  legende_montant: { fontSize: 13, fontWeight: '700', color: P.ardoise },
  legende_pct: { fontSize: 12, fontWeight: '700' },

  // Section titre
  section_titre: {
    fontSize: 15, fontWeight: '700', color: P.ardoise,
    marginBottom: 12, letterSpacing: -0.2,
  },

  // Suggestions
  suggestions: {
    backgroundColor: P.blanc, borderRadius: 20, padding: 18,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  suggestions_grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  suggestion_item: {
    backgroundColor: P.grisClair, borderRadius: 12, padding: 10,
    minWidth: '45%', flex: 1,
  },
  suggestion_label: { fontSize: 11, color: P.gris, marginBottom: 4 },
  suggestion_valeur: { fontSize: 14, fontWeight: '700', color: P.ardoise },
  suggestion_epargne: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: P.emeraldLight, borderRadius: 12, padding: 12,
  },
  suggestion_epargne_label: { fontSize: 12, color: P.emerald, flex: 1 },
  suggestion_epargne_valeur: { fontSize: 14, fontWeight: '700', color: P.emerald },

  // Recentes
  recentes: {
    backgroundColor: P.blanc, borderRadius: 20, padding: 18,
    marginBottom: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  depense_item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  depense_icone: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  depense_dot: { width: 10, height: 10, borderRadius: 5 },
  depense_desc: { fontSize: 14, fontWeight: '600', color: P.ardoise },
  depense_cat: { fontSize: 11, color: P.gris, marginTop: 1 },
  depense_montant: { fontSize: 14, fontWeight: '700', color: P.rouge },
});
