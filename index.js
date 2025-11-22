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
    ordersCollection = db.collection("orders");

    // GET LISTINGS
    app.get("/listings", async (req, res) => {
      try {
        const { email } = req.query;
        const filter = email ? { email } : {};
        const result = await listingCollection.find(filter).toArray();
        res.send(result);
      } catch (err) {
        console.error("GET /listings failed:", err);
        res.status(500).send({ message: "Failed to fetch listings" });
      }
    });

    // Create listing
    app.post("/listings", verifyToken, async (req, res) => {
      const data = req.body;

      if (req.decoded.email !== data.email) {
        return res.status(403).send({
          success: false,
          message: "Forbidden: Email mismatch",
        });
      }

      try {
        const toInsert = { ...data, created_at: new Date() };
        const result = await listingCollection.insertOne(toInsert);

        res.send({
          success: true,
          listingId: result.insertedId,
          message: "Listing created successfully",
        });
      } catch (err) {
        console.error("POST /listings failed:", err);
        res.status(500).send({ message: "Insert failed" });
      }
    });

    // Update listing
    app.put("/listings/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const updates = req.body;

        const existing = await listingCollection.findOne({ _id: new ObjectId(id) });
        if (!existing) {
          return res.status(404).send({ success: false, message: "Listing not found" });
        }
        if (req.decoded.email !== existing.email) {
          return res.status(403).send({ success: false, message: "Forbidden: not owner" });
        }

        const updateDoc = { $set: { ...updates, updated_at: new Date() } };
        const result = await listingCollection.updateOne({ _id: new ObjectId(id) }, updateDoc);

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Listing updated" });
        } else {
          res.send({ success: false, message: "No changes made" });
        }
      } catch (err) {
        console.error("PUT /listings/:id failed:", err);
        res.status(500).send({ success: false, message: "Failed to update" });
      }
    });

    // Delete listing
    app.delete("/listings/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const existing = await listingCollection.findOne({ _id: new ObjectId(id) });
        if (!existing) {
          return res.status(404).send({ success: false, message: "Listing not found" });
        }

        if (req.decoded.email !== existing.email) {
          return res.status(403).send({ success: false, message: "Forbidden: not owner" });
        }

        const result = await listingCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount > 0) {
          res.send({ success: true, message: "Listing deleted" });
        } else {
          res.send({ success: false, message: "Failed to delete" });
        }
      } catch (err) {
        console.error("DELETE /listings/:id failed:", err);
        res.status(500).send({ success: false, message: "Failed to delete" });
      }
    });

    // ORDERS
    app.post("/orders", verifyToken, async (req, res) => {
      try {
        const orderData = req.body;

        if (!ordersCollection) {
          return res.status(500).send({
            success: false,
            message: "Orders collection not initialized",
          });
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
