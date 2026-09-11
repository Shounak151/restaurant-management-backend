const cloudinaryRoot = require("cloudinary"); // raw module: has both .v2 and top-level uploader
const cloudinary = cloudinaryRoot.v2;
const cloudinaryStorage = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// IMPORTANT: multer-storage-cloudinary v2.x internally calls
// `this.cloudinary.v2.uploader.upload_stream(...)`, so it needs the
// *raw* cloudinary module (which itself exposes .v2), not the

const storage = cloudinaryStorage({
  cloudinary: cloudinaryRoot,
  params: {
    folder: "tastybites/menu-items",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  },
});

module.exports = { cloudinary, storage };