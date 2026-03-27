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
    let resourceType = 'raw';
    
    if (file.mimetype.startsWith('image/')) {
        mediaType = 'image';
        resourceType = 'image';
    } else if (file.mimetype.startsWith('video/')) {
        mediaType = 'video';
        resourceType = 'video';
    } else if (file.mimetype === 'application/pdf') {
        mediaType = 'pdf';
        resourceType = 'raw';
    }

    const isPdf = file.mimetype === 'application/pdf';
    const isVideo = file.mimetype.startsWith('video/');
    // 1. Clear special characters but keep underscores and hyphens
    let sanitizedName = file.originalname
        .replace(/\.[^/.]+$/, "") // Temporarily remove extension
        .replace(/[^a-zA-Z0-9-]/g, "_"); // Replace non-alphanumeric with _

    // 2. Logic to prevent "Blocked for delivery" and 404:
    // - PDF must be 'raw' to avoid account delivery restrictions.
    // - 'raw' files MUST have an extension in public_id.
    // - 'video' files often need extension too to be served with correct header depending on context, or can rely on format. We keep extension for raw and let Cloudinary handle videos properly.
    if (isPdf) {
        sanitizedName += ".pdf";
    }
    
    return {
        folder: `mcq-practice/${sanitizedSubject}/${mediaType}`,
        resource_type: resourceType, 
        public_id: `${Date.now()}-${sanitizedName}`
    };
  },
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };
