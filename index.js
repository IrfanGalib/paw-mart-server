require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

// Middleware Setup
app.use(cors());
app.use(express.json());

// JWT Secret
const jwtToken = process.env.JWT_SECRET;

// MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@firstmongdbproject.yank7ts.mongodb.net/?retryWrites=true&w=majority&appName=FirstMongDBProject`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let listingCollection;

const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized access: No token provided" });
  }

  const token = authorization.split(" ")[1];

  jwt.verify(token, jwtToken, (err, decoded) => {
    if (err) {
      return res
        .status(403)
        .send({ error: true, message: "Forbidden access: Token is invalid" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect();

    const db = client.db("paw-mart-db");
    listingCollection = db.collection("listings");

    app.get("/listing", async (req, res) => {
      const result = await listingCollection.find().toArray();
      res.send(result);
    });

    app.post("/getToken", (req, res) => {
      const loggedUser = req.body;
      const token = jwt.sign(loggedUser, jwtToken, { expiresIn: "1h" });

      res.send({ token });
    });

    app.post("/listing", verifyToken, async (req, res) => {
      const data = req.body;

      if (req.decoded.email !== data.email) {
        return res.status(403).send({
          success: false,
          message: "Forbidden: Listing email does not match user token.",
        });
      }

      console.log("Received data from verified user:", data);
      const result = await listingCollection.insertOne(data);
      res.send({
        success: true,
        listingId: result.insertedId,
        message: "Listing created successfully.",
      });
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB connection or server setup failed:", error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is Running");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
