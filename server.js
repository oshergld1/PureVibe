const express = require('express');
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// הגדרת תצוגה וסטטיים
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// URI למונגו
const uri = 'mongodb://localhost:27017/';
const mongoClient = new MongoClient(uri);
let db;

// התחברות למסד עבור Users (MongoClient)
async function connectDB() {
  try {
    await mongoClient.connect();
    db = mongoClient.db('PureVibe');
    console.log('✅ Connected to MongoDB via MongoClient');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }
}
connectDB();

// התחברות למסד עבור Posts (Mongoose)
mongoose.connect(uri + 'PureVibe', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ Mongoose connected to MongoDB'))
  .catch(err => console.error('❌ Mongoose connection error:', err));

// סכימה לפוסטים
const postSchema = new mongoose.Schema({
  image: Buffer,
  imageType: String,
  description: String,
  author: String,
  createdAt: { type: Date, default: Date.now },
  comments: [
  {
    content: String,
    commenter: String,
    createdAt: { type: Date, default: Date.now }
  }
]
});
const Post = mongoose.model('Post', postSchema, 'Posts');

// app.get('/homePage', async (req, res) => {
//   try {
//     const posts = await Post.find({}).sort({ createdAt: -1 });
//     const userName = req.query.name || 'Guest'; // מקבל את השם מה-URL
//     res.render('homePage', { posts: posts, name: userName });
//   } catch (err) {
//     console.error('❌ Error fetching posts:', err);
//     res.render('homePage', { posts: [], name: 'Guest' });
//   }
// });

app.post('/comment/:id', async (req, res) => {
  const postId = req.params.id;
  const { commenter, content } = req.body;

  try {
    await Post.findByIdAndUpdate(postId, {
      $push: {
        comments: {
          commenter,
          content,
          createdAt: new Date()
        }
      }
    });

    // שליפת כל הפוסטים מחדש ורנדר במקום רידיירקט
    const posts = await Post.find({}).sort({ createdAt: -1 });
    res.render('homePage', { posts: posts, name: commenter });

  } catch (err) {
    console.error('❌ Error saving comment:', err);
    res.status(500).send('שגיאה בשמירת תגובה');
  }
});


app.get('/image/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || !post.image) {
      return res.status(404).send('Image not found');
    }
    
    res.set('Content-Type', post.imageType);
    res.send(post.image);
  } catch (err) {
    console.error('❌ Error fetching image:', err);
    res.status(500).send('Error fetching image');
  }
});

// ---------- הרשמה ----------
app.get('/signup', (req, res) => {
  res.render('signup', { message: null });
});

app.post('/signup', async (req, res) => {
  const { name, last_name, username, email, password, phone } = req.body;

  try {
    const existing = await db.collection('Users').findOne({ email });

    if (existing) {
      res.render('signup', { message: 'The email already exist. Please log in.' });
    } else {
      await db.collection('Users').insertOne({ name, last_name, username, email, password, phone });
      res.send('You have successfully registered!');
    }
  } catch (err) {
    console.error('❌ Error in registration:', err);
    res.status(500).send('server error during registration');
  }
});

// ---------- התחברות ----------
app.get('/login', (req, res) => {
  res.render('login', { message: null });

});

app.post('/homePage', async (req, res) => {
  const { username, password } = req.body;


  try {
    const user = await db.collection('Users').findOne({ username, password });

    if (user) {
      let name = req.body.username;
      try {
        // שליפת כל הפוסטים ממסד הנתונים
        const posts = await Post.find({}).sort({ createdAt: -1 }); // ממוינים לפי תאריך יצירה
        res.render('homePage', { posts: posts, name});
      } catch (err) {
        console.error('❌ Error fetching posts:', err);
        res.render('homePage', { posts: [] }); // במקרה של שגיאה, נשלח מערך ריק
      }
    } else {
      res.render('login', { message: 'User not exist or wrong password.' });
    }
  } catch (err) {
    console.error('❌ Error in login:', err);
    res.status(500).send('server error during login');
  }
});

// ---------- העלאת פוסט ----------
app.get('/upload', (req, res) => {
  res.render('upload');
});

app.post('/posts', upload.single('image'), async (req, res) => {
  try {
    const newPost = new Post({
      image: req.file.buffer,
      imageType: req.file.mimetype,
      description: req.body.description,
      author: req.body.author
    });

    await newPost.save();

    // במקום redirect, רנדר ישירות את הדף עם הפוסטים
    const posts = await Post.find({}).sort({ createdAt: -1 });
    res.render('homePage', { posts: posts, name: req.body.author });

  } catch (err) {
    console.error('❌ Error saving post:', err);
    res.status(500).send('שגיאה בשמירת הפוסט');
  }
});

// ---------- הפעלת שרת ----------
app.listen(3000, () => {
  console.log('🚀 Server running at http://localhost:3000');
});