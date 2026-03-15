const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { upload } = require('../config/cloudinary');

router.use(authMiddleware);

// POST /upload
router.post('/', requireRole('admin', 'moderator'), (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('Multer/Cloudinary Error details:', err);
            return res.status(500).json({ 
                error: 'Upload failed', 
                details: err.message,
                cloudinary_code: err.http_code
            });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            res.status(200).json({
                url: req.file.path,
                filename: req.file.originalname,
                format: req.file.format || req.file.path.split('.').pop()
            });
        } catch (error) {
            console.error('Upload processing error:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

module.exports = router;
