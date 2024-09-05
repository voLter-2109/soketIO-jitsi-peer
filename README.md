# WebSocket_Socket.IO :sunglasses:

![gif-wow](https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeW5jeDYxc3ZzZmRtOHl1d2c5dmM0dmQxdmJpYXNyeXF5cTh6emsxaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/oYtVHSxngR3lC/giphy.gif)


<h2>Server</h2>
<ul>
<li>express</li>
<li>socket.io</li>
</ul>
в консоле в vsCod будут видны поступающие данныe <br>
любые изменения будут перезагружать сервер и приведут к поетере данных данных <br>
так что запустили и не трогаем)

npm run dev

<h2>Client</h2>
<ul>
<li>socket.io-client для текстовых сообщений</li>
<li>simple-peer - для видео звонков</li>
<li>react</li>
</ul>

пока что бы позвонить нужно нажать на кнопку start video - а потом уже звонить <br>
в файле Chat.jsx - const socket = io.connect("http://localhost:4001"); <br>
url должен совпадать с api сервера - будте внимательны

npm run start
