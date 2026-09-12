const crypto = require("crypto");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const User = require("../models/User");
const { createAdminNotification } = require("../services/adminNotificationService");

let Razorpay;
try {
  Razorpay = require("razorpay");
} catch (_) {
  Razorpay = null;
}

const getRazorpay = () => {
  if (!Razorpay || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
};

const createOrder = async (req, res, next) => {
  try {
    const deliveryAddress = String(req.body.deliveryAddress || "").trim();
    if (deliveryAddress.length < 8 || deliveryAddress.length > 300) {
      return res.status(400).json({ message: "Please provide a valid delivery address" });
    }
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart || cart.items.length === 0) return res.status(400).json({ message: "Your cart is empty" });
    const ids = cart.items.map((item) => item.menuItem);
    const menuItems = await MenuItem.find({ _id: { $in: ids } });
    const byId = new Map(menuItems.map((item) => [item._id.toString(), item]));
    const items = [];
    for (const cartItem of cart.items) {
      const menuItem = byId.get(cartItem.menuItem.toString());
      if (!menuItem || !menuItem.availability) {
        return res.status(400).json({ message: `${menuItem?.name || "An item"} is unavailable. Please update your cart.` });
      }
      items.push({ menuItem: menuItem._id, name: menuItem.name, quantity: cartItem.quantity, price: menuItem.price });
    }
    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order = await Order.create({ user: req.user._id, deliveryAddress, items, totalAmount });
    await cart.deleteOne();
    await createAdminNotification({
      type: "NEW_ORDER",
      title: "New customer order",
      message: `${req.user.name || "A customer"} placed a new order.`,
      relatedId: order._id,
      relatedType: "Order",
    });
    res.status(201).json(await order.populate("user", "name email"));
  } catch (error) {
    next(error);
  }
};

const getMyOrders = async (req, res, next) => {
  try {
    res.json(await Order.find({ user: req.user._id }).sort({ createdAt: -1 }));
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req, res, next) => {
  try {
    res.json(await Order.find().populate("user", "name email").sort({ createdAt: -1 }));
  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const allowed = ["Pending", "Confirmed", "Preparing", "Out for Delivery", "Delivered", "Cancelled"];
    if (!allowed.includes(req.body.orderStatus)) return res.status(400).json({ message: "Invalid order status" });
    const order = await Order.findByIdAndUpdate(req.params.id, { orderStatus: req.body.orderStatus }, { new: true }).populate("user", "name email");
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    next(error);
  }
};

const createPayment = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    const razorpay = getRazorpay();
    if (!razorpay) return res.status(503).json({ message: "Online payments are not configured. Add Razorpay credentials to the backend environment." });
    const paymentOrder = await razorpay.orders.create({ amount: Math.round(order.totalAmount * 100), currency: "INR", receipt: order._id.toString() });
    order.paymentOrderId = paymentOrder.id;
    await order.save();
    res.json({ key: process.env.RAZORPAY_KEY_ID, paymentOrderId: paymentOrder.id, amount: paymentOrder.amount, currency: paymentOrder.currency });
  } catch (error) {
    next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order || order.paymentOrderId !== razorpay_order_id) return res.status(400).json({ message: "Payment order mismatch" });
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if (expected !== razorpay_signature) return res.status(400).json({ message: "Payment verification failed" });
    order.paymentId = razorpay_payment_id;
    order.paymentStatus = "Paid";
    await order.save();
    res.json(order);
  } catch (error) {
    next(error);
  }
};

const canCancelOrder = (status) => ["Pending", "Confirmed", "Preparing"].includes(status);

const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    next(error);
  }
};

const getTrackOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).select("_id orderStatus totalAmount items createdAt paymentStatus");
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!canCancelOrder(order.orderStatus)) {
      return res.status(400).json({ message: "This order cannot be cancelled in its current status." });
    }

    order.orderStatus = "Cancelled";
    await order.save();
    res.json({ message: `Your order #${order._id} has been cancelled.`, order });
  } catch (error) {
    next(error);
  }
};

const getOrderStats = async () => {
  const [totalOrders, revenue, pendingOrders, completedOrders] = await Promise.all([
    Order.countDocuments(),
    Order.aggregate([{ $match: { paymentStatus: "Paid", orderStatus: { $ne: "Cancelled" } } }, { $group: { _id: null, value: { $sum: "$totalAmount" } } }]),
    Order.countDocuments({ orderStatus: { $in: ["Pending", "Confirmed", "Preparing", "Out for Delivery"] } }),
    Order.countDocuments({ orderStatus: "Delivered" }),
  ]);
  return { totalOrders, totalSales: revenue[0]?.value || 0, pendingOrders, completedOrders };
};

module.exports = { createOrder, getMyOrders, getOrders, getOrderById, getTrackOrder, cancelOrder, updateOrderStatus, createPayment, verifyPayment, getOrderStats, canCancelOrder };