const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const session = require('express-session');
const helmet = require('helmet');
const csrf = require('csurf');
const bcrypt = require('bcryptjs');
require('dotenv').config();
let getPortfolioData = null;
if (
  process.env.DB === 'mariadb' ||
  process.env.DB === 'mysql' ||
  process.env.MARIADB_HOST ||
  process.env.MYSQL_HOST ||
  process.env.MARIADB_URL ||
  process.env.MYSQL_URL
) {
  ({ getPortfolioData } = require('./db-mariadb'));
  console.log('🔗 Base de données: MariaDB/MySQL');
} else {
  ({ getPortfolioData } = require('./db'));
  console.log('🔗 Base de données: SQLite (fichier local)');
}

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-session-secret';

// Configuration email
const EMAIL_CONFIG = {
  // Configuration pour OVH
  host: 'ssl0.ovh.net',
  port: 587,
  secure: false, // true pour port 465, false pour port 587
  auth: {
  user: process.env.EMAIL_USER || 'contact@mathiaslegrand.cloud', // Votre email OVH
  pass: process.env.EMAIL_PASS // Mot de passe de votre email OVH (obligatoire via .env)
  }
};

// Créer le transporteur email
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// Configuration du moteur de template
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Respecter X-Forwarded-* derrière un reverse proxy (Nginx)
app.set('trust proxy', 1);
// Sécurité de base
app.use(helmet());

// Sessions (stockées en MariaDB si activé)
let sessionMiddleware;
try {
  if (
    process.env.DB === 'mariadb' ||
    process.env.DB === 'mysql' ||
    process.env.MARIADB_HOST ||
    process.env.MYSQL_HOST ||
    process.env.MARIADB_URL ||
    process.env.MYSQL_URL
  ) {
    const MySQLStore = require('express-mysql-session')(session);
    // Reconstituer la config depuis l'env (comme db-mariadb)
    const URL = process.env.MARIADB_URL || process.env.MYSQL_URL;
    const store = URL ? new MySQLStore(URL) : new MySQLStore({
      host: process.env.MARIADB_HOST || process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MARIADB_PORT || process.env.MYSQL_PORT || 3306),
      user: process.env.MARIADB_USER || process.env.MYSQL_USER || 'portfolio',
      password: process.env.MARIADB_PASSWORD || process.env.MYSQL_PASSWORD || 'portfolio',
      database: process.env.MARIADB_DATABASE || process.env.MYSQL_DATABASE || 'portfolio',
      createDatabaseTable: true,
      schema: { tableName: 'sessions' },
    });
    sessionMiddleware = session({
      store,
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: !!(process.env.SESSION_SECURE === 'true'),
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 8, // 8h
      },
    });
  }
} catch {}
if (!sessionMiddleware) {
  sessionMiddleware = session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' },
  });
}
app.use(sessionMiddleware);

// Locals for language toggle (compute matching FR/EN paths)
app.use((req, res, next) => {
  const isEn = req.path.startsWith('/en');
  const basePath = isEn ? (req.path.replace(/^\/en/, '') || '/') : req.path;
  res.locals.currentPath = req.path;
  res.locals.frPath = isEn ? (basePath || '/') : basePath;
  res.locals.enPath = isEn ? req.path : (basePath === '/' ? '/en' : '/en' + basePath);
  const baseUrl = (CONFIG_SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  res.locals.siteUrl = baseUrl;
  next();
});

// CSRF protection (after session, after locals)
const csrfProtection = csrf({ ignoreMethods: ['GET', 'HEAD', 'OPTIONS'] });
app.use(csrfProtection);
app.use((req, res, next) => {
  try { res.locals.csrfToken = req.csrfToken ? req.csrfToken() : undefined; } catch {}
  next();
});

// Auth pages (login/logout) and Admin mount with session guard
const ADMIN_PATH = (process.env.ADMIN_PATH || '/__admin').replace(/\/$/, '');
function requireLogin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  // keep target for redirect after login
  const nextUrl = encodeURIComponent(req.originalUrl || ADMIN_PATH);
  return res.redirect(`/login?next=${nextUrl}`);
}

// Login routes
app.get('/login', async (req, res) => {
  const error = req.query.error;
  // If MariaDB active, support first-user setup by email
  let firstUserFlow = false;
  let setupInfo = null;
  try {
    const { getAdminUserCount, createSetupTokenForEmail, getActiveToken } = require('./db-mariadb');
    const adminEmail = process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL || EMAIL_CONFIG.auth.user;
    if (adminEmail) {
      const count = await getAdminUserCount();
      if (count === 0) {
        firstUserFlow = true;
        const existing = await getActiveToken(adminEmail, 'setup');
        const token = existing ? existing.token : await createSetupTokenForEmail(adminEmail, 120);
        const url = `${(CONFIG_SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '')}/setup?token=${encodeURIComponent(token)}`;
        setupInfo = { email: adminEmail, url };
        try {
          await transporter.sendMail({
            from: `"Portfolio Admin" <${EMAIL_CONFIG.auth.user}>`,
            to: adminEmail,
            subject: 'Configuration de votre accès admin',
            text: `Bonjour,\n\nCliquez sur ce lien pour définir votre mot de passe admin: ${url}\nCe lien est valable 2 heures.`,
            html: `<p>Bonjour,</p><p>Cliquez sur ce lien pour définir votre mot de passe admin:</p><p><a href="${url}">${url}</a></p><p>Ce lien est valable 2 heures.</p>`
          });
        } catch (e) {
          console.error('Erreur envoi email setup:', e.message);
        }
      }
    }
  } catch {}
  res.render('admin/login', { error, next: req.query.next || ADMIN_PATH, csrfToken: res.locals.csrfToken, firstUserFlow, setupInfo });
});

app.post('/login', csrfProtection, async (req, res) => {
  const { username, password, next: nextUrl } = req.body || {};
  const expectedUser = process.env.ADMIN_USER || username; // optional, not used in email-first flow
  const hash = process.env.ADMIN_PASSWORD_HASH;
  const pass = process.env.ADMIN_PASS || 'change-me';
  let ok = false;
  // Email-first auth: if ADMIN_EMAIL is set and a user exists in admin_users, validate against DB hash
  try {
    const { getAdminUserByEmail } = require('./db-mariadb');
    const email = (process.env.ADMIN_EMAIL || '').trim();
    if (email) {
      const u = await getAdminUserByEmail(email);
      if (u && u.password_hash) {
        ok = await bcrypt.compare(password || '', u.password_hash);
        if (ok) req.session.username = email;
      }
    }
  } catch {}
  // Fallback to env-based
  if (!ok && username === expectedUser) {
    if (hash) {
      try { ok = await bcrypt.compare(password || '', hash); } catch { ok = false; }
    } else {
      ok = (password || '') === pass;
    }
  }
  if (!ok) return res.redirect('/login?error=1');
  req.session.isAdmin = true;
  req.session.username = expectedUser;
  res.redirect(nextUrl || ADMIN_PATH);
});

app.post('/logout', csrfProtection, (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// First-user setup: GET /setup?token=... renders password form; POST sets password
app.get('/setup', async (req, res) => {
  const token = req.query.token || '';
  res.render('admin/setup', { token, error: req.query.error, csrfToken: res.locals.csrfToken });
});

app.post('/setup', csrfProtection, async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.redirect('/setup?error=1');
  try {
    const { consumeTokenAndSetPassword } = require('./db-mariadb');
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 12);
    const email = await consumeTokenAndSetPassword(token, hash);
    // auto login
    req.session.isAdmin = true;
    req.session.username = email;
    res.redirect(ADMIN_PATH);
  } catch (e) {
    console.error('Setup error:', e.message);
    res.redirect('/setup?error=1');
  }
});

// Admin (hidden route) - only available when MariaDB is active
try {
  if (getPortfolioData && (process.env.DB === 'mariadb' || process.env.MARIADB_HOST || process.env.MARIADB_URL)) {
    const adminRouter = require('./routes/admin');
    app.use(ADMIN_PATH, requireLogin, adminRouter);
  }
} catch {}

// Route to trigger a password reset email for the admin
app.post('/admin/reset-password', requireLogin, csrfProtection, async (req, res, next) => {
  try {
    const { createResetTokenForEmail } = require('./db-mariadb');
    const adminEmail = process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL || EMAIL_CONFIG.auth.user;
    if (!adminEmail) return res.status(400).send('ADMIN_EMAIL manquant');
    const token = await createResetTokenForEmail(adminEmail, 120);
    const url = `${(CONFIG_SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '')}/setup?token=${encodeURIComponent(token)}`;
    await transporter.sendMail({
      from: `"Portfolio Admin" <${EMAIL_CONFIG.auth.user}>`,
      to: adminEmail,
      subject: 'Réinitialisation de votre mot de passe admin',
      text: `Cliquez sur ce lien pour réinitialiser votre mot de passe: ${url}\nValide 2 heures.`,
      html: `<p>Cliquez sur ce lien pour réinitialiser votre mot de passe:</p><p><a href="${url}">${url}</a></p><p>Valide 2 heures.</p>`
    });
    if ((req.get('accept')||'').includes('application/json')) return res.json({ ok: true });
    res.redirect(ADMIN_PATH);
  } catch (e) {
    next(e);
  }
});

// Helper to load data (FR/EN) from DB with proper i18n
async function loadData() {
  const [frRaw, enRaw] = await Promise.all([
    Promise.resolve(getPortfolioData('fr')),
    Promise.resolve(getPortfolioData('en')),
  ]);
  const frOrdered = {
    ...frRaw,
    skills: [...(frRaw.skills || [])].sort((a, b) => (b.level - a.level) || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })),
  };
  const enOrdered = {
    ...enRaw,
    skills: [...(enRaw.skills || [])].sort((a, b) => (b.level - a.level) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })),
  };
  return { fr: frOrdered, en: enOrdered };
}
let portfolioData = {};
let portfolioDataEn = {};

// Routes
app.get('/', async (req, res, next) => {
  try {
    ({ fr: portfolioData, en: portfolioDataEn } = await loadData());
    res.render('index', { data: portfolioData });
  } catch (e) { next(e); }
});

app.get('/about', async (req, res, next) => {
  try {
    ({ fr: portfolioData, en: portfolioDataEn } = await loadData());
    res.render('about', { data: portfolioData });
  } catch (e) { next(e); }
});

app.get('/projects', async (req, res, next) => {
  try {
    ({ fr: portfolioData, en: portfolioDataEn } = await loadData());
    res.render('projects', { data: portfolioData });
  } catch (e) { next(e); }
});

app.get('/contact', async (req, res, next) => {
  try {
    ({ fr: portfolioData, en: portfolioDataEn } = await loadData());
    res.render('contact', { data: portfolioData });
  } catch (e) { next(e); }
});

// Page CV (aperçu intégré du PDF)
app.get('/cv', async (req, res, next) => {
  try {
    ({ fr: portfolioData, en: portfolioDataEn } = await loadData());
    res.render('cv', { data: portfolioData });
  } catch (e) { next(e); }
});

// Page FAQ dédiée
app.get('/faq', async (req, res, next) => {
  try {
    ({ fr: portfolioData, en: portfolioDataEn } = await loadData());
    const embed = req.query.embed === '1';
    res.render('faq', { data: portfolioData, embed });
  } catch (e) { next(e); }
});

// English pages
app.get('/en', async (req, res, next) => {
  try {
    ({ fr: portfolioData, en: portfolioDataEn } = await loadData());
    res.render('en/index', { data: portfolioDataEn });
  } catch (e) { next(e); }
});

app.get('/en/about', async (req, res, next) => {
  try {
    ({ fr: portfolioData, en: portfolioDataEn } = await loadData());
    res.render('en/about', { data: portfolioDataEn });
  } catch (e) { next(e); }
});

app.get('/en/projects', async (req, res, next) => {
  try {
    ({ fr: portfolioData, en: portfolioDataEn } = await loadData());
    res.render('en/projects', { data: portfolioDataEn });
  } catch (e) { next(e); }
});

app.get('/en/contact', async (req, res, next) => {
  try {
    ({ fr: portfolioData, en: portfolioDataEn } = await loadData());
    res.render('en/contact', { data: portfolioDataEn });
  } catch (e) { next(e); }
});

app.get('/en/cv', async (req, res, next) => {
  try {
    ({ fr: portfolioData, en: portfolioDataEn } = await loadData());
    res.render('en/cv', { data: portfolioDataEn });
  } catch (e) { next(e); }
});

app.get('/en/faq', async (req, res, next) => {
  try {
    ({ fr: portfolioData, en: portfolioDataEn } = await loadData());
    const embed = req.query.embed === '1';
    res.render('en/faq', { data: portfolioDataEn, embed });
  } catch (e) { next(e); }
});

// SEO: robots.txt
app.get('/robots.txt', (req, res) => {
  const baseUrl = (CONFIG_SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const ADMIN_R = (process.env.ADMIN_PATH || '/__admin').replace(/\/$/, '');
  res.type('text/plain').send([
    'User-agent: *',
    'Allow: /',
    `Disallow: ${ADMIN_R}`,
    'Disallow: /login',
    'Disallow: /test-email',
    'Disallow: /test-contact',
    `Sitemap: ${baseUrl}/sitemap.xml`
  ].join('\n'));
});

// SEO: sitemap.xml with FR/EN and hreflang alternates
app.get('/sitemap.xml', (req, res) => {
  const baseUrl = (CONFIG_SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const frRoutes = ['/', '/about', '/projects', '/contact', '/cv', '/faq'];
  const enRoutes = ['/en', '/en/about', '/en/projects', '/en/contact', '/en/cv', '/en/faq'];
  const lastmod = new Date().toISOString();

  const xhtmlNs = 'xmlns:xhtml="http://www.w3.org/1999/xhtml"';
  const urls = [];

  // Pair FR<->EN alternates
  for (let i = 0; i < frRoutes.length; i++) {
    const fr = frRoutes[i];
    const en = enRoutes[i];
    urls.push(`
    <url>
      <loc>${baseUrl}${fr}</loc>
      <lastmod>${lastmod}</lastmod>
      <changefreq>monthly</changefreq>
      <priority>0.8</priority>
      <xhtml:link rel="alternate" hreflang="fr" href="${baseUrl}${fr}" />
      <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}${en}" />
      <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${fr}" />
    </url>`);
    urls.push(`
    <url>
      <loc>${baseUrl}${en}</loc>
      <lastmod>${lastmod}</lastmod>
      <changefreq>monthly</changefreq>
      <priority>0.8</priority>
      <xhtml:link rel="alternate" hreflang="fr" href="${baseUrl}${fr}" />
      <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}${en}" />
      <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${fr}" />
    </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ${xhtmlNs}>
    ${urls.join('\n')}
  </urlset>`;
  res.type('application/xml').send(xml);
});

// Route pour traiter le formulaire de contact
app.post('/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;
  
  // Validation des données
  if (!name || !email || !message) {
    return res.status(400).json({ 
      success: false, 
      message: 'Tous les champs obligatoires doivent être remplis.' 
    });
  }

  // Validation email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Adresse email invalide.' 
    });
  }

  try {
    // Toujours charger depuis la BDD pour utiliser les infos à jour
    ({ fr: portfolioData, en: portfolioDataEn } = await loadData());
    // Email pour vous (notification)
    const ownerEmailOptions = {
      from: `"Portfolio Contact" <${EMAIL_CONFIG.auth.user}>`,
      to: process.env.CONTACT_EMAIL || process.env.EMAIL_USER || portfolioData.email,
      replyTo: `${name} <${email}>`,
      subject: `💼 Nouveau message de ${name} - ${subject || 'Portfolio Contact'}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6;">
          <div style="background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">📩 Nouveau message de contact</h2>
          </div>
          <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #1f2937; margin-top: 0;">Informations du contact</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #374151; font-weight: bold;">Nom :</td>
                  <td style="padding: 8px 0; color: #1f2937;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #374151; font-weight: bold;">Email :</td>
                  <td style="padding: 8px 0; color: #1f2937;"><a href="mailto:${email}" style="color: #3b82f6;">${email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #374151; font-weight: bold;">Sujet :</td>
                  <td style="padding: 8px 0; color: #1f2937;">${subject || 'Non spécifié'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #374151; font-weight: bold;">Date :</td>
                  <td style="padding: 8px 0; color: #1f2937;">${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</td>
                </tr>
              </table>
            </div>
            <div style="background: white; padding: 20px; border-radius: 8px;">
              <h3 style="color: #1f2937; margin-top: 0;">Message</h3>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; color: #374151; white-space: pre-wrap;">${message}</div>
            </div>
            <div style="text-align: center; margin-top: 20px;">
              <a href="mailto:${email}?subject=Re: ${subject || 'Portfolio Contact'}" 
                 style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                📧 Répondre directement
              </a>
            </div>
          </div>
        </div>
      `,
      text: `
        Nouveau message de contact reçu
        
        Nom: ${name}
        Email: ${email}
        Sujet: ${subject || 'Non spécifié'}
        Date: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
        
        Message:
        ${message}
        
        Répondez directement à ${email}
      `
    };

    // Email de confirmation pour le client
    const clientEmailOptions = {
      from: `"${portfolioData.name}" <${EMAIL_CONFIG.auth.user}>`,
      to: email,
      subject: `Confirmation de réception - ${portfolioData.name}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6;">
          <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">Message bien reçu !</h2>
          </div>
          <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <p style="color: #1f2937; margin-top: 0; font-size: 16px;">Bonjour <strong>${name}</strong>,</p>
              <p style="color: #374151;">Merci de m'avoir contacté ! J'ai bien reçu votre message et je vous répondrai dans les plus brefs délais, généralement sous 24-48 heures.</p>
              
              <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h4 style="color: #1f2937; margin-top: 0;">Récapitulatif de votre message :</h4>
                <p style="color: #374151; margin: 5px 0;"><strong>Sujet :</strong> ${subject || 'Non spécifié'}</p>
                <p style="color: #374151; margin: 5px 0;"><strong>Date d'envoi :</strong> ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
                <div style="margin-top: 10px;">
                  <strong style="color: #1f2937;">Votre message :</strong>
                  <div style="background: white; padding: 10px; border-radius: 4px; margin-top: 5px; color: #374151; border-left: 3px solid #10b981; white-space: pre-wrap;">${message}</div>
                </div>
              </div>
              
              <p style="color: #374151;">En attendant, n'hésitez pas à consulter mon portfolio et mes projets récents.</p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center;">
              <h4 style="color: #1f2937; margin-top: 0;">Restons connectés</h4>
              <p style="color: #374151; margin-bottom: 15px;">Vous pouvez également me retrouver sur :</p>
              <div style="margin: 15px 0;">
                <a href="${portfolioData.social.linkedin}" style="display: inline-block; margin: 0 10px; padding: 8px 16px; background: #0077b5; color: white; text-decoration: none; border-radius: 4px;">LinkedIn</a>
                <a href="${portfolioData.social.github}" style="display: inline-block; margin: 0 10px; padding: 8px 16px; background: #333; color: white; text-decoration: none; border-radius: 4px;">GitHub</a>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
              <p>Cordialement,<br><strong>${portfolioData.name}</strong><br>${portfolioData.title}</p>
              <p>📧 ${portfolioData.email} | 📱 ${portfolioData.phone}</p>
            </div>
          </div>
        </div>
      `,
      text: `
        Bonjour ${name},
        
        Merci de m'avoir contacté ! J'ai bien reçu votre message et je vous répondrai dans les plus brefs délais.
        
        Récapitulatif de votre message :
        Sujet: ${subject || 'Non spécifié'}
        Date: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
        
        Votre message:
        ${message}
        
        Cordialement,
        ${portfolioData.name}
        ${portfolioData.title}
        
        Email: ${portfolioData.email}
        Téléphone: ${portfolioData.phone}
        
        LinkedIn: ${portfolioData.social.linkedin}
        GitHub: ${portfolioData.social.github}
      `
    };

    // Envoyer les deux emails
    console.log('Envoi des emails...');
    
    await Promise.all([
      transporter.sendMail(ownerEmailOptions),
      transporter.sendMail(clientEmailOptions)
    ]);

    console.log('Emails envoyés avec succès');
    
    res.json({ 
      success: true, 
      message: 'Message envoyé avec succès ! Vous recevrez une confirmation par email.' 
    });

  } catch (error) {
    console.error('Erreur lors de l\'envoi des emails:', error);
    
    // En cas d'erreur, on sauvegarde au moins les données
    console.log('Nouveau message (sauvegarde):', { name, email, subject, message, date: new Date() });
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de l\'envoi du message. Veuillez réessayer ou me contacter directement.' 
    });
  }
});

// API pour récupérer les projets (pour AJAX)
app.get('/api/projects', async (req, res, next) => {
  try {
    ({ fr: portfolioData } = await loadData());
    res.json(portfolioData.projects);
  } catch (e) { next(e); }
});

// Health check for DB connectivity (dev only)
app.get('/_health/db', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).end();
  try {
    const data = await Promise.resolve(getPortfolioData('fr'));
    res.json({ ok: true, profile: { name: data.name, title: data.title } });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// Route pour tester la configuration email (à retirer en production)
app.get('/test-email', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send('Route non disponible en production');
  }
  
  try {
    await transporter.verify();
    res.json({ 
      success: true, 
      message: 'Configuration email OK',
      config: {
        host: EMAIL_CONFIG.host,
        port: EMAIL_CONFIG.port,
        user: EMAIL_CONFIG.auth.user,
        // Ne pas exposer le mot de passe
        passwordConfigured: !!EMAIL_CONFIG.auth.pass
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Erreur de configuration email',
      error: error.message 
    });
  }
});

// Page de test du formulaire (développement uniquement)
app.get('/test-contact', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send('Page non disponible en production');
  }
  res.sendFile(path.join(__dirname, 'test-contact.html'));
});

// 404 pour les routes EN
app.use('/en', (req, res) => {
  res.status(404).render('en/error', {
    data: portfolioDataEn,
    status: 404,
    message: 'Page not found',
    details: 'The page you are looking for does not exist.'
  });
});

// Middleware pour gérer les erreurs 404 (route non trouvée)
app.use((req, res) => {
  res.status(404).render('error', {
    data: portfolioData,
    status: 404,
    message: 'Page non trouvée',
    details: 'La page que vous recherchez n\'existe pas.'
  });
});

// Gestion centralisée des autres erreurs (4xx/5xx)
// Utilisation après toutes les routes et middleware
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  const status = err.status || err.statusCode || 500;
  // Messages par défaut selon le statut
  const messages = {
    400: "Requête invalide",
    401: "Authentification requise",
    403: "Accès refusé",
    405: "Méthode non autorisée",
    429: "Trop de requêtes",
    500: "Erreur interne du serveur",
    502: "Mauvaise passerelle",
    503: "Service indisponible",
    504: "Délai d'attente dépassé",
  };
  const message = err.message || messages[status] || 'Une erreur est survenue';
  if (req.path && req.path.startsWith('/en')) {
    return res.status(status).render('en/error', {
      data: portfolioDataEn,
      status,
      message: message === messages[status] ? 'An error occurred' : message,
      details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  }
  res.status(status).render('error', {
    data: portfolioData,
    status,
    message,
    details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});

module.exports = app;
