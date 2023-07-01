import React, { useState } from 'react';

import io from 'socket.io-client';
import './chat-area.css';
import LoginForm from './components/Login';
import UpdateMsgStatus from './utils/update-msg-status';
import { TMessagesWithStates } from './utils/types-definitions';
const BACKEND_URL = 'http://localhost:3000';
const socket = io(BACKEND_URL, {transports: ['websocket'] })





function App() {
  const [totalMsgCount, setTotalMsgCount] = useState<number>(0)
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting..')
  const [msgCount, setMsgCount] = useState<number>(0)
  const [auth, setAuth] = useState<string | null>(null)
  const [messages, setMessages] = useState<Map<string, TMessagesWithStates>>(new Map())
  const [incomingMessages, setIncomingMessages] = useState<Map<string, any>>(new Map())

  socket.on('connect', () => {
    setConnectionStatus('Connected')
  })
  socket.on('disconnect', () => {
    setConnectionStatus('Disconnected')
    setAuth(null)
  })
  socket.on('connect_error',()=>{
    console.log('connect_error')
    setConnectionStatus('Connection error')
    setAuth(null)
  })

  const handleOfflineRecipient = function (data: {msg_hash: string}, ack: any){
    setTotalMsgCount(prev=>prev+1)
    if(typeof ack == 'function') {
      ack('ack')
    }
    console.log('offline_recipient: ', JSON.stringify(data))
    if(!data || !data.msg_hash) {
      console.log('invalid offline_recipient data: ', JSON.stringify(data))
      return;
    }
    setMessages(prev=>UpdateMsgStatus(data.msg_hash, 'recipient is offline', prev))
  }

  socket.on('offline_recipient', (data: {msg_hash: string}, ack) => handleOfflineRecipient(data, ack))

  const handleFileUploadError = function(data: {msg_hash: string}, ack: any) {
    setTotalMsgCount(prev=>prev+1)
    if(typeof ack == 'function') {
      ack('ack')
    }
    if(!data || !data.msg_hash) {
      console.log('invalid file_upload data: ', data)
      return;
    }
    setMessages(prev=>UpdateMsgStatus(data.msg_hash, 'failed to send to server', prev))
  }
  socket.on('file_upload_fail', (data: {msg_hash: string} , ack) => handleFileUploadError(data, ack))

  const handleMsgSent = function(data: {msg_hash: string}, ack: any) {
    setTotalMsgCount(prev=>prev+1)
    if(typeof ack == 'function') {
      ack('ack')
    }
    if(!data || !data.msg_hash) {
      console.log('invalid msg_sent data: ', data)
      return;
    }
    setMessages(prev=>UpdateMsgStatus(data.msg_hash, 'delivered', prev))
  }
  // const onOfflineRec = function(data: {msg_hash: string})
  socket.on('msg_sent', (data: {msg_hash: string}, ack) => handleMsgSent(data, ack))

  type incomingMessageType = {
    content: string,
    type: 'msg' | 'file',
    from_username: string,
    msg_hash: string
  }
  const handleIncomingMsg = function(data: incomingMessageType, ack: any) {
    setTotalMsgCount(prev=>prev+1)
    ack('ack');
    const{ content, type, from_username} = data;
    console.log('msg: ', JSON.stringify(data))
    if( !content || !type || !from_username) {
      console.log('invalid msg data: ', data)
      return;
    }
    if(type === 'msg') {
      setIncomingMessages(prev=>{
        prev.set(`${from_username}${data.msg_hash}`, `[${from_username}]: ${content}`)
        return prev
      })
    }
    else if(type === 'file') {
      const hrefValue = `${BACKEND_URL}${content}`
      setIncomingMessages(prev=>{
        prev.set(`${from_username}${data.msg_hash}`, (<a href={hrefValue}>[${from_username}]: file</a>))
        return prev
      })
    }
  }
  socket.on('msg', (data, ack) => handleIncomingMsg(data, ack))

  const handleSendMsg = async function (e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(auth === null) {
      e.preventDefault();
      console.log('please login first');
      return;
    }
    setMsgCount(msgCount + 1)
    const msg = (document.getElementById('msg') as HTMLInputElement).value;
    const msgHash = `${msgCount}`;
    const recipientName = (document.getElementById('to') as HTMLInputElement).value;
    setMessages(prev=>{
      prev.set(msgHash, {
        msg: `msg to ${recipientName}: ${msg}`,
        status: 'sending to server',
        msgHash: msgHash
      })
      return prev;
    })
    if(!socket.connected) {
      setMessages(prev=>UpdateMsgStatus(`${msgCount}`, 'failed to send to server', prev))
      return;
    }

    const result = await socket.emitWithAck('msg', {
      to_username: recipientName,
      content: (document.getElementById('msg') as HTMLInputElement).value,
      type: 'msg',
      msg_hash: msgHash
    }).catch((e)=>{
      console.log('emitWithAck error: ')
      console.log(e)
      return 'fail'
    }).then(()=>{
      return 'success'
    })

    if(result === 'fail') {
      setMessages(prev=>UpdateMsgStatus(`${msgCount}`, 'server did not receive the message', prev))
    } else if(result === 'success') {
      setMessages(prev=>{
        const msg = prev.get(`${msgCount}`);
        if(!msg) {
          console.log('invalid msg hash: ', msgHash, 'msg: ', msg)
          return prev;
        }
        if(msg.status !== 'sending to server')
          return prev;
        msg.status = 'sent to server';
        prev.set(`${msgCount}`, msg)
        return prev
      })
    }
  }

  const handleSendFile = async function (e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(auth === null) {
      e.preventDefault();
      console.log('please login first');
      return;
    }
    setMsgCount(msgCount + 1)
    const msgHash = `${msgCount}`;
    const recipientName = (document.getElementById('file_to') as HTMLInputElement).value;
    const file = (document.getElementById('file') as HTMLInputElement).files?.[0];
    if(!file) {
      console.log('no file selected');
      return;
    }

    const fileContent = await file
      .text()
      .then(res=>res)
      .catch(()=>'fail')
      //ar trebui returnat un obiect aici in cazul in care textul din fisier === fail
    if(fileContent === 'fail') {
      setMessages(prev=>UpdateMsgStatus(`${msgCount}`, 'failed to open file', prev))
      return;
    }
    if(!socket.connected) {
      setMessages(prev=>UpdateMsgStatus(`${msgCount}`, 'failed to send to server', prev))
      return;
    }
    setMessages(prev=>{
      prev.set(msgHash, {
        msg: `file to ${recipientName} - ${file.name}`,
        status: 'sending to server',
        msgHash: msgHash
      })
      return prev;
    })

    const result = await socket.emitWithAck('msg', {
      to_username: recipientName,
      content: fileContent,
      file_name: file.name,
      type: 'file',
      msg_hash: `${msgCount}`
    }).catch((e)=>{
      console.log('emitWithAck error: ')
      console.log(e)
      return 'fail'
    }).then(()=>{
      return 'success'
    })

    if(result === 'fail') {
      setMessages(prev=>UpdateMsgStatus(`${msgCount}`, 'server did not receive the message', prev))
    } else if(result === 'success') {
      setMessages(prev=>{
        const msg = prev.get(`${msgCount}`);
        if(!msg) {
          console.log('invalid msg hash: ', msgHash, 'msg: ', msg)
          return prev;
        }
        if(msg.status !== 'sending to server')
          return prev;
        msg.status = 'sent to server';
        prev.set(`${msgCount}`, msg)
        return prev
      })
    }
  }



  return (
    <div className="App">
      <header>
        <p>Connection status: {connectionStatus}</p>
        <p>Login user: {auth || "please log in"}</p>
        <p>[debug] Total msg count: {totalMsgCount}</p>
      </header>

      <LoginForm setAuth={setAuth} connStatus={connectionStatus} socket={socket}/>
      <div id="forms-comm-area">
        <form onSubmit={handleSendMsg}>
          <p>Msg To</p>
          <input type="text"  id="to"/>
          <p>Msg Text</p>
          <input type="text" id="msg" />
          <button type="submit">Send</button>
        </form>
        <form onSubmit={handleSendFile}>
          <p>File To</p>
          <input type="text" id="file_to"/>
          <p>File</p>
          <input type="file" id="file" />
          <button type="submit">Send</button>
        </form>
      </div>
      <div id="chat-area">
        <div>
          <p>Sent messages</p>
          <ul>
            {
              Object.keys(Object.fromEntries(messages)).map(function(key, index) {
                const msg = messages.get(key);
                if(!msg) {
                  return null;
                }
                return <li key={index}>{`[${key}] ${msg.msg}`}</li>
              })
            }
          </ul>
        </div>
        <div>
          <p>Message statuses</p>
          <ul>
            {
              Object.keys(Object.fromEntries(messages)).map(function(key, index) {
                const msg = messages.get(key);
                if(!msg) {
                  return null;
                }
                return <li key={index}>{`[${key}] ${msg.status}`}</li>
              })
            }
          </ul>
        </div>
        <div>
          <p>Incoming messages</p>
          <ul>
            {
              Object.keys(Object.fromEntries(incomingMessages)).map(function(key, index) {
                const msg = incomingMessages.get(key);
                if(!msg) {
                  return null;
                }

                return <li key={index}>{msg}</li>
              })
            }
          </ul>
        </div>
      </div>

    </div>
  );
}

export default App;
