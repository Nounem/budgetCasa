import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import {
  User, Wallet, Users, Baby, Key, CheckCircle2, Minus, Plus, Trash2,
} from 'lucide-react-native';
import {
  getProfil, sauvegarderProfil,
  getRevenus, ajouterRevenu, modifierRevenu, toggleRevenu, supprimerRevenu, Revenu,
} from '../db/queries';

const P = {
  fond: '#F7F6F3', blanc: '#FFFFFF', emerald: '#065F46',
  emeraldMid: '#059669', emeraldLight: '#D1FAE5',
  ardoise: '#1E293B', gris: '#6B7280', grisClair: '#F3F4F6',
  bordure: '#E5E7EB', ambre: '#D97706',
};
const WEB = Platform.OS === 'web';

// ─── COMPTEUR ─────────────────────────────────────────────────────────────────

function Compteur({ valeur, min, max, onChange }: {
  valeur: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <View style={styles.compteur}>
      <TouchableOpacity
        style={[styles.cpt_btn, valeur <= min && styles.cpt_btn_disabled]}
        onPress={() => valeur > min && onChange(valeur - 1)}>
        <Minus size={16} color={valeur <= min ? P.gris : P.emerald} strokeWidth={2.5} />
      </TouchableOpacity>
      <Text style={styles.cpt_valeur}>{valeur}</Text>
      <TouchableOpacity
        style={[styles.cpt_btn, valeur >= max && styles.cpt_btn_disabled]}
        onPress={() => valeur < max && onChange(valeur + 1)}>
        <Plus size={16} color={valeur >= max ? P.gris : P.emerald} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

// ─── CHAMP DE SAISIE ──────────────────────────────────────────────────────────

function Champ({ label, icone, children }: {
  label: string; icone: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <View style={styles.champ}>
      <View style={styles.champ_label_row}>
        {icone}
        <Text style={styles.champ_label}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── TYPES REVENUS ────────────────────────────────────────────────────────────

const TYPES_REVENU = [
  { id: 'salaire',     label: 'Salaire complémentaire' },
  { id: 'allocation',  label: 'Allocation / CAF' },
  { id: 'freelance',   label: 'Freelance / Auto-entrepreneur' },
  { id: 'loyer',       label: 'Loyer perçu' },
  { id: 'autre',       label: 'Autre revenu' },
];

// ─── ÉCRAN ────────────────────────────────────────────────────────────────────

export default function Parametres() {
  const [nom, setNom]               = useState('');
  const [salaire, setSalaire]       = useState('');
  const [nbPersonnes, setNbPers]    = useState(1);
  const [nbEnfants, setNbEnf]       = useState(0);
  const [apiKey, setApiKey]         = useState('');
  const [sauvegarde, setSauvegarde] = useState(false);
  const [revenus, setRevenus]       = useState<Revenu[]>([]);
  const [showModal, setShowModal]   = useState(false);
  const [nomR, setNomR]             = useState('');
  const [montantR, setMontantR]     = useState('');
  const [typeR, setTypeR]           = useState('autre');
  const [periodiciteR, setPerR]     = useState<'mensuel' | 'ponctuel'>('mensuel');
  const [moisR, setMoisR]           = useState(new Date().getMonth() + 1);
  const [anneeR, setAnneeR]         = useState(new Date().getFullYear());

  useEffect(() => {
    if (WEB) return;
    const p = getProfil();
    if (p) {
      setNom(p.nom);
      setSalaire(p.salaire.toString());
      setNbPers(p.nombre_personnes);
      setNbEnf(p.nombre_enfants);
      setApiKey(p.api_key_cerebras || '');
    }
    setRevenus(getRevenus());
  }, []);

  function enregistrer() {
    if (WEB) { Alert.alert('Info', 'Sauvegarde disponible uniquement sur mobile.'); return; }
    if (!nom.trim()) { Alert.alert('Champ manquant', 'Saisis ton prénom'); return; }
    const s = parseFloat(salaire.replace(',', '.'));
    if (isNaN(s) || s <= 0) { Alert.alert('Champ manquant', 'Saisis un salaire valide'); return; }
    if (nbEnfants > nbPersonnes) { Alert.alert('Erreur', 'Enfants > personnes'); return; }
    sauvegarderProfil(nom.trim(), s, nbPersonnes, nbEnfants, apiKey.trim());
    setSauvegarde(true);
    setTimeout(() => setSauvegarde(false), 2500);
  }

  function ajouterR() {
    const m = parseFloat(montantR.replace(',', '.'));
    if (!nomR.trim() || isNaN(m) || m <= 0) { Alert.alert('', 'Remplis tous les champs'); return; }
    ajouterRevenu(nomR.trim(), m, typeR, periodiciteR, periodiciteR === 'ponctuel' ? moisR : undefined, periodiciteR === 'ponctuel' ? anneeR : undefined);
    setRevenus(getRevenus());
    setNomR(''); setMontantR(''); setTypeR('autre'); setPerR('mensuel');
    setShowModal(false);
  }

  function supprimerR(id: number) {
    Alert.alert('Supprimer ?', 'Supprimer ce revenu ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => {
        supprimerRevenu(id);
        setRevenus(getRevenus());
      }},
    ]);
  }

  const totalRevenus = revenus.filter(r => r.actif === 1).reduce((s, r) => s + r.montant, 0);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.ecran} contentContainerStyle={styles.contenu}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.header_titre}>Paramètres</Text>
          <Text style={styles.header_sous}>Personnalise ton profil</Text>
        </View>

        {/* Section Profil */}
        <View style={styles.section_carte}>
          <Text style={styles.section_label}>MON PROFIL</Text>
          <Champ label="Prénom" icone={<User size={15} color={P.emeraldMid} strokeWidth={2} />}>
            <TextInput style={styles.input} value={nom} onChangeText={setNom}
              placeholder="Ton prénom" placeholderTextColor="#C4C4C4" />
          </Champ>
          <View style={styles.separateur} />
          <Champ label="Salaire mensuel net" icone={<Wallet size={15} color={P.emeraldMid} strokeWidth={2} />}>
            <View style={styles.input_row}>
              <TextInput style={[styles.input, { flex: 1 }]} value={salaire}
                onChangeText={setSalaire} placeholder="ex: 3 500"
                placeholderTextColor="#C4C4C4" keyboardType="decimal-pad" />
              <View style={styles.devise_badge}><Text style={styles.devise_texte}>EUR</Text></View>
            </View>
          </Champ>
        </View>

        {/* Section Revenus complémentaires */}
        <View style={styles.section_carte}>
          <View style={styles.section_header_row}>
            <Text style={styles.section_label}>AUTRES REVENUS</Text>
            <TouchableOpacity style={styles.mini_btn} onPress={() => setShowModal(true)}>
              <Plus size={14} color={P.emerald} strokeWidth={2.5} />
              <Text style={styles.mini_btn_texte}>Ajouter</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.champ_aide}>
            Allocations, freelance, loyer perçu, prêt personnel à rembourser...
          </Text>

          {revenus.length === 0 ? (
            <Text style={styles.vide_texte}>Aucun revenu complémentaire</Text>
          ) : (
            <>
              {revenus.map(r => (
                <View key={r.id} style={styles.revenu_item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.revenu_nom}>{r.nom}</Text>
                    <Text style={styles.revenu_type}>
                      {TYPES_REVENU.find(t => t.id === r.type)?.label ?? r.type}
                    </Text>
                  </View>
                  <Text style={styles.revenu_montant}>
                    +{r.montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                  </Text>
                  <Switch
                    value={r.actif === 1}
                    onValueChange={() => { toggleRevenu(r.id, r.actif); setRevenus(getRevenus()); }}
                    trackColor={{ true: P.emeraldMid, false: P.bordure }}
                    thumbColor={P.blanc}
                  />
                  <TouchableOpacity onPress={() => supprimerR(r.id)} style={{ paddingLeft: 8 }}>
                    <Trash2 size={16} color={P.gris} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.revenu_total}>
                <Text style={styles.revenu_total_label}>Total revenus complémentaires</Text>
                <Text style={styles.revenu_total_montant}>
                  +{totalRevenus.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}/mois
                </Text>
              </View>
            </>
          )}

          {/* Modal ajout revenu */}
          {showModal && (
            <View style={styles.modal_inline}>
              <Text style={styles.modal_titre}>Nouveau revenu complémentaire</Text>

              <TextInput style={styles.input} value={nomR} onChangeText={setNomR}
                placeholder="ex: Allocations CAF, Loyer perçu..." placeholderTextColor="#C4C4C4" />
              <TextInput style={[styles.input, { marginTop: 10 }]} value={montantR}
                onChangeText={setMontantR} placeholder="Montant (€)"
                placeholderTextColor="#C4C4C4" keyboardType="decimal-pad" />

              {/* Périodicité */}
              <Text style={[styles.section_label, { marginTop: 12 }]}>FRÉQUENCE</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {([
                  { id: 'mensuel', label: '📅 Tous les mois' },
                  { id: 'ponctuel', label: '1️⃣ Une seule fois' },
                ] as const).map(p => (
                  <TouchableOpacity key={p.id}
                    style={[styles.type_option, { flex: 1, justifyContent: 'center',
                      backgroundColor: periodiciteR === p.id ? P.emeraldLight : P.blanc,
                      borderRadius: 10, borderWidth: 1,
                      borderColor: periodiciteR === p.id ? P.emerald : P.bordure,
                    }]}
                    onPress={() => setPerR(p.id)}>
                    <Text style={[styles.type_label, { textAlign: 'center',
                      color: periodiciteR === p.id ? P.emerald : P.gris, fontWeight: '600',
                    }]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Mois/Année si ponctuel */}
              {periodiciteR === 'ponctuel' && (
                <View style={{ backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, color: P.ambre, marginBottom: 8, fontWeight: '600' }}>
                    ⚡ Ce revenu ne sera compté que pour ce mois précis
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.section_label, { marginBottom: 4 }]}>MOIS</Text>
                      <Compteur valeur={moisR} min={1} max={12} onChange={setMoisR} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.section_label, { marginBottom: 4 }]}>ANNÉE</Text>
                      <Compteur valeur={anneeR} min={2024} max={2030} onChange={setAnneeR} />
                    </View>
                  </View>
                </View>
              )}

              <Text style={[styles.section_label, { marginTop: 8 }]}>TYPE</Text>
              {TYPES_REVENU.map(t => (
                <TouchableOpacity key={t.id} style={styles.type_option} onPress={() => setTypeR(t.id)}>
                  <View style={[styles.type_radio, typeR === t.id && styles.type_radio_actif]} />
                  <Text style={styles.type_label}>{t.label}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.modal_btns}>
                <TouchableOpacity style={styles.modal_btn_annuler}
                  onPress={() => { setShowModal(false); setNomR(''); setMontantR(''); setPerR('mensuel'); }}>
                  <Text style={{ color: P.gris, fontWeight: '600' }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modal_btn_ok} onPress={ajouterR}>
                  <Text style={{ color: P.blanc, fontWeight: '700' }}>Ajouter</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Section Famille */}
        <View style={styles.section_carte}>
          <Text style={styles.section_label}>MA FAMILLE</Text>
          <Champ label="Personnes au foyer" icone={<Users size={15} color={P.emeraldMid} strokeWidth={2} />}>
            <Text style={styles.champ_aide}>Toi + conjoint(e) + enfants</Text>
            <Compteur valeur={nbPersonnes} min={1} max={10} onChange={setNbPers} />
          </Champ>
          <View style={styles.separateur} />
          <Champ label="Dont enfants à charge" icone={<Baby size={15} color={P.emeraldMid} strokeWidth={2} />}>
            <Compteur valeur={nbEnfants} min={0} max={nbPersonnes} onChange={setNbEnf} />
          </Champ>
        </View>

        {/* Section IA */}
        <View style={styles.section_carte}>
          <Text style={styles.section_label}>INTELLIGENCE ARTIFICIELLE</Text>
          <Champ label="Clé API OpenRouter" icone={<Key size={15} color={P.emeraldMid} strokeWidth={2} />}>
            <Text style={styles.champ_aide}>Obtiens ta clé gratuite sur openrouter.ai</Text>
            <TextInput style={styles.input} value={apiKey} onChangeText={setApiKey}
              placeholder="sk-or-..." placeholderTextColor="#C4C4C4"
              secureTextEntry autoCapitalize="none" autoCorrect={false} />
            {apiKey.length > 0 && (
              <View style={styles.api_ok}>
                <CheckCircle2 size={14} color={P.emeraldMid} strokeWidth={2} />
                <Text style={styles.api_ok_texte}>Clé renseignée · Analyse IA activée</Text>
              </View>
            )}
          </Champ>
        </View>

        {/* Bouton */}
        <TouchableOpacity style={[styles.bouton, sauvegarde && styles.bouton_ok]} onPress={enregistrer}>
          {sauvegarde ? <CheckCircle2 size={20} color={P.blanc} strokeWidth={2.5} /> : null}
          <Text style={styles.bouton_texte}>{sauvegarde ? 'Enregistré !' : 'Enregistrer'}</Text>
        </TouchableOpacity>

        <View style={{ height: 110 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: P.fond },
  contenu: { padding: 20 },

  header: { paddingTop: 56, paddingBottom: 24 },
  header_titre: { fontSize: 28, fontWeight: '800', color: P.ardoise, letterSpacing: -0.5 },
  header_sous: { fontSize: 14, color: P.gris, marginTop: 4 },

  section_carte: {
    backgroundColor: P.blanc, borderRadius: 20, padding: 20,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  section_label: {
    fontSize: 11, fontWeight: '700', color: P.gris,
    letterSpacing: 1.2, marginBottom: 16,
  },

  champ: { marginBottom: 4 },
  champ_label_row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  champ_label: { fontSize: 14, fontWeight: '600', color: P.ardoise },
  champ_aide: { fontSize: 12, color: P.gris, marginBottom: 10 },

  separateur: { height: 1, backgroundColor: P.bordure, marginVertical: 16 },

  input: {
    backgroundColor: P.grisClair, borderRadius: 12,
    padding: 14, fontSize: 15, color: P.ardoise,
    borderWidth: 1, borderColor: P.bordure,
  },
  input_row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  devise_badge: {
    backgroundColor: P.emeraldLight, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 14,
  },
  devise_texte: { fontSize: 14, fontWeight: '700', color: P.emerald },

  compteur: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cpt_btn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: P.emeraldLight, justifyContent: 'center', alignItems: 'center',
  },
  cpt_btn_disabled: { backgroundColor: P.grisClair },
  cpt_valeur: { fontSize: 26, fontWeight: '700', color: P.ardoise, minWidth: 36, textAlign: 'center' },

  api_ok: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, padding: 10, backgroundColor: P.emeraldLight, borderRadius: 10,
  },
  api_ok_texte: { fontSize: 12, color: P.emerald, fontWeight: '600' },

  bouton: {
    backgroundColor: P.emerald, borderRadius: 16,
    padding: 17, flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 8, marginTop: 8,
  },
  bouton_ok: { backgroundColor: P.emeraldMid },
  bouton_texte: { color: P.blanc, fontSize: 16, fontWeight: '700' },

  // Revenus
  section_header_row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  mini_btn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, backgroundColor: P.emeraldLight, borderRadius: 8 },
  mini_btn_texte: { fontSize: 12, color: P.emerald, fontWeight: '700' },
  vide_texte: { fontSize: 13, color: P.gris, textAlign: 'center', paddingVertical: 12 },
  revenu_item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: P.bordure,
  },
  revenu_nom: { fontSize: 14, fontWeight: '600', color: P.ardoise },
  revenu_type: { fontSize: 11, color: P.gris, marginTop: 2 },
  revenu_montant: { fontSize: 14, fontWeight: '700', color: P.emeraldMid },
  revenu_total: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, padding: 12, backgroundColor: P.emeraldLight, borderRadius: 10,
  },
  revenu_total_label: { fontSize: 12, color: P.emerald },
  revenu_total_montant: { fontSize: 15, fontWeight: '800', color: P.emerald },

  // Modal inline
  modal_inline: {
    marginTop: 16, padding: 16, backgroundColor: P.grisClair,
    borderRadius: 16, borderWidth: 1, borderColor: P.bordure,
  },
  modal_titre: { fontSize: 15, fontWeight: '700', color: P.ardoise, marginBottom: 12 },
  type_option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  type_radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: P.bordure },
  type_radio_actif: { borderColor: P.emerald, backgroundColor: P.emerald },
  type_label: { fontSize: 13, color: P.ardoise },
  modal_btns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modal_btn_annuler: {
    flex: 1, padding: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: P.blanc, borderWidth: 1, borderColor: P.bordure,
  },
  modal_btn_ok: {
    flex: 1, padding: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: P.emerald,
  },
});
