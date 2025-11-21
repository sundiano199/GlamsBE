require("dotenv").config();
const mongoose = require("mongoose");
const product = require("./models/product");
const productJson = require("./product.json");
const populate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Database for API connected successfully");

    console.log("Deleting previous data...");
    await product.deleteMany();
    console.log("Previous Metod deleted succesfully");

    console.log("uploading new data");
    await product.create(productJson);
    console.log(productJson);

    console.log("products uploaded successfully to the databse");
    process.exit(0);
  } catch (error) {
    console.error({ Error: error.message });
    console.log("Unable to connect");
    process.exit(1);
  }
};

populate();
