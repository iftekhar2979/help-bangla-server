const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
var ObjectId = require('mongodb').ObjectID;
const app = express();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 8000;
const multer = require('multer');
const path = require('path');
const { decode } = require('punycode');
const session = require('express-session');
const { log } = require('console');



// const { log } = require('console');
const Upload_Folder = './Upload/';

app.use(session({
  secret: 'secret key',
  resave: false,
  saveUninitialized: false
}));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, Upload_Folder);
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + '.jpg');
  },
});
const upload = multer({ storage: storage });

// verification jwt middleWare
function varifyJwt(req, res, next) {
  const authHeaders=req.headers.authorization
  if (!authHeaders) {
    return res.status(401).send({ error: 'your are not Authorized' });
  }
  const token = authHeaders.split(' ')[1];
//   console.log(token);
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      res.status(403).send({ msg: 'unauthorized public access' });
    }
    req.decoded = decoded;
    next();
  });
}

//session integration
app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true
}));


const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.v1hhiem.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
async function run() {
  try {
    const eventCollection = client.db('voleentiar-events').collection('events');
    const userCollection = client.db('voleentiar-events').collection('users');
    const registeredCollection = client.db('voleentiar-events').collection('registeredUser');
    const imgCollection = client.db('test').collection('images');
    app.post('/addEvents', varifyJwt, async (req, res) => {
    
      const events = req.body;
      const postEvent = await eventCollection.insertOne(events);
      events.id = postEvent.insertedId;
      res.send(events);
    });
    app.get('/totalEvents', async (req, res) => {
      const query = {};
      const cursor = eventCollection.find(query);
      const count=await eventCollection.estimatedDocumentCount()
      const totalEvents = await cursor.toArray();
      res.send(totalEvents);
    });
    app.get('/findEvents/:id', async (req, res) => {
      const requestedId = req.params.id;
      const query = { _id: ObjectId(requestedId) };
      const result = await eventCollection.findOne(query);
      res.send(result);
    });
    app.delete('/deleteEvent/:id', async (req, res) => {
      const requestedId = req.params.id;
      const query = { _id: ObjectId(requestedId) };
      const deleteEvent = await eventCollection.deleteOne(query);
      res.send(deleteEvent);
    });
    app.get('/locationEvent', async (req, res) => {
      const Searchlocation = req.query.location
      let query = {};
      if (Searchlocation) {
        query = { location: Searchlocation };
        
      }
      console.log(query)
      const findingLocation = await eventCollection.findOne(query);
      // console.log(findingLocation)
      
      res.send(findingLocation);
    });
    app.post('/signup', (req, res) => {
        const user = req.body
        const {name,email,password}=user
        
        if (!name || !email || !password) {
          return res.status(400).send({ error: 'Missing required fields' });
        }

        bcrypt.hash(password, 10,async function(err, hash) {
          if (err) return res.status(500).send({ error: 'Error hashing password' });

          const user = { name, email, password: hash };
          const result=await registeredCollection.insertOne(user,function(err,result){
            if(err){
                return res.status(500).send({error:'Error insterting user info in Database'})
            }

          })
          res.send(result)

      });

    })
    app.post('/users',varifyJwt,async(req,res)=>{
      
      const filter={}
      const cursor= registeredCollection.find(filter)
      // console.log('cursors',cursor)
      const result=await cursor.toArray()
      // console.log(result)
      result.map(item=>delete item.password) 
      // console.log(mapped)
           res.send(result)

    })
    app.patch('/userUpdate',async(req,res)=>{
      const requestedId=req.body.id
      const status=req.body.status
      // console.log(status)
      const filter={_id:ObjectId(requestedId)}
      const findingObject=await registeredCollection.findOne(filter)
      const updatedDoc = {
        $set:{
            status: status
        }
    }
    const result = await  registeredCollection.updateOne(findingObject, updatedDoc);
    
      res.send(result)
     
      
    })

    app.post('/login',async (req, res) => {
      const body = req.body
      // console.log(req.headers)
      // const password = req.body.password;
    const {email,password,name}=body
    const filter={email:email}
    // console.log(filter);
  
    const findUser=await registeredCollection.findOne(filter,(err,user)=>{
      // console.log('i am user',user)
      if (err) {

        return res.status(500).send({err});
      }
      if (!user) {
        return res.send('User not found');
      }
      // console.log('password',password)
      // console.log('user password',user.password)
      bcrypt.compare(password,user.password,(err,result)=>{
       if(err){
        return res.status(500).send({err})
       }
       if(result){
       
    
       return res.status(200).send({message: 'Login successful',user:user.name,email:user.email});
       }else {
        return res.send('Wrong password');
      }
       
      })
    })

    });
    app.post('/Createprofile/:id', async (req, res) => {
      const profileEmail = req.params.id;
      let info = req.body;
      const { name, phone, address, photoUrl, studyInformation } = info;
      info = {
        email: profileEmail,
        name,
        phone,
        address,
        photoUrl,
        studyInformation,
      };
      const updateProfile = await userCollection.insertOne(info);
      res.send(updateProfile);
    });
    app.get('/profile', async (req, res) => {
      const profileName = req.query;
      const query = { email: profileName.email };
      // console.log(query);
      const findingQuery = await userCollection.findOne(query);
      res.send(findingQuery);
    });
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const {email,userName}=user
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '2h',
      });
      res.send({ token ,userName,email});
    });

    app.post('/upload', upload.single('image'), (req, res) => {
      // console.log(req.file);
      const file = new File({
        name: req.file.originalname,
        data: req.file.buffer,
      });
      file.save((error) => {
        if (error) {
          return res.status(201).send(error);
        }
      });
      res.send('File uploaded.');
    });
  } finally {
  }
}
run().catch((err) => console.log(err));
app.get('/', (req, res) => {
  res.send('hello this is me');
});
app.listen(port, () => {
  console.log(`Server is running on PORT: ${port}`);
});
