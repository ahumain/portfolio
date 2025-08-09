const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');

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

// Données du portfolio
const portfolioData = {
  name: "Mathias Legrand",
  title: "Développeur DevOps et Python",
  email: process.env.CONTACT_EMAIL || process.env.EMAIL_USER || "contact@mathiaslegrand.cloud",
  phone: "+33 1 85 09 12 00",
  location: "Paris, France",
  description: "Développeur passionné avec 2+ années d'expérience en gestion d'infrastructure et développement Python. Spécialisé en automatisation, conteneurs, CI/CD, devops, réseaux et rétablissement de services.",
  skills: [
    { name: "Zabbix", level: 95 },
    { name: "Grafana", level: 95 },
    { name: "Nutanix AHV", level: 95 },
    { name: "Cloudflare", level: 90 },
    { name: "Git", level: 95 },
    { name: "Docker", level: 90 },
    { name: "Python", level: 95 },
    { name: "Puppet", level: 80 },
    { name: "Kubernetes", level: 70 },
    { name: "CI/CD", level: 90 },
    { name: "Linux", level: 90 },
    { name: "Réseaux", level: 85 },
    { name: "Terraform", level: 70 },
    { name: "Shell scripting", level: 80 },
    { name: "Keycloak", level: 85 },
    { name: "TLS/SSL", level: 85 },
    { name: "RBAC", level: 80 },
    { name: "Automatisation", level: 90 },
    { name: "DNS", level: 80 },
    { name: "Proxy / Reverse proxy", level: 80 },
    { name: "OVH", level: 90 },
    { name: "AWS", level: 70 },
    { name: "Vmware", level: 70 }
  ],
  projects: [
    {
      title: "Technicien DevOps - KEENTON SAS (CDI)",
      description: "Gestion de l'infrastructure cloud auto hébergée, supervision des systèmes, gestion des incidents, développement d'addons pour zabbix en Python.",
      technologies: [
        "Zabbix",
        "Grafana",
        "Nutanix AHV",
        "Cloudflare",
        "Git",
        "Docker",
        "Python",
        "Puppet",
        "Kubernetes",
        "CI/CD",
        "Linux",
        "Réseaux",
        "Terraform",
        "Shell scripting",
        "Keycloak",
        "TLS/SSL",
        "RBAC",
        "Automatisation",
        "DNS",
        "Proxy / Reverse proxy",
        "OVH",
        "AWS",
        "Vmware"
      ],
  image: "/images/placeholder-project.svg"
  }
  ],
  social: {
    github: "https://github.com/ahumain",
    linkedin: "https://linkedin.com/in/mathiaslegrand",
  }
};

// Ordonner les compétences par niveau décroissant (puis par nom pour stabilité)
portfolioData.skills.sort((a, b) => (b.level - a.level) || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

// Variante EN des données (titre/description en anglais)
const portfolioDataEn = {
  ...portfolioData,
  title: "DevOps & Python Developer",
  description: "Passionate developer with 2+ years of experience in infrastructure operations and Python development. Specialized in automation, containers, CI/CD, DevOps, networking, and service recovery.",
  location: "Paris, France"
};

// Routes
app.get('/', (req, res) => {
  res.render('index', { data: portfolioData });
});

app.get('/about', (req, res) => {
  res.render('about', { data: portfolioData });
});

app.get('/projects', (req, res) => {
  res.render('projects', { data: portfolioData });
});

app.get('/contact', (req, res) => {
  res.render('contact', { data: portfolioData });
});

// Page CV (aperçu intégré du PDF)
app.get('/cv', (req, res) => {
  res.render('cv', { data: portfolioData });
});

// Page FAQ dédiée
app.get('/faq', (req, res) => {
  const embed = req.query.embed === '1';
  res.render('faq', { data: portfolioData, embed });
});

// English pages
app.get('/en', (req, res) => {
  res.render('en/index', { data: portfolioDataEn });
});

app.get('/en/about', (req, res) => {
  res.render('en/about', { data: portfolioDataEn });
});

app.get('/en/projects', (req, res) => {
  res.render('en/projects', { data: portfolioDataEn });
});

app.get('/en/contact', (req, res) => {
  res.render('en/contact', { data: portfolioDataEn });
});

app.get('/en/cv', (req, res) => {
  res.render('en/cv', { data: portfolioDataEn });
});

app.get('/en/faq', (req, res) => {
  const embed = req.query.embed === '1';
  res.render('en/faq', { data: portfolioDataEn, embed });
});

// SEO: robots.txt
app.get('/robots.txt', (req, res) => {
  const baseUrl = (CONFIG_SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  res.type('text/plain').send([
    'User-agent: *',
    'Allow: /',
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
app.get('/api/projects', (req, res) => {
  res.json(portfolioData.projects);
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
