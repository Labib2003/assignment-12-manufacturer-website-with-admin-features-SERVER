const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

// jwt function
function verifyJWT(req, res, next) {
    // bearer... token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Forbidden Access. No authorization header found.' });
    };
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Session expired, no JWT found. Please re-login.' });
        }
        req.decoded = decoded;
        next();
    });
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.436gp.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db('tools-manufacturer').collection('tools');
        const reviewsCollection = client.db('tools-manufacturer').collection('reviews');
        const userCollection = client.db('tools-manufacturer').collection('users');
        const orderCollection = client.db('tools-manufacturer').collection('orders');

        async function verifyAdmin(req, res, next) {
            const requester = req.decoded.email;
            // checking if the requester is an admin or not
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount?.admin) {
                next();
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        }

        /* ---------- TOOLS RELATED APIs START ---------- */

        // get all tools
        app.get('/tools', async (req, res) => {
            const result = await toolsCollection.find({}).toArray();
            res.send(result);
        });

        // get a specific tool by id
        app.get('/tool/:id', async (req, res) => {
            const id = req.params.id;
            const result = await toolsCollection.findOne({ _id: ObjectId(id) });
            res.send(result);
        });

        // decrease quantity when ordered
        app.put('/tool/:id', verifyJWT, async (req, res) => {
            const requesterEmail = req.headers.from;
            const decodedEmail = req.decoded.email;
            if (decodedEmail === requesterEmail) {
                const id = req.params.id;
                const body = req.body;
                const filter = { _id: ObjectId(id) };
                const options = { upsert: true };
                const updatedQuantity = {
                    $set: {
                        available_quantity: body.available_quantity
                    },
                };
                const result = await toolsCollection.updateOne(filter, updatedQuantity, options);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        });

        // add new tool
        app.post('/tools', verifyJWT, verifyAdmin, async (req, res) => {
            const requesterEmail = req.headers.from;
            const decodedEmail = req.decoded.email;
            if (decodedEmail === requesterEmail) {
                const newTool = req.body;
                const result = await toolsCollection.insertOne(newTool);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        });

        // delete tool api
        app.delete('/tool/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const requesterEmail = req.headers.from;
            const decodedEmail = req.decoded.email;
            if (decodedEmail === requesterEmail) {
                const id = req.params.id;
                const result = await toolsCollection.deleteOne({ _id: ObjectId(id) });
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        })

        /* ---------- TOOLS RELATED APIs END ---------- */

        /* ---------- REVIEWS RELATED APIs START ---------- */

        // get all reviews
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find({}).toArray();
            res.send(result);
        });

        // post review
        app.post('/reviews', verifyJWT, async (req, res) => {
            const requesterEmail = req.headers.from;
            const decodedEmail = req.decoded.email;
            if (decodedEmail === requesterEmail) {
                const review = req.body;
                const result = await reviewsCollection.insertOne(review);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        });

        /* ---------- REVIEWS RELATED APIs END ---------- */

        /* ---------- ORDERS RELATED APIs START ---------- */

        // post order
        app.post('/order', verifyJWT, async (req, res) => {
            const requesterEmail = req.headers.from;
            const decodedEmail = req.decoded.email;
            if (requesterEmail === decodedEmail) {
                const order = req.body;
                const result = await orderCollection.insertOne(order);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        });

        // get order by email
        app.get('/orders/:email', verifyJWT, async (req, res) => {
            const requesterEmail = req.headers.from;
            const decodedEmail = req.decoded.email;
            if (requesterEmail === decodedEmail) {
                const email = req.params.email;
                const result = await orderCollection.find({ email: email }).toArray();
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        });

        // get order by id
        app.get('/order/:id', verifyJWT, async (req, res) => {
            const requesterEmail = req.headers.from;
            const decodedEmail = req.decoded.email;
            if (requesterEmail === decodedEmail) {
                const id = req.params.id;
                const result = await orderCollection.findOne({ _id: ObjectId(id) });
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        });

        // update payment status
        app.put('/order/:id', verifyJWT, async (req, res) => {
            const requesterEmail = req.headers.from;
            const decodedEmail = req.decoded.email;
            if (requesterEmail === decodedEmail) {
                const id = req.params.id;
                const payment = req.body;
                const filter = { _id: ObjectId(id) };
                const updatedDoc = {
                    $set: {
                        paid: true,
                        transactionId: payment.transactionId
                    }
                }
                const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
                res.send(updatedOrder);
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        });

        // delete order
        app.delete('/order/:id', verifyJWT, async (req, res) => {
            const requesterEmail = req.headers.from;
            const decodedEmail = req.decoded.email;
            if (requesterEmail === decodedEmail) {
                const id = req.params.id;
                const result = await orderCollection.deleteOne({ _id: ObjectId(id) });
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        });

        // get all orders
        app.get('/orders', verifyJWT, verifyAdmin, async (req, res) => {
            const requesterEmail = req.headers.from;
            const decodedEmail = req.decoded.email;
            if (requesterEmail === decodedEmail) {
                const result = await orderCollection.find({}).toArray();
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        });

        // update shipment status
        app.put('/order/ship/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const requesterEmail = req.headers.from;
            const decodedEmail = req.decoded.email;
            if (requesterEmail === decodedEmail) {
                const id = req.params.id;
                const filter = { _id: ObjectId(id) };
                const updatedDoc = {
                    $set: {
                        shipped: true
                    }
                }
                const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
                res.send(updatedOrder);
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        })

        /* ---------- ORDERS RELATED APIs END ---------- */

        /* ---------- USER RELATED APIs START ---------- */

        // upsert user
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET);
            res.send({ result, token });
        });

        // get user by email
        app.get('/user/:email', verifyJWT, async (req, res) => {
            const requesterEmail = req.headers.from;
            const decodedEmail = req.decoded.email;
            if (requesterEmail === decodedEmail) {
                const email = req.params.email;
                const result = await userCollection.findOne({ email: email });
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        });

        // get all users
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const requesterEmail = req.headers.from;
            const decodedEmail = req.decoded.email;
            if (requesterEmail === decodedEmail) {
                const result = await userCollection.find({}).toArray();
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        });

        // make admin
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const requesterEmail = req.headers.from;
            const decodedEmail = req.decoded.email;
            if (requesterEmail === decodedEmail) {
                const user = req.body.user;
                const filter = { email: user };
                const updateDoc = {
                    $set: {
                        admin: true
                    },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        });

        /* ---------- USER RELATED APIs END ---------- */

        /* ---------- STRIPE RELATED APIs START ---------- */

        // stripe payment intent
        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card'],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        /* ---------- STRIPE RELATED APIs END ---------- */
    }
    finally { }
};

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

// https://tools-manufacturer.herokuapp.com