const express = require('express');
const {
  getAdminData,
  updateProfile,
  updateSocial,
  addSkill,
  updateSkill,
  deleteSkill,
  upsertProject,
  deleteProject,
  addCategory,
  updateCategory,
  deleteCategory,
  setSkillCategories,
  upsertExperience,
  deleteExperience,
} = require('../db-mariadb');

const router = express.Router();
// Session guard is applied at mount time in server.js

router.get('/', async (req, res, next) => {
  try {
    const data = await getAdminData();
  res.render('admin/index', { data });
  } catch (e) { next(e); }
});

// JSON API (read)
router.get('/api', async (req, res, next) => {
  try {
    const data = await getAdminData();
    res.json({ ok: true, data });
  } catch (e) { next(e); }
});

router.post('/profile', async (req, res, next) => {
  try {
    const { name, email, phone, location, frTitle, frDescription, enTitle, enDescription, experienceStartYear } = req.body;
  await updateProfile({ name, email, phone, location, frTitle, frDescription, enTitle, enDescription, experienceStartYear: Number(experienceStartYear) || null });
  if ((req.get('accept')||'').includes('application/json')) return res.json({ ok: true });
  res.redirect(req.baseUrl);
  } catch (e) { next(e); }
});

router.post('/social', async (req, res, next) => {
  try {
    const { github, linkedin } = req.body;
  await updateSocial({ github, linkedin });
  if ((req.get('accept')||'').includes('application/json')) return res.json({ ok: true });
  res.redirect(req.baseUrl);
  } catch (e) { next(e); }
});

router.post('/skills/add', async (req, res, next) => {
  try {
    const { name, level } = req.body;
  await addSkill({ name, level: Number(level) });
  if ((req.get('accept')||'').includes('application/json')) return res.json({ ok: true, reload: true });
  res.redirect(req.baseUrl);
  } catch (e) { next(e); }
});

router.post('/skills/:id/update', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, level } = req.body;
    await updateSkill({ id, name, level: Number(level) });
    if ((req.get('accept')||'').includes('application/json')) return res.json({ ok: true });
    res.redirect(req.baseUrl);
  } catch (e) { next(e); }
});

router.post('/skills/:id/delete', async (req, res, next) => {
  try {
  await deleteSkill(Number(req.params.id));
  if ((req.get('accept')||'').includes('application/json')) return res.json({ ok: true, reload: true });
  res.redirect(req.baseUrl);
  } catch (e) { next(e); }
});

// Set categories for a given skill
router.post('/skills/:id/categories', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const categoryIds = Array.isArray(req.body.categoryIds) ? req.body.categoryIds : String(req.body.categoryIds || '').split(',');
    await setSkillCategories(id, categoryIds);
    if ((req.get('accept')||'').includes('application/json')) return res.json({ ok: true });
    res.redirect(req.baseUrl);
  } catch (e) { next(e); }
});

// Category CRUD
router.post('/categories/add', async (req, res, next) => {
  try {
    const { name, icon, position } = req.body;
    await addCategory({ name, icon, position: Number(position || 0) });
    if ((req.get('accept')||'').includes('application/json')) return res.json({ ok: true, reload: true });
    res.redirect(req.baseUrl);
  } catch (e) { next(e); }
});

router.post('/categories/:id/update', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, icon, position } = req.body;
    await updateCategory({ id, name, icon, position: Number(position || 0) });
    if ((req.get('accept')||'').includes('application/json')) return res.json({ ok: true });
    res.redirect(req.baseUrl);
  } catch (e) { next(e); }
});

router.post('/categories/:id/delete', async (req, res, next) => {
  try {
    await deleteCategory(Number(req.params.id));
    if ((req.get('accept')||'').includes('application/json')) return res.json({ ok: true, reload: true });
    res.redirect(req.baseUrl);
  } catch (e) { next(e); }
});

router.post('/projects/save', async (req, res, next) => {
  try {
    const { id, image, frTitle, frDescription, enTitle, enDescription, technologies } = req.body;
    const techs = (technologies || '').split(',').map(s => s.trim()).filter(Boolean);
  await upsertProject({ id: id ? Number(id) : undefined, image, frTitle, frDescription, enTitle, enDescription, technologies: techs });
  if ((req.get('accept')||'').includes('application/json')) return res.json({ ok: true, reload: true });
  res.redirect(req.baseUrl);
  } catch (e) { next(e); }
});

router.post('/projects/:id/delete', async (req, res, next) => {
  try {
  await deleteProject(Number(req.params.id));
  if ((req.get('accept')||'').includes('application/json')) return res.json({ ok: true, reload: true });
  res.redirect(req.baseUrl);
  } catch (e) { next(e); }
});

// Experiences CRUD
router.post('/experiences/add', async (req, res, next) => {
  try {
    const { start_year, end_year, frTitle, frSubtitle, frDescription, enTitle, enSubtitle, enDescription } = req.body;
    await upsertExperience({ start_year: Number(start_year), end_year: end_year ? Number(end_year) : null, frTitle, frSubtitle, frDescription, enTitle, enSubtitle, enDescription });
    if ((req.get('accept')||'').includes('application/json')) return res.json({ ok: true, reload: true });
    res.redirect(req.baseUrl);
  } catch (e) { next(e); }
});
router.post('/experiences/:id/update', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { start_year, end_year, frTitle, frSubtitle, frDescription, enTitle, enSubtitle, enDescription } = req.body;
    await upsertExperience({ id, start_year: Number(start_year), end_year: end_year ? Number(end_year) : null, frTitle, frSubtitle, frDescription, enTitle, enSubtitle, enDescription });
    if ((req.get('accept')||'').includes('application/json')) return res.json({ ok: true, reload: true });
    res.redirect(req.baseUrl);
  } catch (e) { next(e); }
});
router.post('/experiences/:id/delete', async (req, res, next) => {
  try {
    await deleteExperience(Number(req.params.id));
    if ((req.get('accept')||'').includes('application/json')) return res.json({ ok: true, reload: true });
    res.redirect(req.baseUrl);
  } catch (e) { next(e); }
});

module.exports = router;
