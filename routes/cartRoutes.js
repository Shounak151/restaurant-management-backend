const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getCart, addToCart, updateCartItem, removeFromCart } = require("../controllers/cartController");

router.use(protect);
router.get("/", getCart);
router.post("/items", addToCart);
router.patch("/items/:menuItemId", updateCartItem);
router.delete("/items/:menuItemId", removeFromCart);

module.exports = router;