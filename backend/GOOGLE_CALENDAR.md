# Google Calendar : liens Meet automatiques

Dans les formulaires d'**entretien universitaire**, de **Meet optionnel** et de **réunion de préparation visa**, un bouton « Créer le lien Meet automatiquement » crée un événement dans l'agenda d'un compte Google connecté, avec une visioconférence Meet. L'étudiant et la personne qui planifie reçoivent l'invitation Google.

Sans configuration, rien ne change : les liens se collent à la main.

## 1. Google Cloud (une seule fois)

Dans le projet Google Cloud → **Google Auth Platform** :

1. **Clients** → le client OAuth « Application Web » → **URI de redirection autorisés** : ajouter
   - `https://sm.antigoneinterne.agency/api/google/callback` (production)
   - `http://localhost:3001/api/google/callback` (développement local)

   Les adresses sans chemin (`https://sm.antigoneinterne.agency`) ne conviennent pas : Google exige l'adresse exacte du retour.
2. **API et services** → activer **Google Calendar API**.
3. **Audience** (écran de consentement) → passer l'état de « Test » à **« En production »**.
   En mode « Test », Google fait expirer l'accès au bout de **7 jours** et seuls les « utilisateurs test » peuvent se connecter. En production, l'écran affichera « application non validée par Google » : c'est normal pour un usage interne (limite 100 comptes), cliquer sur *Paramètres avancés → Continuer*.

Droits demandés : `calendar.events` (créer des événements, pas lire tout l'agenda), `openid` et `email` (afficher quel compte est connecté).

## 2. Serveur

Dans le `.env` du backend (jamais dans git) :

```
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
# Vide en production : https://sm.antigoneinterne.agency/api/google/callback
GOOGLE_REDIRECT_URI=
```

Puis redémarrer le backend (`docker compose --profile production up -d --build`).

## 3. Connexion du compte

Admin → **Paramètres** → carte **Google Calendar · liens Meet** → **Connecter Google**, choisir le compte qui hébergera les rendez-vous, accepter. Le compte connecté est celui qui apparaît comme organisateur des événements.

## Sécurité

- Le jeton d'accès longue durée est stocké **chiffré** (AES-256-GCM, clé dérivée de `JWT_SECRET`) dans la table `app_settings`, jamais renvoyé par l'API.
- Le retour de Google est protégé par un `state` signé (10 min) lié à l'admin qui a lancé la connexion.
- Seuls l'admin et le RDV assigné au dossier peuvent créer un lien, avec les mêmes règles que la planification. Un anti double-clic de 15 s évite d'envoyer deux invitations.
- « Déconnecter » révoque aussi l'autorisation côté Google.

## Si ça ne marche plus

| Message | Cause | Remède |
|---|---|---|
| « L'accès à Google a expiré ou a été retiré » | autorisation retirée dans le compte Google, ou application restée en mode Test (7 jours) | passer en « En production », reconnecter |
| « Google refuse l'adresse de retour » | l'URI n'est pas déclarée à l'identique | ajouter l'adresse affichée dans Paramètres |
| « Google Calendar n'est pas connecté » | jamais connecté, ou `JWT_SECRET` changé | reconnecter dans Paramètres |
| « Google n'a pas pu créer le lien » | panne Google passagère, Calendar API non activée | réessayer, vérifier l'API activée |
