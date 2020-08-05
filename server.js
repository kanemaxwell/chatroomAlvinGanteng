if(process.env.NODE_ENV !== 'production'){
    require('dotenv').config()
}

const express = require('express')
const app = require('express')()
const http = require('http').createServer(app)
const io = require('socket.io')(http)
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const ObjectsToCsv = require('objects-to-csv')
const CSVToJSON = require("csvtojson")
const fs = require('fs')
const csvFilePath = "./logininformation.csv"
const csvFilePathRoom = "./room.csv"


const initializePassport = require('./passport-config')


//======================SOCKET==============================//
nicknames = {}
var clients = 0
typingUsers = []

const rooms = {}

//======================SOCKET==============================//

let users = []

CSVToJSON().fromFile(csvFilePath).then(rawUsers => {
    users = rawUsers

    initializePassport(
        passport, 
        email => users.find(user => user.email === email),
        id => users.find(user => user.id === id)
    )
})

// initializePassport(
//     passport, 
//     email => users.find(user => user.email === email),
//     id => users.find(user => user.id === id)
// )

app.set('view-engine', 'ejs')
app.use(express.urlencoded({ extended : true}))
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))


app.get('/profile', checkAuthenticated, (req, res) => {
    res.render('profile.ejs', {users: users})
})

app.get('/', checkAuthenticated, (req, res) => {  //ADD CHECKAUTHENTICATE LATER DONT FORGET
    res.render('index.ejs' , {rooms: rooms})
})

app.post('/room', async (req, res) => {
    // if(rooms[req.body.room] != null) {
    //     return res.redirect('/')
    // }
    rooms[req.body.room] = { users: {} }
    res.redirect(req.body.room)
    //SEND TO SOCKET

    io.emit('room-created', req.body.room)

})

app.get('/socket.js', (req,res) => {
    res.sendFile(__dirname + '/socket.js')
})

app.get('/login', checkNotAuthenticated,  (req,res) => {
    res.render('login.ejs')
})

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}))

app.get('/register',checkNotAuthenticated, (req,res) => {
    res.render('register.ejs')
})

app.post('/register',checkNotAuthenticated, async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)
        const csv = new ObjectsToCsv([{
            id: Date.now().toString(),
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword
        }])

        await csv.toDisk('./logininformation.csv', { append: true })

        CSVToJSON().fromFile(csvFilePath).then(rawUsers => {
            users = rawUsers
        })

        res.redirect('/login')
    }catch {
        res.redirect('/register')
    }
})

app.delete('/logout', (req,res) => {
    req.logOut()
    res.redirect('/login')
})

function checkAuthenticated(req, res, next){
    if(req.isAuthenticated()){
        return next()
    }
    res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
    if(req.isAuthenticated()){
        return res.redirect('/')
    }
    next()
}


app.get('/:room', (req, res) => {
    if(rooms[req.params.room] == null) {
        return res.redirect('/')
    }
    res.render('room.ejs', {roomName: req.params.room})
})

//======================SOCKET==============================//

io.on('connection' , (socket) => {
    clients++
    io.sockets.emit('broadcast', 'User has just connected. ' + clients + ' user(s) currently online')
    socket.emit('broadcast', 'to Whisper to another user type /w *username* *messages* without *')
    socket.emit('broadcast', '他ユーザにプライベートメッセージを送りたい場合、アスタリスク(*)なしでタイプしてください /w *ユーザ名* *メッセージ*')


    socket.on('setNickname', function(data){
        if(nicknames[socket.id] == null){
            nicknames[socket.id] = data
            socket.emit('userSet', {nickname: data})
        }else{
            socket.emit('userExists', data + ' nickname is taken! Try some other nickname')
        }
            io.sockets.emit('user list', nicknames)

    })

    socket.on('setYesTyping', function(data){
        typingUsers.push(data)
        io.sockets.emit('user typing', typingUsers)
    })

    socket.on('setNotTyping', function(data){
        const index = typingUsers.indexOf(data)
        if(index > -1) {
            typingUsers.splice(index, 1)
        }
        console.log(typingUsers)
        io.sockets.emit('user not typing', typingUsers)
    })

    socket.on('chat message', (data, callback) => {
        var msg = data.trim()
        if(msg.substr(0,3) === '/w '){
            msg = msg.substr(3)
            var index = msg.indexOf(' ')
            if(index !== -1){
                var nickname = msg.substring(0, index)
                var msg = msg.substring(index + 1)
                const socketId = Object.keys(nicknames).find(key => nicknames[key] === nickname)            
                if(socketId in nicknames){
                    socket.to(socketId).emit('whisper', {'nickname': nicknames[socket.id], 'body': msg})
                }else {
                    callback('Error, enter a valid nickname')
                }
            }else{
                callback('Error, enter a message for your whisper')
            }
        }else{
            socket.broadcast.emit('normal message', {'nickname': nicknames[socket.id], 'body': msg})
        }
        console.log('message: ' , {'nickname': nicknames, 'body': data})
    })

    socket.on('disconnect', () => {
        clients--
        io.sockets.emit('broadcast', nicknames[socket.id] + ' has just disconnected. ' + clients + ' user(s) currently online')
        delete nicknames[socket.id]
        io.sockets.emit('user list', nicknames)
    })

    
})

//======================SOCKET==============================//

http.listen(3000, () => {
    console.log('listening on *:3000');
  });