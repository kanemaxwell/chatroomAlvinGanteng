const roomContainer = document.getElementById('room-container')
var socket = io()
var nickname;

function setNickname(){
    $('#YES').hide()
    socket.emit('setNickname', $("#nickname").val())
    }
    

let isTyping = false

function userType(){  
    const inputValue = $('#m').val()
    if(!inputValue.length || inputValue === ''){
        if(isTyping){
            isTyping = false
            socket.emit('setNotTyping', nickname)
        }
    }
    
    if(inputValue.length){
        if(!isTyping){
            isTyping = true
            socket.emit('setYesTyping', nickname)
        }
    }
}

function reset(){
    isTyping = false
    socket.emit('setNotTyping', nickname)
}



$(function (){
    socket.on('room-created', room => {
        const roomElement = document.createElement('div')
        roomElement.innerText = room
        const roomLink = document.createElement('a')
        roomLink.href = `/${room}`
        roomLink.innerText = 'Join'
        roomContainer.append(roomElement)
        roomContainer.append(roomLink)
    })

    socket.on('userExists', function(data){
        $('#messages').append($('<li>').text(data))
    })
    
    socket.on('userSet', function(data){
        nickname = data.nickname;
        $('#userName').html('now typing as @' + nickname)
    })
    
    $('#formMessage').submit(function(e) {
        e.preventDefault()
        socket.emit('chat message', $('#m').val(), function(data){
            $('#messages').append($('<li class="error">').text(data))
        })
        $('#messages').append($('<li>').text(nickname + ' : ' + $('#m').val()))
        $('#m').val('')
        reset()
        return false
    })

    socket.on('normal message', function(msg){
        $('#messages').append($('<li class="server">').text(msg.nickname + ' : ' + msg.body))
    })

    socket.on('whisper', function(msg){
        $('#messages').append($('<li class="whisper">').text(msg.nickname + ' : ' + msg.body))
    })

    socket.on('broadcast', function(msg) {
        $('#messages').append($('<li>').text(msg))
    })

    socket.on('user typing', function(array) {
        var index = array.indexOf(nickname)
        if(index > -1){
            array.splice(index, 1)
        }

        if(!array.length){
            $('#ahyes').html('')
        }else {
            var joined = array.join()
            $('#ahyes').html(joined + ' is typing')
        }
    })

    socket.on('user not typing', function(array) {
        if(!array.length){
            $('#ahyes').html('')
        }else {
            var joined = array.join()
            $('#ahyes').html(joined + ' is typing...')
        }
    })

    socket.on('user list', function(nameList) {
        var nameList = Object.values(nameList)
        nameList = nameList.join()
        $('#userList').html('User who is now online : '+nameList)
    })
})