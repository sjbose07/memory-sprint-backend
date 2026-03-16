const { cloudinary } = require('../config/cloudinary');

/**
 * Extracts public_id and resource_type from a Cloudinary URL.
 */
const extractPublicIdFromUrl = (url) => {
    try {
        if (!url || !url.includes('res.cloudinary.com')) return null;
        
        const parts = url.split('/');
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex === -1) return null;
        
        // Parts after 'v[version]/' is the public_id including folder
        // parts[uploadIndex + 1] is usually 'v12345678'
        const pathAfterVersion = parts.slice(uploadIndex + 2).join('/');
        
        // Remove file extension
        const publicId = pathAfterVersion.replace(/\.[^/.]+$/, "");
        
        // Resource type is the part before 'upload' (usually 'image' or 'raw')
        const resourceType = parts[uploadIndex - 1]; 
        
        return { publicId, resourceType };
    } catch (e) {
        console.error('Error extracting Cloudinary info:', e);
        return null;
    }
};

/**
 * Deletes a single file from Cloudinary by its URL.
 */
const deleteFileByUrl = async (url) => {
    const data = extractPublicIdFromUrl(url);
    if (!data) return;
    
    try {
        await cloudinary.uploader.destroy(data.publicId, { resource_type: data.resourceType });
        console.log(`[Cloudinary] Deleted: ${data.publicId} (${data.resourceType})`);
    } catch (e) {
        console.error(`[Cloudinary] Deletion failed for ${url}:`, e);
    }
};

/**
 * Scans a string (HTML/Markdown) for any Cloudinary URLs and deletes them.
 */
const deleteAssetsFromText = async (text) => {
    if (!text) return;
    // Regex to find Cloudinary URLs
    const urlRegex = /https?:\/\/res\.cloudinary\.com\/[^\s"'<>]+/g;
    const matches = text.match(urlRegex);
    if (matches) {
        // Use a set to avoid deleting the same URL twice if it appears multiple times
        const uniqueUrls = [...new Set(matches)];
        for (const url of uniqueUrls) {
            await deleteFileByUrl(url);
        }
    }
};

module.exports = { deleteFileByUrl, deleteAssetsFromText };
