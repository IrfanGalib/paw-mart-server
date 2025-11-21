require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// JWT SECRET
const jwtToken = process.env.JWT_SECRET;

// MONGODB CONNECTION
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@firstmongdbproject.yank7ts.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri);

let listingCollection;
let usersCollection;
let ordersCollection;

// VERIFY TOKEN MIDDLEWARE
const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({ error: true, message: "No token provided" });
  }

  const token = authorization.split(" ")[1];

  jwt.verify(token, jwtToken, (err, decoded) => {
    if (err) {
      return res.status(403).send({ error: true, message: "Invalid token" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    console.log("MongoDB Connected!");

    const db = client.db("pet-mart-db");
    listingCollection = db.collection("listings");
    usersCollection = db.collection("users");
    ordersCollection = db.collection("orders"); // <-- initialize ordersCollection

    // GET LISTINGS
    app.get("/listings", async (req, res) => {
      try {
        const result = await listingCollection.find().toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch listings" });
      }
    });

    // USERS
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const query = { email: user.email };
        const updateDoc = { $set: user };
        const options = { upsert: true };

        const result = await usersCollection.updateOne(
          query,
          updateDoc,
          options
        );

        res.send({
          success: true,
          message: "User synced successfully.",
          result,
        });
      } catch (error) {
        console.error("User POST error:", error);
        res
          .status(500)
          .send({ error: true, message: "Failed to sync user data" });
      }
    });

    // GENERATE TOKEN
    app.post("/getToken", (req, res) => {
      const loggedUser = req.body;
      const token = jwt.sign(loggedUser, jwtToken, { expiresIn: "1h" });
      res.send({ token });
    });

    // CREATE LISTING
    app.post("/listings", verifyToken, async (req, res) => {
      const data = req.body;

      if (req.decoded.email !== data.email) {
        return res.status(403).send({
          success: false,
          message: "Forbidden: Email mismatch",
        });
      }

      try {
        const result = await listingCollection.insertOne(data);
        res.send({
          success: true,
          listingId: result.insertedId,
          message: "Listing created successfully",
        });
      } catch (err) {
        res.status(500).send({ message: "Insert failed" });
      }
    });

    // ORDERS 
    app.post("/orders", verifyToken, async (req, res) => {
      try {
        const orderData = req.body;

        if (!ordersCollection) {
          return res
            .status(500)
            .send({ success: false, message: "Orders collection not initialized" });
        }

        const result = await ordersCollection.insertOne(orderData);

        res.send({
          success: true,
          message: "Order saved successfully",
          data: result,
        });
      } catch (err) {
        console.error("Order save FAILED:", err);
        res.status(500).send({
          success: false,
          message: "Error saving order",
        });
      }
    });

    console.log("Routes registered and ready.");
  } catch (err) {
    console.error("MongoDB connection failed →", err);
    process.exit(1);
  }
}

run().catch(console.error);

// ROOT
app.get("/", (req, res) => {
  res.send("Server Running");
});

// LISTEN
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
