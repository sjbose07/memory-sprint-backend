const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { upload } = require('../config/cloudinary');

router.use(authMiddleware);

// POST /upload
router.post('/', requireRole('admin', 'moderator'), upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        res.status(200).json({
            url: req.file.path,
            filename: req.file.originalname,
            format: req.file.format || req.file.path.split('.').pop()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
