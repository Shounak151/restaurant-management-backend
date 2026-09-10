const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: ["Starter", "Main Course", "Dessert", "Beverage"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: 0,
    },
    availability: {
      type: Boolean,
      default: true, // true = In Stock, false = Out of Stock
    },
    image: {
      type: String, // Cloudinary URL
      default: "",
    },
    imagePublicId: {
      type: String, // Cloudinary public_id, needed for deleting/updating image
      default: "",
    },
  },
  { timestamps: true } // createdAt & updatedAt
);

menuItemSchema.index({ name: "text", description: "text" });

module.exports = mongoose.model("MenuItem", menuItemSchema);
