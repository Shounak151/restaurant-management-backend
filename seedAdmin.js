// Run this once to create the first Admin account:  node seedAdmin.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const email = (process.env.ADMIN_EMAIL || "admin@tastybites.com").toLowerCase();

    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      console.log("An admin with this email already exists:", email);
      process.exit();
    }

    const admin = await User.create({
      name: process.env.ADMIN_NAME || "Admin",
      email,
      password: process.env.ADMIN_PASSWORD || "Admin@123",
      role: "Admin",
    });

    console.log("Admin account created successfully:");
    console.log({ name: admin.name, email: admin.email, role: admin.role });
    process.exit();
  } catch (error) {
    console.error("Error seeding admin:", error.message);
    process.exit(1);
  }
};

seedAdmin();
