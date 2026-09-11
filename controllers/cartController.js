const Cart = require("../models/Cart");
const MenuItem = require("../models/MenuItem");

const getCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate("items.menuItem");
    res.json(cart || { user: req.user._id, items: [] });
  } catch (error) {
    next(error);
  }
};

const addToCart = async (req, res, next) => {
  try {
    const { menuItemId, quantity = 1 } = req.body;
    const amount = Number(quantity);
    if (!menuItemId || !Number.isInteger(amount) || amount < 1 || amount > 20) {
      return res.status(400).json({ message: "Choose a valid quantity between 1 and 20" });
    }
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) return res.status(404).json({ message: "Menu item not found" });
    if (!menuItem.availability) return res.status(400).json({ message: "This item is currently out of stock" });

    const cart = await Cart.findOneAndUpdate(
      { user: req.user._id },
      { $setOnInsert: { user: req.user._id } },
      { new: true, upsert: true }
    );
    const existing = cart.items.find((item) => item.menuItem.toString() === menuItemId);
    if (existing) existing.quantity = Math.min(existing.quantity + amount, 20);
    else cart.items.push({ menuItem: menuItemId, quantity: amount });
    await cart.save();
    res.status(201).json(await cart.populate("items.menuItem"));
  } catch (error) {
    next(error);
  }
};

const updateCartItem = async (req, res, next) => {
  try {
    const amount = Number(req.body.quantity);
    if (!Number.isInteger(amount) || amount < 0 || amount > 20) {
      return res.status(400).json({ message: "Choose a valid quantity between 0 and 20" });
    }
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: "Cart not found" });
    const item = cart.items.find((entry) => entry.menuItem.toString() === req.params.menuItemId);
    if (!item) return res.status(404).json({ message: "Item is not in your cart" });
    if (amount === 0) cart.items = cart.items.filter((entry) => entry.menuItem.toString() !== req.params.menuItemId);
    else item.quantity = amount;
    await cart.save();
    res.json(await cart.populate("items.menuItem"));
  } catch (error) {
    next(error);
  }
};

const removeFromCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { items: { menuItem: req.params.menuItemId } } },
      { new: true }
    ).populate("items.menuItem");
    res.json(cart || { user: req.user._id, items: [] });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCart, addToCart, updateCartItem, removeFromCart };