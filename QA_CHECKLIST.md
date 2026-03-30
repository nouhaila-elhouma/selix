# Selix QA Checklist

## Environnement

- Verifier que `backend/.env` pointe vers la bonne base MySQL.
- Verifier que `selix-expo-app/.env` utilise l'IP locale correcte pour un vrai telephone.
- Lancer `npm run dev` dans `backend`.
- Lancer `npm run start` dans `selix-expo-app`.

## Client

- Inscription et connexion.
- Reprise de session apres relance de l'app.
- Questionnaire complet jusqu'au matching.
- Swipe like/dislike sans crash.
- Ajout et retrait des favoris.
- Chargement des conversations.
- Envoi d'un message.
- Affichage des notifications.

## Commercial

- Connexion avec un compte commercial.
- Chargement du dashboard sans donnees mock.
- Chargement de la liste des leads.
- Mise a jour du statut d'un lead.
- Chargement des visites.
- Chargement des commissions.
- Verification de la prochaine visite sur dashboard.

## Promoteur

- Connexion avec un compte promoteur.
- Chargement du dashboard.
- Chargement de la liste des projets.
- Verification des indicateurs de stock et commissions.

## Admin

- Connexion avec un compte admin.
- Chargement du dashboard global.
- Chargement des rapports.
- Chargement pipeline, commissions, commerciaux et promoteurs.
- Creation d'un utilisateur.
- Changement de role utilisateur.
- Suppression d'un utilisateur non admin courant.

## Build

- `npx tsc --noEmit` passe.
- `node --check server.js` passe.
- Test Android sur appareil reel.
- Test iOS sur appareil reel ou simulateur macOS.
- Build `eas build --platform android --profile preview`.
- Build `eas build --platform ios --profile preview`.

