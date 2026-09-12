const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");
const { getNotificationCounts, readNotifications } = require("../controllers/adminNotificationController");

router.use(protect, admin);
router.get("/counts", getNotificationCounts);
router.patch("/read", readNotifications);

module.exports = router;
