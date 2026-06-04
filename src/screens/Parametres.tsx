import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  User, Wallet, Users, Baby, Key, CheckCircle2, Minus, Plus,
} from 'lucide-react-native';
import { getProfil, sauvegarderProfil } from '../db/queries';

const P = {
  fond: '#F7F6F3', blanc: '#FFFFFF', emerald: '#065F46',
  emeraldMid: '#059669', emeraldLight: '#D1FAE5',
  ardoise: '#1E293B', gris: '#6B7280', grisClair: '#F3F4F6',
  bordure: '#E5E7EB',
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

// ─── ÉCRAN ────────────────────────────────────────────────────────────────────

export default function Parametres() {
  const [nom, setNom]             = useState('');
  const [salaire, setSalaire]     = useState('');
  const [nbPersonnes, setNbPers]  = useState(1);
  const [nbEnfants, setNbEnf]     = useState(0);
  const [apiKey, setApiKey]       = useState('');
  const [sauvegarde, setSauvegarde] = useState(false);

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
  }, []);

  function enregistrer() {
    if (WEB) {
      Alert.alert('Info', 'Sauvegarde disponible uniquement sur mobile.');
      return;
    }
    if (!nom.trim()) { Alert.alert('Champ manquant', 'Saisis ton prénom'); return; }
    const s = parseFloat(salaire.replace(',', '.'));
    if (isNaN(s) || s <= 0) { Alert.alert('Champ manquant', 'Saisis un salaire valide'); return; }
    if (nbEnfants > nbPersonnes) { Alert.alert('Erreur', 'Enfants > personnes'); return; }
    sauvegarderProfil(nom.trim(), s, nbPersonnes, nbEnfants, apiKey.trim());
    setSauvegarde(true);
    setTimeout(() => setSauvegarde(false), 2500);
  }

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

          <Champ label="Prénom"
            icone={<User size={15} color={P.emeraldMid} strokeWidth={2} />}>
            <TextInput style={styles.input} value={nom} onChangeText={setNom}
              placeholder="Ton prénom" placeholderTextColor="#C4C4C4" />
          </Champ>

          <View style={styles.separateur} />

          <Champ label="Salaire mensuel net"
            icone={<Wallet size={15} color={P.emeraldMid} strokeWidth={2} />}>
            <View style={styles.input_row}>
              <TextInput style={[styles.input, { flex: 1 }]} value={salaire}
                onChangeText={setSalaire} placeholder="ex: 3 500"
                placeholderTextColor="#C4C4C4" keyboardType="decimal-pad" />
              <View style={styles.devise_badge}>
                <Text style={styles.devise_texte}>EUR</Text>
              </View>
            </View>
          </Champ>
        </View>

        {/* Section Famille */}
        <View style={styles.section_carte}>
          <Text style={styles.section_label}>MA FAMILLE</Text>

          <Champ label="Personnes au foyer"
            icone={<Users size={15} color={P.emeraldMid} strokeWidth={2} />}>
            <Text style={styles.champ_aide}>Toi + conjoint(e) + enfants</Text>
            <Compteur valeur={nbPersonnes} min={1} max={10} onChange={setNbPers} />
          </Champ>

          <View style={styles.separateur} />

          <Champ label="Dont enfants à charge"
            icone={<Baby size={15} color={P.emeraldMid} strokeWidth={2} />}>
            <Compteur valeur={nbEnfants} min={0} max={nbPersonnes} onChange={setNbEnf} />
          </Champ>
        </View>

        {/* Section IA */}
        <View style={styles.section_carte}>
          <Text style={styles.section_label}>INTELLIGENCE ARTIFICIELLE</Text>

          <Champ label="Clé API OpenRouter"
            icone={<Key size={15} color={P.emeraldMid} strokeWidth={2} />}>
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
        <TouchableOpacity
          style={[styles.bouton, sauvegarde && styles.bouton_ok]}
          onPress={enregistrer}>
          {sauvegarde
            ? <CheckCircle2 size={20} color={P.blanc} strokeWidth={2.5} />
            : null
          }
          <Text style={styles.bouton_texte}>
            {sauvegarde ? 'Enregistré !' : 'Enregistrer'}
          </Text>
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
});
