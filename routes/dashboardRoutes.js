const express = require("express");
const router = express.Router();
const { getDashboardStats } = require("../controllers/userController");
const { protect, admin } = require("../middleware/authMiddleware");

router.get("/stats", protect, admin, getDashboardStats);

module.exports = router;
