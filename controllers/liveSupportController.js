const SupportConversation = require("../models/SupportConversation");
const SupportMessage = require("../models/SupportMessage");
const Order = require("../models/Order");
const User = require("../models/User");

const sanitizeObjectId = (value, label = "id") => {
  if (!value || !/^[0-9a-fA-F]{24}$/.test(String(value))) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
};

const getCustomerConversation = async (req, res, next) => {
  try {
    const conversations = await SupportConversation.find({ customer: req.user._id })
      .populate("customer", "name email")
      .populate("order", "_id orderStatus totalAmount paymentStatus")
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    next(error);
  }
};

const getAllConversations = async (req, res, next) => {
  try {
    const conversations = await SupportConversation.find()
      .populate("customer", "name email")
      .populate("order", "_id orderStatus totalAmount paymentStatus")
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    next(error);
  }
};

const createConversation = async (req, res, next) => {
  try {
    const { orderId } = req.body;
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

    let conversation = await SupportConversation.findOne({ customer: req.user._id, status: { $in: ["Open", "Active", "Waiting for Customer", "Waiting for Admin"] } });

    if (conversation) {
      if (order && conversation.order?.toString() !== order._id.toString()) {
        conversation.order = order._id;
        await conversation.save();
      }
      return res.json(conversation);
    }

    conversation = await SupportConversation.create({
      customer: req.user._id,
      order: order?._id || null,
      status: "Open",
      unreadForAdmin: 1,
    });

    res.status(201).json(await conversation.populate(["customer", "order"]));
  } catch (error) {
    next(error);
  }
};

const getConversationMessages = async (req, res, next) => {
  try {
    const conversationId = sanitizeObjectId(req.params.id, "conversation id");
    const conversation = await SupportConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (req.user.role !== "Admin" && conversation.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You do not have access to this conversation" });
    }

    const messages = await SupportMessage.find({ conversation: conversationId })
      .populate("sender", "name email")
      .sort({ createdAt: 1 });

    res.json({ conversation, messages });
  } catch (error) {
    if (error.message === "Invalid conversation id") {
      return res.status(400).json({ message: "Invalid conversation ID" });
    }
    next(error);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const conversationId = sanitizeObjectId(req.params.id, "conversation id");
    const { message } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "Please provide a message" });
    }

    const conversation = await SupportConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (req.user.role !== "Admin" && conversation.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You do not have access to this conversation" });
    }

    const senderRole = req.user.role === "Admin" ? "admin" : "customer";
    const savedMessage = await SupportMessage.create({
      conversation: conversationId,
      sender: req.user._id,
      senderRole,
      message: String(message).trim(),
    });

    conversation.status = req.user.role === "Admin" ? "Waiting for Customer" : "Waiting for Admin";
    conversation.lastMessageAt = new Date();

    if (req.user.role === "Admin") {
      conversation.unreadForCustomer = (conversation.unreadForCustomer || 0) + 1;
      conversation.unreadForAdmin = 0;
    } else {
      conversation.unreadForAdmin = (conversation.unreadForAdmin || 0) + 1;
      conversation.unreadForCustomer = 0;
    }

    await conversation.save();

    const populated = await savedMessage.populate("sender", "name email");
    res.status(201).json(populated);
  } catch (error) {
    if (error.message === "Invalid conversation id") {
      return res.status(400).json({ message: "Invalid conversation ID" });
    }
    next(error);
  }
};

const markConversationRead = async (req, res, next) => {
  try {
    const conversationId = sanitizeObjectId(req.params.id, "conversation id");
    const conversation = await SupportConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (req.user.role !== "Admin" && conversation.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You do not have access to this conversation" });
    }

    if (req.user.role === "Admin") {
      conversation.unreadForAdmin = 0;
    } else {
      conversation.unreadForCustomer = 0;
    }

    await conversation.save();
    res.json(conversation);
  } catch (error) {
    if (error.message === "Invalid conversation id") {
      return res.status(400).json({ message: "Invalid conversation ID" });
    }
    next(error);
  }
};

const resolveConversation = async (req, res, next) => {
  try {
    const conversationId = sanitizeObjectId(req.params.id, "conversation id");
    const conversation = await SupportConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (req.user.role !== "Admin" && conversation.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You do not have access to this conversation" });
    }

    conversation.status = "Resolved";
    await conversation.save();
    res.json(conversation);
  } catch (error) {
    if (error.message === "Invalid conversation id") {
      return res.status(400).json({ message: "Invalid conversation ID" });
    }
    next(error);
  }
};

module.exports = {
  getCustomerConversation,
  getAllConversations,
  createConversation,
  getConversationMessages,
  sendMessage,
  markConversationRead,
  resolveConversation,
};
