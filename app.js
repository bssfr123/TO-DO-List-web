const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const app = express();

mongoose.connect('mongodb://127.0.0.1:27017/todolist', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// 사용자 모델 정의
const User = mongoose.model('User', {
  username: String,
  password: String,
  isAdmin: { type: Boolean, default: false } // isAdmin 필드 추가
});

// Todo 모델 정의
const Todo = mongoose.model('Todo', {
  userId: mongoose.Schema.Types.ObjectId,
  text: String,
  date: String,
  completed: Boolean,
  details: String,
  category: String
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } 
}));

// 정적 파일 서빙
app.use(express.static('views'));

// index.html 서빙
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// 회원가입 페이지 서빙
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'signup.html'));
});

// 로그인 페이지 서빙
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Todo 리스트 페이지 서빙
app.get('/todos', (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('로그인 필요');
  }

  if (req.session.user.isAdmin) {
    res.sendFile(path.join(__dirname, 'views', 'adminTodo.html'));
  } else {
    res.sendFile(path.join(__dirname, 'views', 'todo.html'));
  }
});


// 회원가입 엔드포인트
app.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).send('유효하지 않은 요청: 사용자 이름과 비밀번호가 필요합니다.');
    }
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).send('이미 존재하는 사용자 이름입니다.');
    }
    const user = new User({ username, password });
    await user.save();
    res.send(`
      <script>
        alert('회원가입 성공!');
        window.location.href = '/login';
      </script>
    `);
  } catch (err) {
    console.log(err);
    res.status(500).send('서버 에러');
  }
});

// 로그인 엔드포인트
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).send('유효하지 않은 요청: 사용자 이름과 비밀번호가 필요합니다.');
    }
    const user = await User.findOne({ username, password });
    if (user) {
      req.session.user = user; // 세션에 유저 정보를 저장
      res.redirect('/todos');
    } else {
      res.status(401).send('로그인 실패: 유저 정보가 일치하지 않습니다.');
    }
  } catch (err) {
    console.log(err);
    res.status(500).send('서버 에러');
  }
});

// Todo CRUD 엔드포인트
app.get('/todos', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).send('로그인 필요');
    }

    const userId = req.session.user._id;
    const isAdmin = req.session.user.isAdmin;
    
    let todos;

    if (isAdmin) {
      todos = await Todo.find({});
    } else {
      todos = await Todo.find({ userId });
    }

    res.json(todos);
  } catch (err) {
    console.log(err);
    res.status(500).send('서버 에러');
  }
});

app.post('/todos', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).send('로그인 필요');
    }

    const { text, date, details, category } = req.body;
    const userId = req.session.user._id;

    if (!text || !date) {
      return res.status(400).send('유효하지 않은 요청: 할 일 내용과 날짜를 입력하세요.');
    }

    const todo = new Todo({
      userId,
      text,
      date,
      completed: false,
      details,
      category
    });

    await todo.save();
    res.json(todo);
  } catch (err) {
    console.log(err);
    res.status(500).send('서버 에러');
  }
});

app.put('/todos/update/:id', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).send('로그인 필요');
    }

    const { id } = req.params;
    const { text, date, details, category } = req.body;

    if (!text || !date) {
      return res.status(400).send('유효하지 않은 요청: 할 일 내용과 날짜를 입력하세요.');
    }

    await Todo.findByIdAndUpdate(id, { text, date, details, category });
    res.send('업데이트 성공');
  } catch (err) {
    console.log(err);
    res.status(500).send('서버 에러');
  }
});

app.delete('/todos/:id', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).send('로그인 필요');
    }

    const { id } = req.params;
    await Todo.findByIdAndDelete(id);
    res.send('삭제 성공');
  } catch (err) {
    console.log(err);
    res.status(500).send('서버 에러');
  }
});

app.get('/admin/todos', async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.isAdmin) {
      return res.status(403).send('접근 권한이 없습니다.');
    }

    const todos = await Todo.find({});
    res.json(todos);
  } catch (err) {
    console.log(err);
    res.status(500).send('서버 에러');
  }
});

const PORT = process.env.PORT || 3000;

const startServer = (port) => {
  app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`포트 ${port} 가 사용 중입니다. 다른 포트를 시도합니다...`);
      startServer(port + 1);
    } else {
      throw err;
    }
  });
};

startServer(PORT);
