const express = require('express');
const router = express.Router();
const { listMaterials, createMaterial, updateMaterial, deleteMaterial } = require('../controllers/studyMaterialsController');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/roles');

router.use(authMiddleware);

router.get('/', listMaterials);
router.post('/', requireRole('admin', 'moderator'), createMaterial);
router.patch('/:id', requireRole('admin', 'moderator'), updateMaterial);
router.delete('/:id', requireRole('admin', 'moderator'), deleteMaterial);

module.exports = router;
