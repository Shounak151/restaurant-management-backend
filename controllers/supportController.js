const SupportTicket = require("../models/SupportTicket");
const Order = require("../models/Order");
const { faqItems } = require("../data/chatbotFaq");
const { createAdminNotification } = require("../services/adminNotificationService");

const sanitizeObjectId = (value, label = "id") => {
  if (!value || !/^[0-9a-fA-F]{24}$/.test(String(value))) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
};

const getFaq = async (req, res, next) => {
  try {
    res.json({ items: faqItems });
  } catch (error) {
    next(error);
  }
};

const createTicket = async (req, res, next) => {
  try {
    const { orderId, issueType, message } = req.body;

    if (!issueType || !message || !String(message).trim()) {
      return res.status(400).json({ message: "Please provide an issue type and message" });
    }

    let order = null;
    if (orderId) {
      try {
        sanitizeObjectId(orderId, "order id");
      } catch (_) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      order = await Order.findOne({ _id: orderId, user: req.user._id });
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
    }

    const ticket = await SupportTicket.create({
      user: req.user._id,
      order: order?._id || null,
      issueType: String(issueType).trim(),
      message: String(message).trim(),
      status: "Open",
      conversation: [{ role: "user", message: String(message).trim() }],
    });

    const populated = await ticket.populate([{ path: "user", select: "name email" }, { path: "order", select: "_id orderStatus paymentStatus totalAmount" }]);
    await createAdminNotification({
      type: "SUPPORT_TICKET",
      title: "New support ticket",
      message: `${populated.user?.name || "A customer"} reported: ${populated.issueType}.`,
      relatedId: ticket._id,
      relatedType: "SupportTicket",
    });
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

const getMyTickets = async (req, res, next) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user._id })
      .populate([{ path: "user", select: "name email" }, { path: "order", select: "_id orderStatus paymentStatus totalAmount" }])
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (error) {
    next(error);
  }
};

const getTicketById = async (req, res, next) => {
  try {
    const ticketId = sanitizeObjectId(req.params.id, "ticket id");
    const ticket = await SupportTicket.findOne({ _id: ticketId, user: req.user._id })
      .populate([{ path: "user", select: "name email" }, { path: "order", select: "_id orderStatus paymentStatus totalAmount" }]);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.json(ticket);
  } catch (error) {
    if (error.message === "Invalid ticket id") {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }
    next(error);
  }
};

const getAllTickets = async (req, res, next) => {
  try {
    const tickets = await SupportTicket.find()
      .populate([{ path: "user", select: "name email" }, { path: "order", select: "_id orderStatus paymentStatus totalAmount" }])
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (error) {
    next(error);
  }
};

const updateTicketStatus = async (req, res, next) => {
  try {
    const ticketId = sanitizeObjectId(req.params.id, "ticket id");
    const status = req.body.status;
    const allowed = ["Open", "In Progress", "Resolved", "Closed"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid ticket status" });
    }

    const ticket = await SupportTicket.findByIdAndUpdate(ticketId, { status }, { new: true })
      .populate([{ path: "user", select: "name email" }, { path: "order", select: "_id orderStatus paymentStatus totalAmount" }]);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.json(ticket);
  } catch (error) {
    if (error.message === "Invalid ticket id") {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }
    next(error);
  }
};

const addTicketReply = async (req, res, next) => {
  try {
    const ticketId = sanitizeObjectId(req.params.id, "ticket id");
    const { message } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "Please provide a message" });
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const role = req.user && req.user.role === "Admin" ? "admin" : "user";

    if (req.user.role === "Admin") {
      ticket.status = "In Progress";
    }

    ticket.conversation.push({ role, message: String(message).trim() });
    await ticket.save();

    const populated = await ticket.populate([{ path: "user", select: "name email" }, { path: "order", select: "_id orderStatus paymentStatus totalAmount" }]);
    res.json(populated);
  } catch (error) {
    if (error.message === "Invalid ticket id") {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }
    next(error);
  }
};

module.exports = {
  getFaq,
  createTicket,
  getMyTickets,
  getTicketById,
  getAllTickets,
  updateTicketStatus,
  addTicketReply,
};
