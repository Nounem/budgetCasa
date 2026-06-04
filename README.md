# budgetCasa 💰

Application mobile de gestion budget familial — construite avec React Native & Expo.

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

## Lancer le projet

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npx expo start

# Scanner le QR code avec Expo Go (iOS/Android)
```

## Structure du projet

```
src/
├── screens/        # Les 5 écrans de l'app
├── db/             # Base de données SQLite (schema + requêtes)
└── components/     # Composants réutilisables (DonutChart...)
```

## Licence

MIT
