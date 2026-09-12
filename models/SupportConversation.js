const mongoose = require("mongoose");

const supportConversationSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    status: {
      type: String,
      enum: ["Open", "Active", "Waiting for Customer", "Waiting for Admin", "Resolved", "Closed"],
      default: "Open",
    },
    unreadForCustomer: {
      type: Number,
      default: 0,
    },
    unreadForAdmin: {
      type: Number,
      default: 0,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupportConversation", supportConversationSchema);
