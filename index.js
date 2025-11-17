const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

const uri =
  "mongodb+srv://paw-mart-db:12DHHORdtnQZrBIG@firstmongdbproject.yank7ts.mongodb.net/?appName=FirstMongDBProject";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("pet-mart-db");
    const listingCollection = db.collection("listings");

    app.get("/listing", async (req, res) => {
      const result = await listingCollection.find().toArray();
      res.send(result);
    });

    app.post("/listing", async (req, res) => {
      const data = req.body;
      console.log(data);
      const result = listingCollection.insertOne(data);
      res.send({
        success: true,
        result,
      });
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is Running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
