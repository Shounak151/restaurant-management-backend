const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");
const { createOrder, getMyOrders, getOrders, updateOrderStatus, createPayment, verifyPayment } = require("../controllers/orderController");

router.use(protect);
router.post("/", createOrder);
router.get("/mine", getMyOrders);
router.post("/:id/payment", createPayment);
router.post("/:id/verify-payment", verifyPayment);
router.get("/", admin, getOrders);
router.patch("/:id/status", admin, updateOrderStatus);

module.exports = router;