const User = require("../models/User");
const MenuItem = require("../models/MenuItem");

// @desc    Get all registered users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "Admin") {
      return res.status(400).json({ message: "Cannot delete an Admin account" });
    }

    await user.deleteOne();
    res.json({ message: "User removed successfully" });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard summary stats
// @route   GET /api/dashboard/stats
// @access  Private/Admin
const getDashboardStats = async (req, res, next) => {
  try {
    const totalMenuItems = await MenuItem.countDocuments();
    const totalUsers = await User.countDocuments({ role: "User" });
    // Orders module is not implemented yet in this version — placeholder for future use
    const totalOrders = 0;

    res.json({ totalMenuItems, totalUsers, totalOrders });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, deleteUser, getDashboardStats };
