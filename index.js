const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config();
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors())
app.use(express.json())


// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gvtian5.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// token function
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}


async function run() {
    try {
        const usersCollection = client.db('HeroRidres').collection('users');

        // verify user by email
        app.post('/api/user', verifyJWT, async (req, res) => {
            const email = req.body.email
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            if (user?.email) {
                return res.send({ verify: true, user: user })
            }
            res.send({ verify: false })
        })

        //sign up
        app.post('/api/signup', async (req, res) => {
            const user = req.body;
            console.log(user);
            const email = req.body.email
            const query = { email: email }
            const findUser = await usersCollection.findOne(query)
            if (findUser) {
                return res.send({ status: false, message: 'Email already used' });
            }
            const result = await usersCollection.insertOne(user);
            const data = await usersCollection.findOne(query);

            const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
            return res.send({ status: true, message: 'Logged in Successfully', data: data, accessToken: token });
        })


        // login 
        app.post('/api/login', async (req, res) => {
            const email = req.body.email;
            const password = req.body.password;
            const query = { email: email };
            const user = await usersCollection.findOne(query);

            if (user?.password === password) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
                return res.send({ status: true, message: 'Logged in Successfully', data: user, accessToken: token });
            }
            else if (user?.email && user?.password !== password) {
                return res.send({ message: 'wrong password', status: false })
            }
            res.send({ message: 'user not found', status: false })
        });

        // get user data
        app.get('/api/user-list', verifyJWT, async (req, res) => {
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);
            const query={};
            const users=await usersCollection.find(query).sort({ _id: -1 }).skip(page*size).limit(size).toArray();
            const count = await usersCollection.estimatedDocumentCount();
            res.send({count,users});
        })


        app.post('/api/update-user', async(req, res)=>{
            const idArray = req.body;        
            const bulkOps = idArray.map(id => {
                return {
                  updateOne: {
                    filter: { _id: ObjectId(id )},
                    update: { $set: { block:true } }
                  }
                };
              });
              const result=await usersCollection.bulkWrite(bulkOps, function(err, result) {
                console.log(result);
                client.close();
              });
            res.send(result);
           
        });

        // //create payment 
        // app.post('/create-payment-intent', async (req, res) => {
        //     const price = req.body.price;
        //     const amount = price * 100;
        //     const paymentIntent = await stripe.paymentIntents.create({
        //         amount: amount,
        //         currency: 'usd',
        //         payment_method_types: ['card']
        //     });
        //     res.send({ clientSecret: paymentIntent.client_secret })
        // });


    }
    finally {

    }
}

run().catch(console.log);


app.get('/', async (req, res) => {
    res.send('Run port');
})

app.listen(port, () => console.log(port))