require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRouter = require("./routes/authRouter");
const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Database Connected");

    app.listen(port, () => {
      console.log(`Server is running on PORT ${port}`);
    });
  } catch (error) {
    console.error("Unable to connect to Database:", error);
    process.exit(1);
  }
};
start();
