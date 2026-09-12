require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const User = require("./models/User");
const SupportConversation = require("./models/SupportConversation");
const SupportMessage = require("./models/SupportMessage");
const { setNotificationIo, createAdminNotification } = require("./services/adminNotificationService");

// Route imports
const authRoutes = require("./routes/authRoutes");
const menuRoutes = require("./routes/menuRoutes");
const userRoutes = require("./routes/userRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const supportRoutes = require("./routes/supportRoutes");
const liveSupportRoutes = require("./routes/liveSupportRoutes");
const adminNotificationRoutes = require("./routes/adminNotificationRoutes");

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);
const allowedOrigins = [process.env.FRONTEND_URL, process.env.CLIENT_URL, "http://localhost:5173"]
  .filter(Boolean)
  .flatMap((value) => value.split(",").map((origin) => origin.trim().replace(/\/$/, "")));
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true,
};
const io = new Server(server, {
  path: "/socket.io",
  cors: { ...corsOptions, methods: ["GET", "POST"] },
});
setNotificationIo(io);

// Middleware
app.use(
  cors({
    ...corsOptions,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/", (req, res) => {
  res.json({ message: "TastyBites API is running" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/menu-items", menuRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/live-support", liveSupportRoutes);
app.use("/api/admin/notifications", adminNotificationRoutes);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (!token) return next(new Error("Not authorized, no token provided"));

    const cleanToken = String(token).startsWith("Bearer ") ? String(token).slice(7) : String(token);
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) return next(new Error("User not found"));

    socket.user = user;
    next();
  } catch (error) {
    next(new Error("Not authorized, token failed"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.user._id.toString();
  const userRole = socket.user.role;

  socket.join(`user:${userId}`);
  if (userRole === "Admin") {
    socket.join("admins");
  }

  socket.on("support:join", async (conversationId) => {
    if (!conversationId) return;

    try {
      const conversation = await SupportConversation.findById(conversationId).select("customer");
      if (!conversation) return;

      const isCustomer = conversation.customer.toString() === userId;
      if (userRole !== "Admin" && !isCustomer) return;

      socket.join(`support:${conversationId}`);
    } catch (_) {
      // Ignore invalid or unauthorized room joins.
    }
  });

  socket.on("support:leave", (conversationId) => {
    if (!conversationId) return;
    socket.leave(`support:${conversationId}`);
  });

  socket.on("support:send-message", async ({ conversationId, message }) => {
    if (!conversationId || !message || !String(message).trim()) return;

    try {
      const conversation = await SupportConversation.findById(conversationId);
      if (!conversation) return;

      if (userRole !== "Admin" && conversation.customer.toString() !== userId) {
        return;
      }

      const senderRole = userRole === "Admin" ? "admin" : "customer";
      const savedMessage = await SupportMessage.create({
        conversation: conversationId,
        sender: userId,
        senderRole,
        message: String(message).trim(),
      });

      conversation.status = senderRole === "admin" ? "Waiting for Customer" : "Waiting for Admin";
      conversation.lastMessageAt = new Date();

      if (senderRole === "admin") {
        conversation.unreadForCustomer = (conversation.unreadForCustomer || 0) + 1;
        conversation.unreadForAdmin = 0;
      } else {
        conversation.unreadForAdmin = (conversation.unreadForAdmin || 0) + 1;
        conversation.unreadForCustomer = 0;
      }

      await conversation.save();

      const populated = await savedMessage.populate("sender", "name email");
      io.to(`support:${conversationId}`).emit("support:new-message", {
        conversationId,
        messageId: populated._id.toString(),
        senderId: userId,
        senderRole,
        message: populated.message,
        createdAt: populated.createdAt,
        senderName: populated.sender?.name || "Support",
      });

      if (senderRole === "customer") {
        await createAdminNotification({
          type: "LIVE_SUPPORT_MESSAGE",
          title: "New live support message",
          message: `${populated.sender?.name || "A customer"} sent a live support message.`,
          relatedId: conversationId,
          relatedType: "SupportConversation",
          skipIfAdminViewing: conversationId,
        });
      }
    } catch (_) {
      // Socket message errors must not terminate the connection.
    }
  });

  socket.on("support:typing", ({ conversationId, isTyping }) => {
    if (!conversationId) return;
    socket.to(`support:${conversationId}`).emit("support:typing", {
      conversationId,
      userId,
      senderRole: userRole === "Admin" ? "admin" : "customer",
      isTyping,
    });
  });

  socket.on("support:read", ({ conversationId }) => {
    if (!conversationId) return;
    io.to(`support:${conversationId}`).emit("support:read", {
      conversationId,
      userId,
      readBy: userRole,
    });
  });

  socket.on("disconnect", () => {
    socket.rooms.forEach((room) => {
      if (room.startsWith("support:")) {
        socket.leave(room);
      }
    });
  });
});

// Error handling (must be last)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Socket.IO initialized on /socket.io");
});
