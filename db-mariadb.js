const mysql = require('mysql2/promise');
const fs = require('fs');
const seed = require('./data/seedData');

const URL = process.env.MARIADB_URL || process.env.MYSQL_URL;
const SSL_ENABLED = String(process.env.MARIADB_SSL || process.env.MYSQL_SSL || '').toLowerCase() === 'true';
const SSL_REJECT_UNAUTHORIZED = process.env.MARIADB_SSL_REJECT_UNAUTHORIZED === undefined
  ? true
  : String(process.env.MARIADB_SSL_REJECT_UNAUTHORIZED).toLowerCase() === 'true';
const CA_PATH = process.env.MARIADB_CA_PATH || process.env.MYSQL_CA_PATH;

const baseCfg = {
  host: process.env.MARIADB_HOST || process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MARIADB_PORT || process.env.MYSQL_PORT || 3306),
  user: process.env.MARIADB_USER || process.env.MYSQL_USER || 'portfolio',
  password: process.env.MARIADB_PASSWORD || process.env.MYSQL_PASSWORD || 'portfolio',
  database: process.env.MARIADB_DATABASE || process.env.MYSQL_DATABASE || 'portfolio',
};

const commonPoolOpts = {
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
};

function buildSsl() {
  if (!SSL_ENABLED && !CA_PATH) return undefined;
  const ssl = { rejectUnauthorized: SSL_REJECT_UNAUTHORIZED };
  if (CA_PATH) {
    try {
      ssl.ca = fs.readFileSync(CA_PATH, 'utf8');
    } catch (e) {
      console.warn('Could not read CA file at', CA_PATH, e.message);
    }
  }
  return ssl;
}

const pool = URL
  ? mysql.createPool(URL)
  : mysql.createPool({
      ...baseCfg,
      ssl: buildSsl(),
      ...commonPoolOpts,
    });

async function ensureSchema() {
  const sql = `
  CREATE TABLE IF NOT EXISTS profile (
    id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    location VARCHAR(255),
    description TEXT
  );
  CREATE TABLE IF NOT EXISTS profile_i18n (
    profile_id INT NOT NULL,
    lang CHAR(2) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    PRIMARY KEY (profile_id, lang),
    CONSTRAINT fk_profile_i18n FOREIGN KEY (profile_id) REFERENCES profile(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS social (
    id INT PRIMARY KEY,
    github TEXT,
    linkedin TEXT
  );
  CREATE TABLE IF NOT EXISTS skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    level INT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS skill_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(255) NULL,
    position INT NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS skill_category_map (
    skill_id INT NOT NULL,
    category_id INT NOT NULL,
    PRIMARY KEY (skill_id, category_id),
    CONSTRAINT fk_scm_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
    CONSTRAINT fk_scm_category FOREIGN KEY (category_id) REFERENCES skill_categories(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image VARCHAR(1024)
  );
  CREATE TABLE IF NOT EXISTS project_i18n (
    project_id INT NOT NULL,
    lang CHAR(2) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    PRIMARY KEY (project_id, lang),
    CONSTRAINT fk_project_i18n FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS project_tech (
    project_id INT NOT NULL,
    tech VARCHAR(255) NOT NULL,
    PRIMARY KEY (project_id, tech),
    CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS experiences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    start_year INT NOT NULL,
    end_year INT NULL,
    -- base fallback fields
    title VARCHAR(255) DEFAULT '',
    subtitle VARCHAR(255) DEFAULT '',
    description TEXT
  );
  CREATE TABLE IF NOT EXISTS experience_i18n (
    experience_id INT NOT NULL,
    lang CHAR(2) NOT NULL,
    title VARCHAR(255) DEFAULT '',
    subtitle VARCHAR(255) DEFAULT '',
    description TEXT,
    PRIMARY KEY (experience_id, lang),
    CONSTRAINT fk_experience_i18n FOREIGN KEY (experience_id) REFERENCES experiences(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS admin_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    type ENUM('setup','reset') NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_admin_tokens_email (email)
  );`;
  const conn = await pool.getConnection();
  try {
    for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
      await conn.query(stmt);
    }
  // Add missing columns using ALTERs guarded by IF NOT EXISTS when supported
  try { await conn.query('ALTER TABLE profile ADD COLUMN IF NOT EXISTS experience_start_year INT NULL'); } catch (e) { /* ignore for older MariaDB */ }
  } finally {
    conn.release();
  }
}

async function isEmpty() {
  const [rows] = await pool.query('SELECT COUNT(*) as c FROM profile');
  return !rows[0] || rows[0].c === 0;
}

async function seedIfNeeded() {
  await ensureSchema();
  if (!(await isEmpty())) return;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { profile, profileEn, social, skills, projects } = seed;
    await conn.query('INSERT INTO profile (id, name, title, email, phone, location, description) VALUES (1, ?, ?, ?, ?, ?, ?)',
      [profile.name, profile.title, profile.email, profile.phone, profile.location, profile.description]
    );
  await conn.query('UPDATE profile SET experience_start_year = ? WHERE id = 1 AND (experience_start_year IS NULL OR experience_start_year = 0)', [2022]);
    await conn.query('INSERT INTO profile_i18n (profile_id, lang, title, description) VALUES (1, ?, ?, ?), (1, ?, ?, ?)',
      ['fr', profile.title, profile.description, 'en', profileEn.title, profileEn.description]
    );
    await conn.query('INSERT INTO social (id, github, linkedin) VALUES (1, ?, ?)', [social.github, social.linkedin]);
    for (const s of skills) {
      await conn.query('INSERT INTO skills (name, level) VALUES (?, ?)', [s.name, s.level]);
    }
  for (const p of projects) {
      const [res] = await conn.query('INSERT INTO projects (title, description, image) VALUES (?, ?, ?)', [p.title, p.description, p.image]);
      const pid = res.insertId;
      await conn.query('INSERT INTO project_i18n (project_id, lang, title, description) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
        [pid, 'fr', p.title, p.description, pid, 'en', (p.en && p.en.title) || p.title, (p.en && p.en.description) || p.description]);
      if (Array.isArray(p.technologies)) {
        for (const t of p.technologies) {
          await conn.query('INSERT INTO project_tech (project_id, tech) VALUES (?, ?)', [pid, t]);
        }
      }
    }
    // Seed minimal experiences
    const exp1 = { start: 2022, end: 2024, fr: { title: 'Technicien DevOps', subtitle: 'KEENTON SAS (CDI)', description: "Gestion d'une infrastructure cloud auto‑hébergée, supervision (Zabbix, Grafana), incidents, addons Zabbix en Python, CI/CD, conteneurisation, sauvegardes." }, en: { title: 'DevOps Technician', subtitle: 'KEENTON SAS (Full-time)', description: 'Managed self-hosted cloud infrastructure, observability (Zabbix, Grafana), incident response, Python Zabbix addons, CI/CD, containerization, backups.' } };
    const exp2 = { start: 2019, end: null, fr: { title: 'Formation & Homelab', subtitle: 'Auto‑formation', description: "Bases Linux, réseaux, Python. Homelab (Docker, Python, gestion de configuration) et projets personnels." }, en: { title: 'Education & Homelab', subtitle: 'Self-learning', description: 'Strengthened Linux, networking, Python. Built a homelab (Docker, Python, config management) and personal projects.' } };
    for (const e of [exp1, exp2]) {
      const [eres] = await conn.query('INSERT INTO experiences (start_year, end_year, title, subtitle, description) VALUES (?, ?, ?, ?, ?)', [e.start, e.end, e.fr.title, e.fr.subtitle, e.fr.description]);
      const eid = eres.insertId;
      await conn.query('INSERT INTO experience_i18n (experience_id, lang, title, subtitle, description) VALUES (?, "fr", ?, ?, ?), (?, "en", ?, ?, ?)', [eid, e.fr.title, e.fr.subtitle, e.fr.description, eid, e.en.title, e.en.subtitle, e.en.description]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getPortfolioData(lang = 'fr') {
  await seedIfNeeded();
  const [profBase] = await pool.query('SELECT name, email, phone, location, experience_start_year FROM profile WHERE id = 1');
  const [profI18n] = await pool.query('SELECT title, description FROM profile_i18n WHERE profile_id = 1 AND lang = ?', [lang]);
  const [socRows] = await pool.query('SELECT github, linkedin FROM social WHERE id = 1');
  const [skillRows] = await pool.query('SELECT id, name, level FROM skills ORDER BY level DESC, name ASC');
  const [projRows] = await pool.query('SELECT p.id, p.image, COALESCE(i.title, p.title) AS title, COALESCE(i.description, p.description) AS description FROM projects p LEFT JOIN project_i18n i ON i.project_id = p.id AND i.lang = ? ORDER BY p.id DESC', [lang]);
  const [techRows] = await pool.query('SELECT project_id, tech FROM project_tech ORDER BY tech');
  const [expRows] = await pool.query('SELECT e.id, e.start_year, e.end_year, COALESCE(i.title, e.title) AS title, COALESCE(i.subtitle, e.subtitle) AS subtitle, COALESCE(i.description, e.description) AS description FROM experiences e LEFT JOIN experience_i18n i ON i.experience_id = e.id AND i.lang = ? ORDER BY e.start_year DESC, e.id DESC', [lang]);
  const [catRows] = await pool.query('SELECT id, name, icon, position FROM skill_categories ORDER BY position ASC, name ASC');
  const [mapRows] = await pool.query('SELECT skill_id, category_id FROM skill_category_map');
  const byId = new Map(projRows.map(p => [p.id, { id: p.id, title: p.title, description: p.description, image: p.image, technologies: [] }]));
  for (const r of techRows) {
    const p = byId.get(r.project_id);
    if (p) p.technologies.push(r.tech);
  }
  // Build categories with skills
  const skillsById = new Map(skillRows.map(s => [s.id, { name: s.name, level: s.level }]));
  const catSkillIds = new Map();
  for (const m of mapRows) {
    if (!catSkillIds.has(m.category_id)) catSkillIds.set(m.category_id, new Set());
    catSkillIds.get(m.category_id).add(m.skill_id);
  }
  const categories = catRows.map(c => {
    const ids = Array.from(catSkillIds.get(c.id) || []);
    const items = [];
    for (const id of ids) {
      const s = skillsById.get(id);
      if (s && s.name) items.push({ id, ...s });
    }
    items.sort((a, b) => {
      const byLevel = (Number(b.level || 0) - Number(a.level || 0));
      if (byLevel) return byLevel;
      const an = a.name || '';
      const bn = b.name || '';
      return an.localeCompare(bn, 'fr', { sensitivity: 'base' });
    });
    return { id: c.id, name: c.name, icon: c.icon || null, position: c.position, skills: items };
  });
  // Compute stats
  const skillsCount = (skillRows || []).length;
  const projectsList = Array.from(byId.values());
  let projectsCount = projectsList.length;
  try {
    const [[cnt]] = await pool.query('SELECT COUNT(*) as c FROM projects');
    if (typeof cnt?.c === 'number') projectsCount = cnt.c;
  } catch {}
  const startYear = profBase[0]?.experience_start_year;
  const currentYear = new Date().getFullYear();
  const years = startYear && Number.isInteger(Number(startYear))
    ? Math.max(0, currentYear - Number(startYear))
    : 2; // fallback

  return {
    name: profBase[0]?.name,
    email: profBase[0]?.email,
    phone: profBase[0]?.phone,
    location: profBase[0]?.location,
    title: profI18n[0]?.title,
    description: profI18n[0]?.description,
    skills: skillRows.map(({id, name, level}) => ({ id, name, level })),
    categories,
    projects: projectsList,
    social: socRows[0] || {},
    stats: { years, projects: projectsCount, skills: skillsCount },
  experiences: expRows.map(r => ({ id: r.id, start_year: r.start_year, end_year: r.end_year, title: r.title, subtitle: r.subtitle, description: r.description })),
  };
}

module.exports = {
  getPortfolioData,
  pool,
};

// --- Admin helpers ---
async function getAdminData() {
  await ensureSchema();
  const [profBase] = await pool.query('SELECT id, name, email, phone, location, experience_start_year FROM profile WHERE id = 1');
  const [profFr] = await pool.query('SELECT title, description FROM profile_i18n WHERE profile_id = 1 AND lang = "fr"');
  const [profEn] = await pool.query('SELECT title, description FROM profile_i18n WHERE profile_id = 1 AND lang = "en"');
  const [social] = await pool.query('SELECT github, linkedin FROM social WHERE id = 1');
  const [skills] = await pool.query('SELECT id, name, level FROM skills ORDER BY level DESC, name ASC');
  const [categories] = await pool.query('SELECT id, name, icon, position FROM skill_categories ORDER BY position ASC, name ASC');
  const [maps] = await pool.query('SELECT skill_id, category_id FROM skill_category_map');
  const [projects] = await pool.query('SELECT id, image FROM projects ORDER BY id DESC');
  const [experiences] = await pool.query('SELECT id, start_year, end_year, title, subtitle FROM experiences ORDER BY start_year DESC, id DESC');
  const ids = projects.map(p => p.id);
  const projectsFull = [];
  for (const id of ids) {
    const [[fr]] = await pool.query('SELECT COALESCE(i.title, p.title) AS title, COALESCE(i.description, p.description) AS description FROM projects p LEFT JOIN project_i18n i ON i.project_id = p.id AND i.lang = "fr" WHERE p.id = ?', [id]);
    const [[en]] = await pool.query('SELECT COALESCE(i.title, p.title) AS title, COALESCE(i.description, p.description) AS description FROM projects p LEFT JOIN project_i18n i ON i.project_id = p.id AND i.lang = "en" WHERE p.id = ?', [id]);
    const [tech] = await pool.query('SELECT tech FROM project_tech WHERE project_id = ? ORDER BY tech', [id]);
    projectsFull.push({ id, image: projects.find(p => p.id === id).image, fr, en, technologies: tech.map(t => t.tech) });
  }
  const categoryIdsBySkill = new Map();
  for (const m of maps) {
    if (!categoryIdsBySkill.has(m.skill_id)) categoryIdsBySkill.set(m.skill_id, new Set());
    categoryIdsBySkill.get(m.skill_id).add(m.category_id);
  }
  return {
    profile: {
      id: profBase[0]?.id || 1,
      name: profBase[0]?.name || '',
      email: profBase[0]?.email || '',
      phone: profBase[0]?.phone || '',
      location: profBase[0]?.location || '',
  experienceStartYear: profBase[0]?.experience_start_year || '',
      fr: profFr[0] || { title: '', description: '' },
      en: profEn[0] || { title: '', description: '' },
    },
    social: social[0] || { github: '', linkedin: '' },
    skills: skills.map(s => ({ ...s, categoryIds: Array.from(categoryIdsBySkill.get(s.id) || []) })),
    categories,
    projects: projectsFull,
  experiences,
  };
}

async function updateProfile({ name, email, phone, location, frTitle, frDescription, enTitle, enDescription, experienceStartYear }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
  await conn.query('INSERT INTO profile (id, name, title, email, phone, location, description, experience_start_year) VALUES (1, ?, "", ?, ?, ?, "", ?) ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), phone=VALUES(phone), location=VALUES(location), experience_start_year=VALUES(experience_start_year)', [name, email, phone, location, experienceStartYear]);
    await conn.query('INSERT INTO profile_i18n (profile_id, lang, title, description) VALUES (1, "fr", ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description)', [frTitle, frDescription]);
    await conn.query('INSERT INTO profile_i18n (profile_id, lang, title, description) VALUES (1, "en", ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description)', [enTitle, enDescription]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function updateSocial({ github, linkedin }) {
  await pool.query('INSERT INTO social (id, github, linkedin) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE github=VALUES(github), linkedin=VALUES(linkedin)', [github, linkedin]);
}

async function addSkill({ name, level }) {
  await pool.query('INSERT INTO skills (name, level) VALUES (?, ?)', [name, level]);
}

async function deleteSkill(id) {
  await pool.query('DELETE FROM skills WHERE id = ?', [id]);
}

async function updateSkill({ id, name, level }) {
  await pool.query('UPDATE skills SET name = ?, level = ? WHERE id = ?', [name, Number(level) || 0, id]);
}

async function upsertProject({ id, image, frTitle, frDescription, enTitle, enDescription, technologies }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let pid = id;
    if (pid) {
      await conn.query('UPDATE projects SET image = ? WHERE id = ?', [image, pid]);
    } else {
      const [res] = await conn.query('INSERT INTO projects (title, description, image) VALUES (?, ?, ?)', [frTitle || '', frDescription || '', image || '']);
      pid = res.insertId;
    }
    await conn.query('INSERT INTO project_i18n (project_id, lang, title, description) VALUES (?, "fr", ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description)', [pid, frTitle, frDescription]);
    await conn.query('INSERT INTO project_i18n (project_id, lang, title, description) VALUES (?, "en", ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description)', [pid, enTitle || frTitle, enDescription || frDescription]);
    await conn.query('DELETE FROM project_tech WHERE project_id = ?', [pid]);
    if (Array.isArray(technologies)) {
      for (const t of technologies.map(x => String(x).trim()).filter(Boolean)) {
        await conn.query('INSERT INTO project_tech (project_id, tech) VALUES (?, ?)', [pid, t]);
      }
    }
    await conn.commit();
    return pid;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function deleteProject(id) {
  await pool.query('DELETE FROM projects WHERE id = ?', [id]);
}

module.exports.getAdminData = getAdminData;
module.exports.updateProfile = updateProfile;
module.exports.updateSocial = updateSocial;
module.exports.addSkill = addSkill;
module.exports.deleteSkill = deleteSkill;
module.exports.updateSkill = updateSkill;
module.exports.upsertProject = upsertProject;
module.exports.deleteProject = deleteProject;
// Category helpers
async function addCategory({ name, icon, position }) {
  await pool.query('INSERT INTO skill_categories (name, icon, position) VALUES (?, ?, ?)', [name, icon || null, Number(position) || 0]);
}
async function updateCategory({ id, name, icon, position }) {
  await pool.query('UPDATE skill_categories SET name = ?, icon = ?, position = ? WHERE id = ?', [name, icon || null, Number(position) || 0, id]);
}
async function deleteCategory(id) {
  await pool.query('DELETE FROM skill_categories WHERE id = ?', [id]);
}
async function setSkillCategories(skillId, categoryIds) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM skill_category_map WHERE skill_id = ?', [skillId]);
    const ids = Array.from(new Set((categoryIds || []).map(n => Number(n)).filter(n => Number.isInteger(n))));
    for (const cid of ids) {
      await conn.query('INSERT INTO skill_category_map (skill_id, category_id) VALUES (?, ?)', [skillId, cid]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
module.exports.addCategory = addCategory;
module.exports.updateCategory = updateCategory;
module.exports.deleteCategory = deleteCategory;
module.exports.setSkillCategories = setSkillCategories;

// Experiences helpers
async function upsertExperience({ id, start_year, end_year, frTitle, frSubtitle, frDescription, enTitle, enSubtitle, enDescription }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let eid = id;
    if (eid) {
      await conn.query('UPDATE experiences SET start_year = ?, end_year = ?, title = ?, subtitle = ?, description = ? WHERE id = ?', [start_year, end_year || null, frTitle || '', frSubtitle || '', frDescription || '', eid]);
    } else {
      const [res] = await conn.query('INSERT INTO experiences (start_year, end_year, title, subtitle, description) VALUES (?, ?, ?, ?, ?)', [start_year, end_year || null, frTitle || '', frSubtitle || '', frDescription || '']);
      eid = res.insertId;
    }
    await conn.query('INSERT INTO experience_i18n (experience_id, lang, title, subtitle, description) VALUES (?, "fr", ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), subtitle=VALUES(subtitle), description=VALUES(description)', [eid, frTitle || '', frSubtitle || '', frDescription || '']);
    await conn.query('INSERT INTO experience_i18n (experience_id, lang, title, subtitle, description) VALUES (?, "en", ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), subtitle=VALUES(subtitle), description=VALUES(description)', [eid, enTitle || frTitle || '', enSubtitle || frSubtitle || '', enDescription || frDescription || '']);
    await conn.commit();
    return eid;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
async function deleteExperience(id) {
  await pool.query('DELETE FROM experiences WHERE id = ?', [id]);
}
module.exports.upsertExperience = upsertExperience;
module.exports.deleteExperience = deleteExperience;

// --- Admin auth helpers ---
async function getAdminUserCount() {
  await ensureSchema();
  const [rows] = await pool.query('SELECT COUNT(*) as c FROM admin_users');
  return rows[0]?.c || 0;
}

async function getAdminUserByEmail(email) {
  await ensureSchema();
  const [rows] = await pool.query('SELECT * FROM admin_users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

async function getActiveToken(email, type) {
  await ensureSchema();
  const [rows] = await pool.query('SELECT * FROM admin_tokens WHERE email = ? AND type = ? AND used_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1', [email, type]);
  return rows[0] || null;
}

async function createTokenForEmail(email, type = 'setup', ttlMinutes = 60) {
  await ensureSchema();
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('INSERT INTO admin_tokens (email, token, type, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))', [email, token, type, ttlMinutes]);
  return token;
}

async function createSetupTokenForEmail(email, ttlMinutes = 60) {
  return createTokenForEmail(email, 'setup', ttlMinutes);
}

async function createResetTokenForEmail(email, ttlMinutes = 60) {
  return createTokenForEmail(email, 'reset', ttlMinutes);
}

async function consumeTokenAndSetPassword(token, passwordHash) {
  await ensureSchema();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[row]] = await conn.query('SELECT * FROM admin_tokens WHERE token = ? AND used_at IS NULL AND expires_at > NOW() FOR UPDATE', [token]);
    if (!row) throw new Error('Invalid or expired token');
    await conn.query('UPDATE admin_tokens SET used_at = NOW() WHERE id = ?', [row.id]);
    // Upsert user with this email
    await conn.query('INSERT INTO admin_users (email, password_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)', [row.email, passwordHash]);
    await conn.commit();
    return row.email;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports.getAdminUserCount = getAdminUserCount;
module.exports.getAdminUserByEmail = getAdminUserByEmail;
module.exports.getActiveToken = getActiveToken;
module.exports.createSetupTokenForEmail = createSetupTokenForEmail;
module.exports.consumeTokenAndSetPassword = consumeTokenAndSetPassword;
module.exports.createResetTokenForEmail = createResetTokenForEmail;
