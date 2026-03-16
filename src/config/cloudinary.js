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
    const isPdf = file.mimetype === 'application/pdf';
    if (file.mimetype.startsWith('image/')) mediaType = 'image';
    else if (isPdf) mediaType = 'pdf';
    
    // For 'raw' (PDFs), we MUST include the extension in public_id to access it easily.
    // For 'image', we strip it so Cloudinary can append the delivery format automatically.
    let sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    if (!isPdf) {
        sanitizedFilename = sanitizedFilename.replace(/\.[^/.]+$/, "");
    }

    return {
        folder: `mcq-practice/${sanitizedSubject}/${mediaType}`,
        resource_type: isPdf ? 'raw' : 'image', 
        public_id: `${Date.now()}-${sanitizedFilename}`
    };
  },
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };
