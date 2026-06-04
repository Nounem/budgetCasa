import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, Platform, Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Repeat2 } from 'lucide-react-native';

import {
  getChargesFixes, ajouterChargeFix, modifierChargeFix,
  toggleChargeFix, supprimerChargeFix,
  getCategories, ChargeFix, Categorie,
} from '../db/queries';

const P = {
  fond: '#F7F6F3', blanc: '#FFFFFF', emerald: '#065F46',
  emeraldMid: '#059669', emeraldLight: '#D1FAE5',
  ardoise: '#1E293B', gris: '#6B7280', grisClair: '#F3F4F6',
  bordure: '#E5E7EB', rouge: '#DC2626', rougeLight: '#FEE2E2',
  ambre: '#D97706', ambreLight: '#FEF3C7',
};

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

// ─── MODAL ────────────────────────────────────────────────────────────────────

function ModalCharge({ visible, categories, chargeAModifier, onFermer, onSauvegarder }: {
  visible: boolean; categories: Categorie[];
  chargeAModifier: ChargeFix | null;
  onFermer: () => void;
  onSauvegarder: (nom: string, montant: number, cat: number | null, jour: number, id?: number) => void;
}) {
  const [nom, setNom]             = useState('');
  const [montant, setMontant]     = useState('');
  const [categorieId, setCatId]   = useState<number | null>(null);
  const [jour, setJour]           = useState('1');

  const estMod = chargeAModifier !== null;

  useState(() => {
    if (chargeAModifier) {
      setNom(chargeAModifier.nom);
      setMontant(chargeAModifier.montant.toString());
      setCatId(chargeAModifier.categorie_id);
      setJour(chargeAModifier.jour_prelevement.toString());
    } else { setNom(''); setMontant(''); setCatId(null); setJour('1'); }
  });

  function reset() { setNom(''); setMontant(''); setCatId(null); setJour('1'); }

  function valider() {
    if (!nom.trim()) { Alert.alert('', 'Saisis un nom'); return; }
    const m = parseFloat(montant.replace(',', '.'));
    if (isNaN(m) || m <= 0) { Alert.alert('', 'Montant invalide'); return; }
    onSauvegarder(nom.trim(), m, categorieId, Math.min(28, Math.max(1, parseInt(jour) || 1)), chargeAModifier?.id);
    reset(); onFermer();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={ms.container}>
        <View style={ms.header}>
          <TouchableOpacity onPress={() => { reset(); onFermer(); }}>
            <Text style={ms.annuler}>Annuler</Text>
          </TouchableOpacity>
          <Text style={ms.titre}>{estMod ? 'Modifier' : 'Nouvelle charge'}</Text>
          <TouchableOpacity onPress={valider}>
            <Text style={ms.ok}>{estMod ? 'Modifier' : 'Ajouter'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={ms.corps}>
          <Text style={ms.label}>Nom</Text>
          <TextInput style={ms.input} value={nom} onChangeText={setNom}
            placeholder="Loyer, Netflix, EDF..." placeholderTextColor="#C4C4C4" autoFocus={!estMod} />

          <Text style={ms.label}>Montant mensuel (€)</Text>
          <TextInput style={ms.input} value={montant} onChangeText={setMontant}
            placeholder="ex: 850" placeholderTextColor="#C4C4C4" keyboardType="decimal-pad" />

          <Text style={ms.label}>Jour de prélèvement</Text>
          <TextInput style={[ms.input, { width: 90 }]} value={jour} onChangeText={setJour}
            keyboardType="number-pad" placeholderTextColor="#C4C4C4" />

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

// ─── ITEM CHARGE ──────────────────────────────────────────────────────────────

function ItemCharge({ charge, onToggle, onModifier, onSupprimer }: {
  charge: ChargeFix; onToggle: () => void;
  onModifier: () => void; onSupprimer: () => void;
}) {
  const actif = charge.actif === 1;

  function menu() {
    Alert.alert(charge.nom, fmt(charge.montant) + '/mois', [
      { text: 'Modifier', onPress: onModifier },
      { text: 'Supprimer', style: 'destructive', onPress: () =>
        Alert.alert('Supprimer ?', `Supprimer "${charge.nom}" ?`, [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Supprimer', style: 'destructive', onPress: onSupprimer },
        ])
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }

  return (
    <TouchableOpacity style={[styles.item, !actif && { opacity: 0.45 }]} onPress={menu}>
      <View style={[styles.item_dot, { backgroundColor: charge.categorie_couleur }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.item_nom}>{charge.nom}</Text>
        <Text style={styles.item_sous}>{charge.categorie_nom} · le {charge.jour_prelevement}</Text>
      </View>
      <Text style={styles.item_montant}>{fmt(charge.montant)}</Text>
      <Switch value={actif} onValueChange={onToggle}
        trackColor={{ true: P.emeraldMid, false: P.bordure }}
        thumbColor={P.blanc} />
    </TouchableOpacity>
  );
}

// ─── ÉCRAN ────────────────────────────────────────────────────────────────────

export default function Charges() {
  const [charges, setCharges]         = useState<ChargeFix[]>([]);
  const [categories, setCategories]   = useState<Categorie[]>([]);
  const [modalVisible, setModal]      = useState(false);
  const [aModifier, setAModifier]     = useState<ChargeFix | null>(null);

  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web') return;
    charger();
  }, []));

  function charger() {
    setCharges(getChargesFixes());
    setCategories(getCategories('fixe'));
  }

  function handleSauvegarder(nom: string, montant: number, cat: number | null, jour: number, id?: number) {
    if (id !== undefined) modifierChargeFix(id, nom, montant, cat, jour);
    else ajouterChargeFix(nom, montant, cat, jour);
    charger();
  }

  const total = charges.filter(c => c.actif === 1).reduce((s, c) => s + c.montant, 0);

  return (
    <View style={styles.ecran}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.header_titre}>Charges fixes</Text>
          <Text style={styles.header_sous}>{charges.length} charge{charges.length !== 1 ? 's' : ''} · Appuie pour modifier</Text>
        </View>
        <TouchableOpacity style={styles.add_btn}
          onPress={() => { setAModifier(null); setModal(true); }}>
          <Plus size={20} color={P.blanc} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* Total */}
      {charges.length > 0 && (
        <View style={styles.total_carte}>
          <Repeat2 size={18} color={P.ambre} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.total_label}>Total prélevé chaque mois</Text>
            <Text style={styles.total_montant}>{fmt(total)}</Text>
          </View>
        </View>
      )}

      {/* Liste */}
      <ScrollView style={styles.liste} contentContainerStyle={styles.liste_contenu}
        showsVerticalScrollIndicator={false}>
        {charges.length === 0 ? (
          <View style={styles.vide}>
            <Repeat2 size={48} color={P.bordure} strokeWidth={1.5} />
            <Text style={styles.vide_titre}>Aucune charge fixe</Text>
            <Text style={styles.vide_sous}>Loyer, abonnements, crédits...</Text>
          </View>
        ) : (
          charges.map(c => (
            <ItemCharge key={c.id} charge={c}
              onToggle={() => { toggleChargeFix(c.id, c.actif); charger(); }}
              onModifier={() => { setAModifier(c); setModal(true); }}
              onSupprimer={() => { supprimerChargeFix(c.id); charger(); }}
            />
          ))
        )}
        <View style={{ height: 110 }} />
      </ScrollView>

      <ModalCharge visible={modalVisible} categories={categories}
        chargeAModifier={aModifier}
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
    backgroundColor: P.ambreLight, borderRadius: 16, padding: 16,
    borderLeftWidth: 3, borderLeftColor: P.ambre,
  },
  total_label: { fontSize: 12, color: P.ambre, fontWeight: '500' },
  total_montant: { fontSize: 22, fontWeight: '800', color: P.ardoise, marginTop: 2 },

  liste: { flex: 1 },
  liste_contenu: { paddingHorizontal: 20 },

  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: P.blanc, borderRadius: 16, padding: 16,
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  item_dot: { width: 10, height: 10, borderRadius: 5 },
  item_nom: { fontSize: 15, fontWeight: '600', color: P.ardoise },
  item_sous: { fontSize: 12, color: P.gris, marginTop: 2 },
  item_montant: { fontSize: 15, fontWeight: '700', color: P.ardoise, marginRight: 8 },

  vide: { alignItems: 'center', paddingTop: 80, gap: 10 },
  vide_titre: { fontSize: 17, fontWeight: '600', color: P.ardoise },
  vide_sous: { fontSize: 14, color: P.gris },
});
