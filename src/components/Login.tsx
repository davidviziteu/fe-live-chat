import React from 'react';

export default function LoginForm(props: {setAuth: Function, connStatus: string, socket: any}) {
  const { setAuth, connStatus, socket } = props;

  const onLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if(connStatus !== 'Connected') {
      console.log('not connected to server');
      return;
    }
    const username = (document.getElementById('username') as HTMLInputElement).value;
    const loginRes = await socket.emitWithAck('login', {user_name: username}).then(()=>"success").catch((err: any)=>{
      console.log('login error: ', err);
      return 'fail';
    });
    if(loginRes === 'success') {
      console.log('login success: ', username)
      setAuth(username);
    }
  }

  return (
    <form onSubmit={onLogin}>
      <p>Login Username</p>
      <input type="text" id="username" />
      <button type="submit">Login</button>
    </form>
  )
}