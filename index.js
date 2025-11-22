require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

// ========= MIDDLEWARE =========
app.use(cors());
app.use(express.json());

// JWT SECRET
const jwtToken = process.env.JWT_SECRET;

// ========= MONGODB CONNECTION =========
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@firstmongdbproject.yank7ts.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri);

let listingCollection;
let usersCollection;
let ordersCollection;

// ========= JWT VERIFY FUNCTION =========
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

// ========= START SERVER =========
async function run() {
  try {
    await client.connect();
    console.log("MongoDB Connected!");

    const db = client.db("pet-mart-db");
    listingCollection = db.collection("listings");
    usersCollection = db.collection("users");
    ordersCollection = db.collection("orders");

    // ========== LISTINGS ==========

    // GET ALL LISTINGS OR FILTER BY EMAIL
    app.get("/listings", async (req, res) => {
      const email = req.query.email;
      let query = {};

      if (email) {
        query.email = email;
      }

      const listings = await listingCollection
        .find(query)
        .sort({ created_at: -1 })
        .toArray();

      res.send(listings);
    });

    // GET RECENT LISTINGS (LIMIT 6)
    app.get("/listings/recent", async (req, res) => {
      const listings = await listingCollection
        .find()
        .sort({ created_at: -1 })
        .limit(6)
        .toArray();

      res.send(listings);
    });

    // CREATE LISTING (PROTECTED)
    app.post("/listings", verifyToken, async (req, res) => {
      const data = req.body;

      if (req.decoded.email !== data.email) {
        return res.status(403).send({ message: "Forbidden email mismatch" });
      }

      data.created_at = new Date();

      const result = await listingCollection.insertOne(data);
      res.send({ success: true, listingId: result.insertedId });
    });

    // GET USER'S OWN LISTINGS (PROTECTED)
    app.get("/myListings/:email", verifyToken, async (req, res) => {
      if (req.decoded.email !== req.params.email) {
        return res.status(403).send({ message: "Forbidden" });
      }

      const listings = await listingCollection
        .find({ email: req.params.email })
        .sort({ created_at: -1 })
        .toArray();

      res.send(listings);
    });

    // UPDATE LISTING (PROTECTED)
    app.put("/listings/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const data = req.body;

      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          name: data.name,
          category: data.category,
          Price: data.Price,
          location: data.location,
          description: data.description,
          image: data.image,
          updated_at: new Date(),
        },
      };

      const result = await listingCollection.updateOne(filter, updateDoc);
      res.send({ success: true, result });
    });

    // DELETE LISTING (PROTECTED)
    app.delete("/listings/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const existing = await listingCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!existing) {
        return res.status(404).send({ message: "Not found" });
      }

      // Check owner
      if (existing.email !== req.decoded.email) {
        return res
          .status(403)
          .send({ message: "Forbidden - not your listing" });
      }

      const result = await listingCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send({ success: true, result });
    });

    // ========== USERS ==========

    // UPSERT USER
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const updateDoc = { $set: user };
      const options = { upsert: true };

      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send({ success: true, result });
    });

    // GENERATE JWT TOKEN
    app.post("/getToken", (req, res) => {
      const token = jwt.sign(req.body, jwtToken, { expiresIn: "1h" });
      res.send({ token });
    });

    console.log("All routes active!");
  } catch (error) {
    console.error("Error:", error);
  }
}

run();

// ROOT
app.get("/", (req, res) => {
  res.send("Server Running...");
});

// LISTEN
app.listen(port, () =>
  console.log(`🚀 Server running on http://localhost:${port}`)
);
