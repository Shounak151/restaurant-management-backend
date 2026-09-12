const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");
const {
  getFaq,
  createTicket,
  getMyTickets,
  getTicketById,
  getAllTickets,
  updateTicketStatus,
  addTicketReply,
} = require("../controllers/supportController");

router.get("/faq", getFaq);
router.get("/tickets", protect, getMyTickets);
router.post("/tickets", protect, createTicket);
router.get("/tickets/all", protect, admin, getAllTickets);
router.get("/tickets/:id", protect, getTicketById);
router.patch("/tickets/:id/status", protect, admin, updateTicketStatus);
router.post("/tickets/:id/reply", protect, addTicketReply);

module.exports = router;
