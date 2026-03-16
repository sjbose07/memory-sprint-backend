const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
} else if (process.env.CLOUDINARY_URL) {
    // If discrete vars are missing, the SDK can use CLOUDINARY_URL automatically
    // but calling config() without args ensures it's initialized from the env.
    cloudinary.config();
} else {
    console.error('Cloudinary configuration is missing in environment variables!');
}

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Determine folder structure: mcq-practice/[subject]/[type]
    // Expecting 'subject' and 'type' in req.body. 
    // IMPORTANT: Frontend MUST append these to FormData BEFORE the 'file' field.
    const rawSubject = req.body.subject || 'General';
    const sanitizedSubject = rawSubject.replace(/[^a-zA-Z0-9]/g, "_");
    
    let mediaType = 'other';
    if (file.mimetype.startsWith('image/')) {
        mediaType = 'image';
    } else if (file.mimetype === 'application/pdf') {
        mediaType = 'pdf';
    }

    return {
        folder: `mcq-practice/${sanitizedSubject}/${mediaType}`,
        resource_type: 'auto', 
        public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`
    };
  },
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };
