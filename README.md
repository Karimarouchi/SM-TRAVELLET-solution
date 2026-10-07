# SM Travelle — Plateforme de gestion

SM Travelle est une agence spécialisée dans l'accompagnement des étudiants pour leurs projets d'études et de voyage à l'étranger (visas, programmes, accompagnement administratif). Ce document liste l'ensemble des fonctionnalités déjà développées et fonctionnelles sur le site vitrine et sur l'application de gestion.

Le projet est composé de trois parties :
- **Site vitrine** (public, visible par tout le monde).
- **Application connectée** (étudiants, conseillers, responsables visa, administrateurs).
- **Backend** : le serveur qui fait fonctionner l'ensemble (base de données, sécurité, emails, sauvegardes, etc.).

---

## 1. Site vitrine (public)

- **Page d'accueil** : bannière de présentation de l'agence avec appel à l'action.
- **Programmes / destinations** : liste des programmes proposés, alimentée automatiquement depuis l'application (pas de mise à jour manuelle du site nécessaire).
- **Services** : présentation des prestations de l'agence (accompagnement visa, dossier, etc.).
- **Méthode** : explication du déroulé de l'accompagnement.
- **À propos** : présentation de l'agence.
- **Témoignages** : avis clients, alimentés automatiquement depuis l'application (validés par l'agence avant publication).
- **FAQ** : questions fréquentes.
- **Bandeau d'appel à l'action** et **formulaire de contact**.
- **Pages légales** : mentions légales, politique de confidentialité, politique de cookies, politique d'annulation/remboursement, conditions générales de vente — accessibles en fenêtre modale ou en pages dédiées.
- **Page de paiement** : page dédiée au règlement des prestations (maquette visuelle prête ; le raccordement à un prestataire de paiement réel reste à faire, voir section 5).

---

## 2. Application connectée

L'application est organisée en quatre espaces selon le type de compte : **Étudiant**, **Conseiller (Sales)**, **Responsable Dossier Visa (RDV)** et **Administrateur**. Un même utilisateur peut cumuler plusieurs rôles (par exemple un conseiller qui est aussi responsable visa).

### Espace Étudiant

- **Inscription sécurisée** avec vérification de l'adresse email obligatoire (code à 8 chiffres envoyé par email avant de pouvoir accéder à son dossier).
- **Questionnaire d'intégration (onboarding)** : coordonnées, niveau d'études, pays et université visés, niveau de langue, budget, etc.
- **Choix des destinations et de l'université** parmi une liste tenue à jour par l'agence.
- **Dépôt des documents du dossier** (passeport, diplômes, relevés, etc.), avec suivi en temps réel du statut de chaque document (en attente / validé / refusé avec motif).
- **Suivi automatique de l'avancement du dossier**, présenté comme une frise chronologique claire : documents validés → dossier prêt → candidature déposée → entretien éventuel → décision de l'université → transfert au responsable visa → préparation du dossier visa → dépôt → décision finale (visa accepté ou refusé), avec à chaque instant une étape mise en avant pour que l'étudiant sache exactement où il en est.
- **Confirmation de son propre entretien** : l'étudiant peut indiquer lui-même qu'il a passé son entretien universitaire (en plus du conseiller), tous les entretiens se faisant en ligne.
- **Documents spécifiques au visa** une fois le dossier transféré au responsable visa (configurés par destination par l'agence).
- **Messagerie instantanée** avec son conseiller : conversation dédiée, mise à jour automatique, sélecteur d'émojis, compteur de messages non lus, et notifications automatiques (email + message) envoyées par le système à chaque étape clé (document validé/refusé, candidature déposée, entretien planifié, décision, étape visa) sans action manuelle du conseiller.
- **Chat d'assistance** accessible depuis n'importe quelle page de l'espace étudiant.
- **Espace "Accélérateur"** : feuille de route visuelle qui résume où en est l'étudiant dans son parcours.
- **Profil personnel** : photo, identité, coordonnées, dépôt d'un avis/témoignage sur l'agence.

### Espace Conseiller (Sales)

- **Liste des étudiants suivis**, avec recherche et pagination, affichable en tableau ou en cartes.
- **Fiche détaillée par étudiant**, organisée en deux vues : une vue d'ensemble (profil, documents, candidature) et un **historique complet** qui fusionne en une seule chronologie tous les événements du dossier (documents, candidature, visa) **et** les messages échangés avec l'étudiant.
- **Validation ou refus des documents déposés**, avec motif obligatoire en cas de refus (le motif est automatiquement transmis à l'étudiant par message).
- **Pilotage de la candidature universitaire** : déclaration du dépôt, planification d'un entretien (en ligne), saisie de la décision de l'université (accepté/refusé), transfert du dossier au responsable visa une fois l'étudiant accepté — avec **répartition équitable automatique** si aucun responsable visa n'est spécifiquement rattaché à la destination, et une confirmation claire avant transfert.
- **Codes de parrainage / d'activation** personnalisés par destination, permettant de pré-remplir certaines informations du futur étudiant (niveau d'études, niveau recherché, téléphone) qui ne pourra plus les modifier lui-même.
- **Commissions** : le conseiller voit dans son espace le total qu'il a gagné et le détail par étudiant, dès que l'agence a configuré un taux pour les étapes concernées (voir plus bas).
- **Messagerie instantanée** avec tous ses étudiants, centralisée dans un seul espace.

### Espace Responsable Dossier Visa (RDV)

- **Vue dédiée des dossiers visa qui lui sont attribués**, avec le nom de l'étudiant, l'université et la destination concernées.
- **Spécialisation par destination** : chaque responsable visa peut être rattaché à un ou plusieurs pays par l'administrateur, et gère automatiquement les documents visa de ces pays sans permission supplémentaire à demander.
- **Pilotage de l'étape visa** : marquer le dossier comme déposé, puis enregistrer la décision (visa accepté ou refusé avec motif obligatoire).
- **Commissions** : comme pour le conseiller, le responsable visa voit ses propres gains dans son espace.
- **Historique conservé** : en cas de refus, l'étudiant peut relancer une nouvelle candidature sans jamais perdre la trace de la précédente.
- **Réattribution possible par l'admin** : un étudiant peut être déplacé d'un responsable visa à un autre à tout moment, sans perdre l'avancement du dossier, avec la raison tracée dans l'historique.

### Back-office Administrateur

- **Tableau de bord global** : vue d'ensemble de tous les dossiers étudiants et de leur avancement.
- **Attribution des étudiants aux conseillers**, automatique ou manuelle.
- **Gestion des comptes** : création et activation/désactivation des comptes conseillers et responsables visa.
- **Gestion fine des droits d'accès** : possibilité de confier à une personne une responsabilité précise (gérer les programmes, gérer les pays/universités, ou gérer uniquement les documents visa) sans lui donner un accès administrateur complet — y compris pour les comptes déjà Sales ou RDV.
- **Attribution des destinations** prises en charge par chaque responsable visa, et vue des étudiants actuellement attribués à chacun (avec possibilité de réattribution directe).
- **Gestion des programmes** proposés (création, modification, suppression, visuel), publiés automatiquement sur le site vitrine.
- **Gestion des destinations (pays)**, avec création automatique dès qu'une nouvelle destination est renseignée dans un programme.
- **Gestion des documents requis par destination**, dans deux écrans distincts : les documents du dossier universitaire, et les documents visa (accessibles séparément, y compris par un responsable visa limité à ses propres pays).
- **Gestion des universités proposées par destination**, dans lesquelles l'étudiant choisit son établissement.
- **Commissions** : configuration d'un montant fixe en dinars par destination, par rôle (Sales ou RDV) et par étape du parcours (étudiant inscrit via un code, documents validés, candidature déposée, candidature acceptée, visa déposé, visa accepté) — chaque commission est versée par l'agence une seule fois par étudiant, jamais par l'étudiant lui-même. Un registre complet montre qui a gagné quoi, quand, pour quel étudiant.
- **Modération des avis clients** publiés sur le site vitrine (validation, modification, suppression).
- **Sauvegarde de la base de données** : copie automatique vers une base de secours toutes les 12h, avec vérification quotidienne et alerte email en cas de problème, plus un bouton pour déclencher une sauvegarde immédiate à tout moment.
- **Compte administrateur de secours** créé automatiquement au déploiement, sans jamais apparaître dans les journaux du serveur pour des raisons de sécurité.

---

## 3. Sécurité et fiabilité

- Connexion protégée par mot de passe chiffré et jetons de sécurité (JWT).
- Protection contre les tentatives de connexion abusives (brute force), activée automatiquement en production.
- Vérification obligatoire de l'adresse email à l'inscription.
- Historique complet et non modifiable de chaque candidature et de chaque décision : rien n'est jamais écrasé, tout reste consultable.
- Toutes les erreurs techniques sont enregistrées dans des journaux persistants sur le serveur (et non plus seulement affichées à l'écran), pour pouvoir déboguer un incident après coup.
- Sauvegarde régulière et automatique de la base de données vers un serveur distinct, avec alerte immédiate en cas d'échec.
- Toutes les informations sensibles (mots de passe, accès à la base de données, identifiants d'envoi d'email) sont stockées de façon confidentielle, jamais visibles dans le code ni dans les journaux.

---

## 4. Préparation à la mise en production

- **Conteneurisation complète** : l'application (backend + frontend) est prête à être déployée en une seule commande sur un serveur, sans configuration manuelle supplémentaire.
- **Sauvegardes automatiques** décrites ci-dessus, avec procédure de restauration manuelle documentée en cas de besoin réel (jamais automatique, pour ne jamais écraser des données valides par erreur).

---

## 5. Ce qu'il reste à faire

- **Traduction anglaise du site vitrine public** : l'application connectée (espaces étudiant/conseiller/admin) est déjà bilingue français/anglais ; le site public (page d'accueil, programmes, pages légales) reste pour l'instant uniquement en français.
- **Dépôt des documents visa côté étudiant** : l'agence peut déjà configurer, par destination, la liste des documents visa à fournir ; l'écran permettant à l'étudiant de les déposer lui-même (comme il le fait pour les documents du dossier) reste à construire.
- **Paiement en ligne réel** : la page de paiement existe visuellement, mais n'est pas encore raccordée à un prestataire de paiement (carte bancaire, virement, etc.) pour un encaissement réel.

---

## Démarrage technique (usage interne)

```bash
# Installer les dépendances (racine, frontend, backend)
npm run install:all

# Démarrer la base de données PostgreSQL
npm run dev:db

# Démarrer le backend (API)
npm run dev:backend

# Démarrer le frontend (application React)
npm run dev:frontend
```

Pour un **VPS vierge** (Ubuntu/Debian, rien d’installé), copiez le projet sur le serveur puis :

```bash
sudo bash deploy/install-vps.sh
```

Le script installe Docker, génère les secrets, construit et démarre PostgreSQL, l’API, la vitrine, l’application (`/app/`) et le HTTPS automatique. Détail : `deploy/README.md`.

Redéploiement après mise à jour du code :

```bash
docker compose --profile production up -d --build
```

La vitrine publique (`index.html`) peut être ouverte directement dans un navigateur ou servie localement (voir `lancer-site-local.ps1`).
