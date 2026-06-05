# budgetCasa 💰

Application mobile de gestion budget familial — construite avec React Native & Expo.

## Télécharger l'app

### Android APK

> ⚠️ Le lien expire après 30 jours. Relancer `eas build --platform android --profile preview` pour en générer un nouveau.

**Dernier build** : [Télécharger l'APK Android](https://expo.dev/accounts/nounem/projects/mon-budget-app/builds/e57b9462-ce28-4f7f-9fe2-c864b6616ef6)

Pour installer :
1. Télécharge le fichier `.apk` depuis le lien ci-dessus
2. Sur Android → **Réglages → Sécurité → Sources inconnues → Activer**
3. Ouvre le fichier téléchargé et installe

### iOS

Installation via Xcode (gratuit) :
```bash
git clone https://github.com/Nounem/budgetCasa.git
cd budgetCasa
npm install
npx expo run:ios --device
```

## Fonctionnalités

- **Tableau de bord** — solde disponible, budget quotidien, camembert de répartition
- **Dépenses** — ajout, modification et suppression avec catégories
- **Charges fixes** — gestion des prélèvements récurrents (loyer, abonnements...)
- **Prévisions** — score de santé financière, comparaison mois par mois, export PDF
- **Analyse IA** — conseils personnalisés via OpenRouter (Gemma 4, gratuit)
- **Profil famille** — suggestions budget adapté au nombre de personnes et d'enfants

## Stack technique

| Technologie | Rôle |
|---|---|
| React Native + Expo SDK 54 | Framework mobile iOS & Android |
| expo-sqlite | Base de données locale |
| React Navigation | Navigation par onglets |
| lucide-react-native | Icônes |
| react-native-svg | Graphique camembert |
| expo-print + expo-sharing | Export PDF |
| OpenRouter API | Analyse IA |

## Lancer le projet en développement

```bash
npm install
npx expo start
# Scanner le QR code avec Expo Go
```

## Générer un nouveau build Android

```bash
eas build --platform android --profile preview
```

## Structure

```
src/
├── screens/        # 5 écrans (Dashboard, Dépenses, Charges, Prévisions, Paramètres)
├── db/             # SQLite — schema + requêtes
└── components/     # DonutChart SVG
```

## Licence

MIT
