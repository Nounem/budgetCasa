import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, Platform, FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Receipt, CreditCard } from 'lucide-react-native';

import {
  getDepensesMois, ajouterDepense, modifierDepense, supprimerDepense,
  getCategories, Depense, Categorie, BENEFICIAIRES,
} from '../db/queries';

const P = {
  fond: '#F7F6F3', blanc: '#FFFFFF', emerald: '#065F46',
  emeraldMid: '#059669', emeraldLight: '#D1FAE5',
  ardoise: '#1E293B', gris: '#6B7280', grisClair: '#F3F4F6',
  bordure: '#E5E7EB', rouge: '#DC2626', rougeLight: '#FEE2E2',
};

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function getMoisActuel() {
  const d = new Date();
  return { mois: d.getMonth() + 1, annee: d.getFullYear() };
}

// ─── MODAL ────────────────────────────────────────────────────────────────────

function ModalDepense({ visible, categories, depenseAModifier, onFermer, onSauvegarder }: {
  visible: boolean; categories: Categorie[];
  depenseAModifier: Depense | null;
  onFermer: () => void;
  onSauvegarder: (montant: number, desc: string, cat: number | null, id?: number, benef?: string) => void;
}) {
  const [montant, setMontant]       = useState('');
  const [description, setDesc]      = useState('');
  const [categorieId, setCatId]     = useState<number | null>(null);
  const [beneficiaire, setBenef]    = useState('personnel');

  const estMod = depenseAModifier !== null;

  useState(() => {
    if (depenseAModifier) {
      setMontant(depenseAModifier.montant.toString());
      setDesc(depenseAModifier.description || '');
      setCatId(depenseAModifier.categorie_id);
      setBenef(depenseAModifier.beneficiaire || 'personnel');
    } else { setMontant(''); setDesc(''); setCatId(null); setBenef('personnel'); }
  });

  function reset() { setMontant(''); setDesc(''); setCatId(null); setBenef('personnel'); }

  function valider() {
    const m = parseFloat(montant.replace(',', '.'));
    if (isNaN(m) || m <= 0) { Alert.alert('', 'Saisis un montant valide'); return; }
    onSauvegarder(m, description.trim(), categorieId, depenseAModifier?.id, beneficiaire);
    reset(); onFermer();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={ms.container}>
        <View style={ms.header}>
          <TouchableOpacity onPress={() => { reset(); onFermer(); }}>
            <Text style={ms.annuler}>Annuler</Text>
          </TouchableOpacity>
          <Text style={ms.titre}>{estMod ? 'Modifier' : 'Nouvelle dépense'}</Text>
          <TouchableOpacity onPress={valider}>
            <Text style={ms.ok}>{estMod ? 'Modifier' : 'Ajouter'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={ms.corps}>
          <Text style={ms.label}>Montant (€)</Text>
          <TextInput style={ms.input} value={montant} onChangeText={setMontant}
            placeholder="ex: 45" placeholderTextColor="#C4C4C4"
            keyboardType="decimal-pad" autoFocus={!estMod} />

          <Text style={ms.label}>Description (optionnel)</Text>
          <TextInput style={ms.input} value={description} onChangeText={setDesc}
            placeholder="ex: Courses Carrefour" placeholderTextColor="#C4C4C4" />

          {/* Bénéficiaire */}
          <Text style={ms.label}>Pour qui ?</Text>
          <View style={ms.cats}>
            {BENEFICIAIRES.map(b => (
              <TouchableOpacity key={b.id}
                style={[ms.cat, beneficiaire === b.id && { borderColor: '#065F46', backgroundColor: '#D1FAE5' }]}
                onPress={() => setBenef(b.id)}>
                <Text style={{ fontSize: 14 }}>{b.emoji}</Text>
                <Text style={[ms.cat_texte, beneficiaire === b.id && { color: '#065F46', fontWeight: '700' }]}>
                  {b.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={ms.label}>Catégorie</Text>
          <View style={ms.cats}>
            {categories.map(c => (
              <TouchableOpacity key={c.id}
                style={[ms.cat, categorieId === c.id && { borderColor: c.couleur, backgroundColor: c.couleur + '15' }]}
                onPress={() => setCatId(c.id)}>
                <View style={[ms.cat_dot, { backgroundColor: c.couleur }]} />
                <Text style={[ms.cat_texte, categorieId === c.id && { color: c.couleur, fontWeight: '700' }]}>
                  {c.nom}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.fond },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 20, backgroundColor: P.blanc,
    borderBottomWidth: 1, borderBottomColor: P.bordure,
  },
  titre: { fontSize: 16, fontWeight: '700', color: P.ardoise },
  annuler: { fontSize: 15, color: P.gris },
  ok: { fontSize: 15, color: P.emerald, fontWeight: '700' },
  corps: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: P.gris, marginBottom: 8, marginTop: 20, letterSpacing: 0.5 },
  input: {
    backgroundColor: P.blanc, borderWidth: 1, borderColor: P.bordure,
    borderRadius: 12, padding: 14, fontSize: 15, color: P.ardoise,
  },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: P.bordure, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: P.blanc,
  },
  cat_dot: { width: 8, height: 8, borderRadius: 4 },
  cat_texte: { fontSize: 13, color: P.gris },
});

// ─── ITEM DÉPENSE ─────────────────────────────────────────────────────────────

function ItemDepense({ depense, onModifier, onSupprimer }: {
  depense: Depense; onModifier: () => void; onSupprimer: () => void;
}) {
  function menu() {
    Alert.alert(
      depense.description || depense.categorie_nom,
      fmt(depense.montant),
      [
        { text: 'Modifier', onPress: onModifier },
        { text: 'Supprimer', style: 'destructive', onPress: () =>
          Alert.alert('Supprimer ?', 'Supprimer cette dépense ?', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive', onPress: onSupprimer },
          ])
        },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  }

  return (
    <TouchableOpacity style={styles.item} onPress={menu}>
      <View style={[styles.item_icone, { backgroundColor: depense.categorie_couleur + '18' }]}>
        <View style={[styles.item_dot, { backgroundColor: depense.categorie_couleur }]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.item_desc} numberOfLines={1}>
          {depense.description || depense.categorie_nom}
        </Text>
        <Text style={styles.item_cat}>
          {BENEFICIAIRES.find(b => b.id === depense.beneficiaire)?.emoji ?? '👤'}{' '}
          {depense.categorie_nom} · {depense.date}
        </Text>
      </View>
      <Text style={styles.item_montant}>-{fmt(depense.montant)}</Text>
    </TouchableOpacity>
  );
}

// ─── ÉCRAN ────────────────────────────────────────────────────────────────────

export default function Depenses() {
  const [depenses, setDepenses]     = useState<Depense[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [modal, setModal]           = useState(false);
  const [aModifier, setAModifier]   = useState<Depense | null>(null);
  const [filtre, setFiltre]         = useState<string>('tous');

  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web') return;
    charger();
  }, []));

  function charger() {
    const { mois, annee } = getMoisActuel();
    setDepenses(getDepensesMois(mois, annee));
    setCategories(getCategories());
  }

  function handleSauvegarder(montant: number, desc: string, cat: number | null, id?: number, benef: string = 'personnel') {
    if (id !== undefined) modifierDepense(id, montant, desc, cat, benef);
    else ajouterDepense(montant, desc, cat, benef);
    charger();
  }

  const depensesFiltrees = filtre === 'tous'
    ? depenses
    : depenses.filter(d => d.beneficiaire === filtre);

  const total = depensesFiltrees.reduce((s, d) => s + d.montant, 0);

  return (
    <View style={styles.ecran}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.header_titre}>Dépenses</Text>
          <Text style={styles.header_sous}>
            {depenses.length} dépense{depenses.length !== 1 ? 's' : ''} · Appuie pour modifier
          </Text>
        </View>
        <TouchableOpacity style={styles.add_btn}
          onPress={() => { setAModifier(null); setModal(true); }}>
          <Plus size={20} color={P.blanc} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* ── Filtre bénéficiaires ─────────────────── */}
      {depenses.length > 0 && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtres_row}>
          {[{ id: 'tous', label: 'Tous', emoji: '📋' }, ...BENEFICIAIRES].map(b => {
            const count = b.id === 'tous'
              ? depenses.length
              : depenses.filter(d => d.beneficiaire === b.id).length;
            if (b.id !== 'tous' && count === 0) return null;
            return (
              <TouchableOpacity key={b.id}
                style={[styles.filtre_btn, filtre === b.id && styles.filtre_btn_actif]}
                onPress={() => setFiltre(b.id)}>
                <Text style={styles.filtre_emoji}>{b.emoji}</Text>
                <Text style={[styles.filtre_texte, filtre === b.id && styles.filtre_texte_actif]}>
                  {b.label}
                </Text>
                <Text style={[styles.filtre_count, filtre === b.id && styles.filtre_count_actif]}>
                  {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Total du mois */}
      {depenses.length > 0 && (
        <View style={styles.total_carte}>
          <CreditCard size={18} color={P.rouge} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.total_label}>Total dépensé ce mois</Text>
            <Text style={styles.total_montant}>{fmt(total)}</Text>
          </View>
        </View>
      )}

      {/* Liste */}
      <ScrollView style={styles.liste} contentContainerStyle={styles.liste_contenu}
        showsVerticalScrollIndicator={false}>
        {depensesFiltrees.length === 0 ? (
          <View style={styles.vide}>
            <Receipt size={48} color={P.bordure} strokeWidth={1.5} />
            <Text style={styles.vide_titre}>
              {filtre === 'tous' ? 'Aucune dépense ce mois' : 'Aucune dépense ici'}
            </Text>
            <Text style={styles.vide_sous}>
              {filtre === 'tous' ? 'Appuie sur + pour commencer' : 'Essaie un autre filtre'}
            </Text>
          </View>
        ) : (
          depensesFiltrees.map(d => (
            <ItemDepense key={d.id} depense={d}
              onModifier={() => { setAModifier(d); setModal(true); }}
              onSupprimer={() => { supprimerDepense(d.id); charger(); }}
            />
          ))
        )}
        <View style={{ height: 110 }} />
      </ScrollView>

      <ModalDepense visible={modal} categories={categories}
        depenseAModifier={aModifier}
        onFermer={() => { setModal(false); setAModifier(null); }}
        onSauvegarder={handleSauvegarder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: P.fond },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20,
  },
  header_titre: { fontSize: 28, fontWeight: '800', color: P.ardoise, letterSpacing: -0.5 },
  header_sous: { fontSize: 12, color: P.gris, marginTop: 3 },
  add_btn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: P.emerald, justifyContent: 'center', alignItems: 'center',
    shadowColor: P.emerald, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },

  total_carte: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: P.rougeLight, borderRadius: 16, padding: 16,
    borderLeftWidth: 3, borderLeftColor: P.rouge,
  },
  total_label: { fontSize: 12, color: P.rouge, fontWeight: '500' },
  total_montant: { fontSize: 22, fontWeight: '800', color: P.ardoise, marginTop: 2 },

  liste: { flex: 1 },
  liste_contenu: { paddingHorizontal: 20 },

  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: P.blanc, borderRadius: 16, padding: 14,
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  item_icone: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  item_dot: { width: 10, height: 10, borderRadius: 5 },
  item_desc: { fontSize: 14, fontWeight: '600', color: P.ardoise },
  item_cat: { fontSize: 11, color: P.gris, marginTop: 2 },
  item_montant: { fontSize: 15, fontWeight: '700', color: P.rouge },

  vide: { alignItems: 'center', paddingTop: 80, gap: 10 },
  vide_titre: { fontSize: 17, fontWeight: '600', color: P.ardoise },
  vide_sous: { fontSize: 14, color: P.gris },

  // Filtres bénéficiaires
  filtres_row: {
    paddingHorizontal: 20, paddingVertical: 12,
    gap: 8, flexDirection: 'row',
  },
  filtre_btn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: P.blanc, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: P.bordure,
  },
  filtre_btn_actif: {
    backgroundColor: P.emerald, borderColor: P.emerald,
  },
  filtre_emoji: { fontSize: 13 },
  filtre_texte: { fontSize: 13, color: P.gris, fontWeight: '600' },
  filtre_texte_actif: { color: P.blanc },
  filtre_count: {
    fontSize: 11, color: P.gris,
    backgroundColor: P.grisClair, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  filtre_count_actif: { color: P.emerald, backgroundColor: 'rgba(255,255,255,0.25)' },
});
