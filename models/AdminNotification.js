const mongoose = require("mongoose");

const adminNotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["NEW_ORDER", "NEW_CUSTOMER", "SUPPORT_TICKET", "LIVE_SUPPORT_MESSAGE"],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    relatedType: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

adminNotificationSchema.index({ isRead: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("AdminNotification", adminNotificationSchema);
