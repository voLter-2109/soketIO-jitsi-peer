const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const app = express();

const route = express.Router();
const { addUser, findUser, getRoomUsers, removeUser } = require("./users");

app.use(cors({ origin: "*" }));
app.use(route);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  // любое событие, полученное сервером, будет напечатано в консоли.
  socket.onAny((event, ...args) => {
    console.log(event + " server", args);
  });

  socket.on("join", ({ name, room }) => {
    socket.join(room);
    console.log(name);
    console.log(room);

    const { user, isExist } = addUser({ name, room });

    socket.emit("me", socket.id);
    console.log(socket.id);

    const userMessage = isExist
      ? `${user.name}, here you go again my uid - ${socket.id}`
      : `Hellow ${user.name} my uid - ${socket.id}`;

    socket.emit("message", {
      data: { user: { name: "Admin" }, message: userMessage },
    });

    socket.broadcast.to(user.room).emit("message", {
      data: {
        user: { name: "Admin" },
        message: `${user.name} has joined your uid - ${socket.id}`,
      },
    });

    io.to(user.room).emit("room", {
      data: { users: getRoomUsers(user.room) },
    });
  });

  socket.on("sendMessage", ({ message, params }) => {
    const user = findUser(params);
    console.log(message);

    if (user) {
      io.to(user.room).emit("message", { data: { user, message } });
    }
  });

  socket.on("leftRoom", ({ params }) => {
    const user = removeUser(params);

    if (user) {
      const { room, name } = user;

      io.to(room).emit("message", {
        data: { user: { name: "Admin" }, message: `${name} has left` },
      });

      io.to(room).emit("room", {
        data: { users: getRoomUsers(room) },
      });
    }
  });

  socket.on("disconnectCall", () => {
    socket.broadcast.emit("callEnded");
  });

  socket.on("callUser", (data) => {
    console.log(`Incoming call from ${data.from}`);
    io.to(data.userToCall).emit("callUser", {
      signal: data.signalData,
      from: data.from,
      name: data.name,
    });
  });

  socket.on("answerCall", (data) => {
    console.log(`Answering call from ${data.from}`);
    io.to(data.to).emit("callAccepted", data.signal);
  });

  io.on("disconnect", () => {
    console.log("Disconnect");
  });
});

server.listen(4001, () => {
  console.log("Server is running");
});
