const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5003;

// middlewares
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      // "http://localhost:5174",
      // "https://b8a11-client-print-hub-finder.web.app/",
      // "https://b8a11-client-print-hub-finder.firebaseapp.com/",
      // "https://b8a11-client-print-hub-finder.web.app/",
      // "https://b8a11-client-print-hub-finder.firebaseapp.com/",
    ],
    credentials: true,
    // optionSuccessStatus: 200,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nmv0r0r.mongodb.net/?retryWrites=true&w=majority&appName=AtlasApp`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// custom middlewares
const logger = async (req, res, next) => {
  console.log("called", req.hostname, req.originalUrl);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log("Token in the verifyToken middleware", token);
  if (!token) {
    return res.status(401).send({ message: "unauthenticateddd" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // error
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "not authenticateddd" });
    }
    // if token is valid then it would be decoded
    console.log("value in the token", decoded);
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const serviceCollection = client
      .db("PrinterHubFinderDB")
      .collection("services");
    const bookingCollection = client
      .db("PrinterHubFinderDB")
      .collection("bookings");

    //auth related api
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post("/logout", logger, async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // services related apis
    app.get(
      "/services",
      logger,
      /* verifyToken, */ async (req, res) => {
        console.log("user in the valid token", req?.user);
        console.log("token fron browser cookie", req?.cookies?.token);
        // console.log("queryEmail", req.query.email);
        // console.log("reqEmail", req.user.email);
        // if (req.query?.email !== req.user.email) {
        //   return res.status(403).send({ message: "forbidden access" });
        // }
        const cursor = serviceCollection.find({});
        const services = await cursor.toArray();
        res.send(services);
      }
    );

    app.get("/services/:id", logger, async (req, res) => {
      const id = req.params.id;
      const service = await serviceCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(service);
    });

    app.post("/services", logger, async (req, res) => {
      const newService = req.body;
      console.log(newService);

      const result = await serviceCollection.insertOne(newService);
      console.log(
        `The service is added with the _id:${result.insertedId}`,
        result
      );
      res.send(result);
    });

    app.put("/services/:id", logger, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedServiceClient = req.body;
      const updatedService = {
        $set: {
          nameOfService: updatedServiceClient.name,
          nameOfServiceProvider: updatedServiceClient.provider,
          email: updatedServiceClient.email,
          price: updatedServiceClient.price,
          serviceArea: updatedServiceClient.serviceArea,
          description: updatedServiceClient.description,
          image: updatedServiceClient.image,
        },
      };

      //   todo: patch here

      // Update the first document that matches the filter
      const result = await serviceCollection.updateOne(
        filter,
        updatedService,
        options
      );

      res.send(result);
      // Print the number of matching and modified documents
      console.log(
        `${result.matchedCount} document(s) matched the filter, updated ${result.modifiedCount} document(s)`
      );
    });

    app.delete("/services/:id", logger, async (req, res) => {
      const id = req.params.id;
      const doc = {
        selectedId: id,
      };
      const deleteResult = await serviceCollection.deleteOne(doc);
      console.dir(deleteResult.deletedCount);
      res.send(deleteResult);
    });

    // bookings related apis
    app.get("/bookings", logger, verifyToken, async (req, res) => {
      console.log("user in the valid token", req.user);
      if (req.query?.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const cursor = bookingCollection.find({
        emailOfServiceReceiver: req.query?.email,
      });
      const bookings = await cursor.toArray();
      res.status(200).send(bookings);
    });

    app.get("/my-schedules/bookings", logger, verifyToken, async (req, res) => {
      console.log("user in the valid token", req.user);
      console.log("user in the query params", req.query);
      if (req.query?.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const cursor = bookingCollection.find({
        emailOfServiceReceiver: req.query?.email,
      });
      const bookings = await cursor.toArray();
      res.status(200).send(bookings);
    });

    app.get(
      "/my-schedules/pending-works",
      logger,
      verifyToken,
      async (req, res) => {
        console.log("user in the valid token", req.user);
        if (req.query?.email !== req.user.email) {
          return res.status(403).send({ message: "forbidden access" });
        }
        const cursor = bookingCollection.find({
          emailOfServiceProvider: req.query?.email,
        });
        const bookings = await cursor.toArray();
        res.status(200).send(bookings);
      }
    );

    app.post("/bookings", logger, async (req, res) => {
      const newBookingId = req.body;
      console.log(newBookingId);

      const result = await bookingCollection.insertOne(newBookingId);
      console.log(
        `The booking is added in the bookingCollection with the _id:${result.insertedId}`,
        result
      );
      res.send(result);
    });

    app.patch("/bookings/:id", logger, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      // const options = { upsert: true };
      const updatedBookingClient = req.body;
      const updatedBooking = {
        $set: {
          status: updatedBookingClient.status,
        },
      };

      //   todo: patch here

      // Update the first document that matches the filter
      const result = await bookingCollection.updateOne(
        filter,
        updatedBooking
        // options
      );

      res.send(result);
      // Print the number of matching and modified documents
      console.log(
        `${result.matchedCount} document(s) matched the filter, updated ${result.modifiedCount} document(s)`
      );
    });

    // My Survices API
    app.get("/my-services", logger, verifyToken, async (req, res) => {
      console.log("user in the valid token from my-services api", req.user);
      console.log(req.query);
      console.log("queryEmail", req.query.email);
      console.log("reqEmail", req.user.email);
      if (req.query?.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const cursor = serviceCollection.find({ email: req.query?.email });
      const services = await cursor.toArray();
      res.status(200).send(services);
    });

    app.get("/my-services/update/:id", logger, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const service = await serviceCollection.findOne({
        _id: new ObjectId(id),
      });
      console.log(service);
      res.send(service);
    });

    app.put(
      "/my-services/update/:id",
      logger,
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updatedServiceClient = req.body;
        const updatedService = {
          $set: {
            nameOfService: updatedServiceClient.name,
            nameOfServiceProvider: updatedServiceClient.provider,
            email: updatedServiceClient.email,
            price: updatedServiceClient.price,
            serviceArea: updatedServiceClient.serviceArea,
            description: updatedServiceClient.description,
            image: updatedServiceClient.image,
          },
        };

        //   todo: patch here

        // Update the first document that matches the filter
        const result = await serviceCollection.updateOne(
          filter,
          updatedService,
          options
        );

        res.send(result);
        // Print the number of matching and modified documents
        console.log(
          `${result.matchedCount} document(s) matched the filter, updated ${result.modifiedCount} document(s)`
        );
      }
    );

    app.delete("/services/:id", logger, async (req, res) => {
      const id = req.params.id;
      const doc = {
        selectedId: id,
      };
      const deleteResult = await serviceCollection.deleteOne(doc);
      console.dir(deleteResult.deletedCount);
      res.send(deleteResult);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", logger, (req, res) => {
  res.send("PrinterHubFinder server is running");
});

app.listen(port, () => {
  console.log(`PrinterHubFinder server listening on ${port}`);
});
