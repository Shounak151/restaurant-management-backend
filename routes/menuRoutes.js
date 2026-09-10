const express = require("express");
const router = express.Router();
const {
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} = require("../controllers/menuController");
const { protect, admin } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

// Public routes
router.get("/", getMenuItems);
router.get("/:id", getMenuItemById);

// Admin-only routes
router.post("/", protect, admin, upload.single("image"), createMenuItem);
router.put("/:id", protect, admin, upload.single("image"), updateMenuItem);
router.delete("/:id", protect, admin, deleteMenuItem);

module.exports = router;
