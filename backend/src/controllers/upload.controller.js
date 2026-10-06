const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };

// Local disk storage for receipts and photos. For production, swap this for S3/Cloudinary.
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ALLOWED[file.mimetype]}`),
  }),
  limits: { fileSize: env.uploadMaxMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (ALLOWED[file.mimetype] ? cb(null, true) : cb(ApiError.badRequest('Only JPG, PNG, WEBP or PDF files are allowed'))),
});

exports.middleware = upload.single('file');
exports.UPLOAD_DIR = UPLOAD_DIR;
exports.handle = (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
};
