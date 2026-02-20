# DieselExpress - PRD (Product Requirements Document)

## Problème original
Créer une application capable d'accepter des commandes pour la livraison de carburant diesel.

## Choix utilisateur
- **Type de carburant**: Diesel uniquement
- **Clients cibles**: Professionnels principalement + Particuliers (min. 20L)
- **Paiement**: À la livraison
- **Authentification**: JWT (email/mot de passe)
- **Fonctionnalités**: Historique des commandes, suivi de statut

## Architecture

### Stack technique
- **Frontend**: React 19, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI (Python)
- **Base de données**: MongoDB
- **Authentification**: JWT avec bcrypt

### Structure des données

#### User
```json
{
  "id": "uuid",
  "email": "string",
  "password": "hashed",
  "user_type": "pro | particulier",
  "full_name": "string",
  "company_name": "string (optional)",
  "phone": "string",
  "address": "string",
  "city": "string",
  "postal_code": "string",
  "created_at": "datetime"
}
```

#### Order
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "quantity": "int (min 20)",
  "price_fuel": "float",
  "delivery_fee": "float (15€)",
  "total_price": "float",
  "delivery_address": "string",
  "delivery_city": "string",
  "delivery_postal_code": "string",
  "delivery_date": "string",
  "delivery_time_slot": "string",
  "status": "pending | confirmed | in_delivery | delivered | cancelled",
  "notes": "string (optional)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

## User Personas

### Professionnel (Pro)
- Gestionnaire de flotte, agriculteur, entrepreneur BTP
- Commandes régulières et volumineuses
- Besoin de facturation entreprise
- Suivi détaillé des dépenses

### Particulier
- Propriétaire de véhicule diesel ou système de chauffage
- Commandes ponctuelles (min. 20L)
- Livraison à domicile
- Interface simple et intuitive

## Ce qui a été implémenté (Janvier 2026)

### Backend API
- [x] POST /api/auth/register - Inscription utilisateur
- [x] POST /api/auth/login - Connexion
- [x] GET /api/auth/me - Profil utilisateur
- [x] GET /api/pricing - Tarification
- [x] GET /api/stats - Statistiques utilisateur
- [x] POST /api/orders - Créer commande
- [x] GET /api/orders - Liste des commandes
- [x] GET /api/orders/{id} - Détail commande
- [x] PUT /api/orders/{id}/status - Mettre à jour statut
- [x] DELETE /api/orders/{id} - Annuler commande

### Frontend Pages
- [x] Landing page avec présentation service
- [x] Page de connexion (split design)
- [x] Page d'inscription (avec choix Pro/Particulier)
- [x] Dashboard avec statistiques
- [x] Formulaire nouvelle commande (step wizard 4 étapes)
- [x] Historique des commandes avec filtres
- [x] Détail commande avec suivi de statut

### Design
- [x] Theme "Industrial Trust": Oil Navy (#0F172A) + Fuel Amber (#F59E0B)
- [x] Typography: Barlow Condensed (headings) + Inter (body)
- [x] Interface entièrement en français
- [x] Responsive mobile

## Backlog (Priorité)

### P0 (Critique)
- [ ] Notifications email pour changement de statut
- [ ] Panel admin pour gérer les commandes

### P1 (Important)
- [ ] Intégration paiement en ligne (Stripe)
- [ ] Géolocalisation pour calcul de zone de livraison
- [ ] Commandes récurrentes pour Pro

### P2 (Nice to have)
- [ ] Application mobile native
- [ ] Suivi GPS en temps réel du livreur
- [ ] Programme de fidélité
- [ ] Export factures PDF

## Prochaines étapes
1. Ajouter un panel admin pour la gestion des commandes
2. Intégrer notifications email (SendGrid/Resend)
3. Ajouter paiement en ligne Stripe
