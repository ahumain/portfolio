# Portfolio Node.js — README 
[FR] Voir ci-dessous · [EN] See English section after the French one

Ce dépôt contient un portfolio développé en Node.js/Express avec EJS côté vues. Ce document présente uniquement les aspects techniques: stack, architecture, configuration, exécution, routes et sécurité.

## Stack

- Runtime: Node.js 18+
- Serveur: Express.js
- Templates: EJS
- Front: CSS (variables) + JavaScript vanilla
- Email: Nodemailer + SMTP OVH (ssl0.ovh.net)

## Architecture applicative

- `server.js`
  - Initialise Express, EJS, fichiers statiques (`/public`), parsers (urlencoded/json)
  - Déclare les routes (pages + API) et la gestion centralisée des erreurs (404 + 4xx/5xx)
  - Configure Nodemailer (OVH) et le handler POST `/contact` (validation + double envoi)
  - Expose un jeu de données `portfolioData` (profil, skills, projets, liens)
- Vues EJS (`/views`)
  - `index.ejs`, `about.ejs`, `projects.ejs`, `contact.ejs`, `faq.ejs`, `cv.ejs`, `error.ejs`, `layout.ejs`
  - La FAQ supporte un mode intégré via `?embed=1` (enlève nav/footer dans l’iframe)
- Front (`/public`)
  - `css/style.css`: responsive, grilles, typographie, animations
  - `js/script.js`: menu mobile, animation des barres de compétences (IntersectionObserver), ajustement auto de l’iframe FAQ

## Configuration (variables d’environnement)

Créer un fichier `.env` à partir de `.env.example` (ne jamais commit):

- `EMAIL_USER` (adresse OVH)
- `EMAIL_PASS` (mot de passe OVH)
- `CONTACT_EMAIL` (destinataire propriétaire; fallback: EMAIL_USER)
- `PORT` (par défaut 3000)
- `NODE_ENV` (development/production)

Notes SMTP OVH:
- Hôte: `ssl0.ovh.net`
- Port: 587 (`secure=false`) ou 465 (`secure=true`)

## Routes principales

GET:
- `/` Accueil
- `/about` À propos
- `/projects` Projets
- `/contact` Contact (le bas de page intègre la FAQ via iframe)
- `/cv` Aperçu PDF
- `/faq` Page FAQ (support `?embed=1` pour iframe)

Développement uniquement:
- `/test-email` Vérification configuration SMTP (désactivé en production)
- `/test-contact` Formulaire HTML de test POST (désactivé en production)

POST:
- `/contact` Envoi du formulaire (validation serveur, notification propriétaire + accusé client)

## Envoi d’emails (Nodemailer + OVH)

- Transport configuré depuis `EMAIL_USER/EMAIL_PASS`
- À la soumission du formulaire: 
  - Email vers le propriétaire (récapitulatif complet, Reply-To = expéditeur)
  - Email de confirmation vers le client (accusé + copie du message)
- Gestion d’erreurs: réponse JSON explicite côté API

## Structure du projet

```
public/
  css/style.css
  js/script.js
  images/
views/
  index.ejs  about.ejs  projects.ejs  contact.ejs
  faq.ejs    cv.ejs     error.ejs     layout.ejs
server.js
package.json
.env.example
test-contact.html
```

## Exécution locale

1) Installer les dépendances
```
npm install
```
2) Configurer `.env` (voir section Configuration)
3) Lancer en dev
```
npm run dev
# http://localhost:3000
```
4) Production
```
NODE_ENV=production npm start
```

## Déploiement (générique)

- Déployer l’appli Node derrière un reverse proxy (Nginx/Caddy) ou via PM2
- Définir les variables d’environnement sur la plateforme cible
- Servir les assets statiques depuis `/public`

## Sécurité & bonnes pratiques

- Ne pas commit `.env` (le `.gitignore` les exclut; utiliser `.env.example` pour documenter)
- Valider côté serveur: email, champs obligatoires (déjà implémenté)
- Journalisation: logs console côté serveur (adapter selon besoin)
- En prod: activer TLS au niveau du reverse proxy, ajouter rate limiting/WAF si nécessaire

## Licence

MIT (voir `package.json`).

---

## Technical README (EN)

This repository contains a portfolio built with Node.js/Express and EJS. This document focuses strictly on technical aspects: stack, architecture, configuration, run/deploy, routes, and security.

### Stack

- Runtime: Node.js 18+
- Server: Express.js
- Templates: EJS
- Front: CSS (variables) + vanilla JavaScript
- Email: Nodemailer + OVH SMTP (ssl0.ovh.net)

### Application architecture

- `server.js`
  - Sets up Express, EJS, static files (`/public`), and parsers (urlencoded/json)
  - Declares routes (pages + API) and centralized error handling (404 + 4xx/5xx)
  - Configures Nodemailer (OVH) and the POST `/contact` handler (validation + dual email)
  - Hosts `portfolioData` (profile, skills, projects, social links)
- Views (`/views`)
  - `index.ejs`, `about.ejs`, `projects.ejs`, `contact.ejs`, `faq.ejs`, `cv.ejs`, `error.ejs`, `layout.ejs`
  - FAQ supports an embedded mode via `?embed=1` (hides header/footer in iframe)
- Front (`/public`)
  - `css/style.css`: responsive layout, grids, typography, animations
  - `js/script.js`: mobile nav, skills progress animations (IntersectionObserver), FAQ iframe auto-resize

### Configuration (environment)

Create `.env` from `.env.example` (never commit `.env`):

- `EMAIL_USER` (OVH address)
- `EMAIL_PASS` (OVH password)
- `CONTACT_EMAIL` (owner recipient; fallback: EMAIL_USER)
- `PORT` (defaults to 3000)
- `NODE_ENV` (development/production)

OVH SMTP notes:
- Host: `ssl0.ovh.net`
- Port: 587 (`secure=false`) or 465 (`secure=true`)

### Routes

GET:
- `/` Home
- `/about` About
- `/projects` Projects
- `/contact` Contact (FAQ embedded at the bottom via iframe)
- `/cv` PDF preview
- `/faq` FAQ page (supports `?embed=1` for iframe)

Development only:
- `/test-email` Check SMTP configuration (disabled in production)
- `/test-contact` HTML form to test POST (disabled in production)

POST:
- `/contact` Form submission (server-side validation, owner notification + client confirmation)

### Email (Nodemailer + OVH)

- Transport uses `EMAIL_USER/EMAIL_PASS`
- On form submission:
  - Owner receives a detailed notification (Reply-To set to sender)
  - Client receives a confirmation copy
- Error handling: JSON responses on API errors

### Project structure

```
public/
  css/style.css
  js/script.js
  images/
views/
  index.ejs  about.ejs  projects.ejs  contact.ejs
  faq.ejs    cv.ejs     error.ejs     layout.ejs
server.js
package.json
.env.example
test-contact.html
```

### Local run

1) Install deps
```
npm install
```
2) Configure `.env`
3) Start dev
```
npm run dev
# http://localhost:3000
```
4) Production
```
NODE_ENV=production npm start
```

### Deployment (generic)

- Run Node app behind a reverse proxy (Nginx/Caddy) or via PM2
- Set required environment variables on the target platform
- Serve static assets from `/public`

### Security & best practices

- Do not commit `.env` (ignored by `.gitignore`; use `.env.example` for docs)
- Validate server-side inputs (email, required fields – already implemented)
- Configure logging according to your needs
- In production: terminate TLS at the proxy and consider rate limiting/WAF

### License

MIT (see `package.json`).
