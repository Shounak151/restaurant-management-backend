const MenuItem = require("../models/MenuItem");
const { cloudinary } = require("../config/cloudinary");

const getImageUrl = (file) => {
  const url = file?.secure_url || file?.path || file?.url || "";
  return url.replace(/^http:\/\//i, "https://");
};

const getPublicId = (file) => file?.public_id || file?.filename || file?.file_id || "";

const normalizeMenuItemImage = (menuItem) => {
  if (menuItem?.image) menuItem.image = menuItem.image.replace(/^http:\/\//i, "https://");
  return menuItem;
};

// @desc    Get all menu items (with optional search & category filter)
// @route   GET /api/menu-items
// @access  Public
const getMenuItems = async (req, res, next) => {
  try {
    const { search, category } = req.query;
    const filter = {};

    if (search) {
      filter.$text = { $search: search };
    }

    if (category) {
      filter.category = category;
    }

    const menuItems = await MenuItem.find(filter).sort({ createdAt: -1 });
    res.json(menuItems.map(normalizeMenuItemImage));
  } catch (error) {
    next(error);
  }
};

// @desc    Get single menu item by ID
// @route   GET /api/menu-items/:id
// @access  Public
const getMenuItemById = async (req, res, next) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    res.json(normalizeMenuItemImage(menuItem));
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new menu item
// @route   POST /api/menu-items
// @access  Private/Admin
const createMenuItem = async (req, res, next) => {
  try {
    const { name, description, category, price, availability } = req.body;

    if (!name || !description || !category || !price) {
      return res.status(400).json({ message: "Please fill in all required fields" });
    }

    const menuItem = await MenuItem.create({
      name,
      description,
      category,
      price,
      availability: availability !== undefined ? availability : true,
      image: getImageUrl(req.file),
      imagePublicId: getPublicId(req.file),
    });

    res.status(201).json(normalizeMenuItemImage(menuItem));
  } catch (error) {
    next(error);
  }
};

// @desc    Update a menu item
// @route   PUT /api/menu-items/:id
// @access  Private/Admin
const updateMenuItem = async (req, res, next) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    const { name, description, category, price, availability } = req.body;

    menuItem.name = name ?? menuItem.name;
    menuItem.description = description ?? menuItem.description;
    menuItem.category = category ?? menuItem.category;
    menuItem.price = price ?? menuItem.price;
    if (availability !== undefined) menuItem.availability = availability;

    // If a new image was uploaded, replace the old one
    if (req.file) {
      if (menuItem.imagePublicId) {
        await cloudinary.uploader.destroy(menuItem.imagePublicId).catch(() => {});
      }
      menuItem.image = getImageUrl(req.file);
      menuItem.imagePublicId = getPublicId(req.file);
    }

    const updatedMenuItem = await menuItem.save();
    res.json(normalizeMenuItemImage(updatedMenuItem));
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a menu item
// @route   DELETE /api/menu-items/:id
// @access  Private/Admin
const deleteMenuItem = async (req, res, next) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    if (menuItem.imagePublicId) {
      await cloudinary.uploader.destroy(menuItem.imagePublicId).catch(() => {});
    }

    await menuItem.deleteOne();
    res.json({ message: "Menu item removed successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
};
