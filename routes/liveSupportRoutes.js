const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");
const {
  getCustomerConversation,
  getAllConversations,
  createConversation,
  getConversationMessages,
  sendMessage,
  markConversationRead,
  resolveConversation,
} = require("../controllers/liveSupportController");

router.get("/conversations", protect, getCustomerConversation);
router.get("/conversations/all", protect, admin, getAllConversations);
router.post("/conversations", protect, createConversation);
router.get("/conversations/:id/messages", protect, getConversationMessages);
router.post("/conversations/:id/messages", protect, sendMessage);
router.patch("/conversations/:id/read", protect, markConversationRead);
router.patch("/conversations/:id/resolve", protect, resolveConversation);

module.exports = router;
