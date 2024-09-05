import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Peer from "simple-peer";
import io from "socket.io-client";

import styles from "../styles/Chat.module.css";
import Messages from "./Messages";

const socket = io.connect("http://localhost:4001");
// любое событие, полученное сервером, будет напечатано в консоли.
socket.onAny((event, ...args) => {
  console.log(event + " server", args);
});

const Chat = () => {
  const { search } = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useState({ room: "", user: "" });
  const [state, setState] = useState([]);
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState(0);
  const [videoState, setVideoState] = useState("Start Video");

  const [me, setMe] = useState("");
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");

  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [idToCall, setIdToCall] = useState("");
  const [callEnded, setCallEnded] = useState(false);
  const [name, setName] = useState("");

  const userVideo = useRef(null);
  const connectionRef = useRef(null);
  const myVideo = useRef(null);

  const [videoSource, setVideoSource] = useState();
  const [audioSource, setAudioSource] = useState();

  const hasGetUserMedia = () => {
    /*
     * enumerateDevices() - List available media list
     * getSupportedConstraints() - List constraint properties
     * getDisplayMedia() - Request desktop share
     * getUserMedia() - Use user media. Need to get access permission first
     *                  & only can be called from HTTPS, localhost or file:// URL
     */
    return navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  };
  const getDevices = (deviceInfos) => {
    // console.log(deviceInfos);
    const audioSelect = document.getElementById("audioSource");
    const videoSelect = document.getElementById("videoSource");
    audioSelect.length = 0;
    videoSelect.length = 0;
    for (let i = 0; i < deviceInfos.length; ++i) {
      let deviceInfo = deviceInfos[i];
      console.log(deviceInfo);
      if (deviceInfo.kind === "audioinput") {
        let option = document.createElement("option");
        option.value = deviceInfo.deviceId;
        option.text = deviceInfo.label || "Audio " + (audioSelect.length + 1);
        audioSelect.appendChild(option);
      } else if (deviceInfo.kind === "videoinput") {
        let option = document.createElement("option");
        option.value = deviceInfo.deviceId;
        option.text = deviceInfo.label || "Video " + (videoSelect.length + 1);
        videoSelect.appendChild(option);
      } else {
        console.log("Found another kind of device: ", deviceInfo);
      }
    }

    console.log(audioSelect.value);
    console.log(videoSelect.value);
    audioSelect.value && setAudioSource(audioSelect.value);
    videoSelect.value && setVideoSource(videoSelect.value);
  };

  const captureBtn = () => {
    if (window.stream) {
      videoStop();
      setVideoState("Start Video");
    } else if (videoSource) {
      videoStart();
      setVideoState("Stop Video");
    } else {
      navigator.mediaDevices
        .getUserMedia({ audio: true, video: true })
        .then(() => {
          navigator.mediaDevices.enumerateDevices().then(getDevices);
        });
    }
  };

  const handleError = (error) => {
    console.error("Error: ", error);
    setVideoState("Start Video");
  };

  const getStream = (stream) => {
    // const videoElement = document.querySelector("video");
    window.stream = stream;
    // console.log(stream)
    console.log(userVideo);
    userVideo.current.srcObject = stream;
    // videoElement.srcObject = stream;
  };

  const videoStart = useCallback(() => {
    const constraints = {
      audio: true,
      video: {
        deviceId: { exact: videoSource },
      },
    };
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(getStream)
      .catch(handleError);
  }, [videoSource]);

  const videoStop = () => {
    if (window.stream) {
      window.stream.getTracks().forEach(function (track) {
        track.stop();
      });
      delete window.stream;
    }
  };

  useEffect(() => {
    if (hasGetUserMedia()) {
      // navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      navigator.mediaDevices.enumerateDevices().then(getDevices);
    } else {
      alert("getUserMedia() is not supported by your browser");
    }
  }, []);

  // ! Звонок

  useEffect(() => {
    socket.on("me", (id) => {
      console.log(id);
      setMe(id);
    });

    socket.on("callUser", (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setName(data.name);
      setCallerSignal(data.signal);
    });
  }, []);

  useEffect(() => {
    if (myVideo.current) {
      myVideo.current.srcObject = stream;
    }
  }, [stream]);

  const callUser = (id) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: window.stream,
    });

    peer.on("signal", (data) => {
      socket.emit("callUser", {
        userToCall: id,
        signalData: data,
        from: me,
        name: name,
      });
    });

    peer.on("stream", (stream) => {
      videoStart(stream);
    });

    socket.on("callAccepted", (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallAccepted(true);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
    });

    peer.on("signal", (data) => {
      socket.emit("answerCall", { signal: data, to: caller });
    });

    peer.on("stream", (stream) => {
      userVideo.current.srcObject = stream;
      if (userVideo.current) {
        userVideo.current.srcObject = stream;
      }
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    videoStop();
    setCallEnded(true);
    if (connectionRef.current) {
      connectionRef.current.destroy();
    }
  };

  // ! чат - сообщения
  useEffect(() => {
    const searchParams = Object.fromEntries(new URLSearchParams(search));
    setParams(searchParams);
    socket.emit("join", searchParams);
  }, [search]);

  useEffect(() => {
    socket.on("message", ({ data }) => {
      setState((_state) => [..._state, data]);
    });
  }, []);

  useEffect(() => {
    socket.on("room", ({ data: { users } }) => {
      setUsers(users.length);
    });
  }, []);

  const leftRoom = () => {
    socket.emit("leftRoom", { params });
    navigate("/");
  };

  const handleChange = ({ target: { value } }) => setMessage(value);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!message) return;

    socket.emit("sendMessage", { message, params });

    setMessage("");
  };

  useEffect(() => {
    console.log(userVideo.current);
  }, [userVideo]);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.title}>{params.room}</div>
        <div className={styles.users}>{users} users in this room</div>
        <div className={styles.users}>{me} uIs</div>
        <button className={styles.left} onClick={leftRoom}>
          Left the room
        </button>
      </div>

      <div className={styles.messages}>
        <Messages messages={state} name={params.name} />
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.input}>
          <input
            type="text"
            name="message"
            placeholder="What do you want to say?"
            value={message}
            onChange={handleChange}
            autoComplete="off"
            required
          />
        </div>

        <div className={styles.button}>
          <input type="submit" onSubmit={handleSubmit} value="Send a message" />
        </div>
      </form>
      <div>
        <div className={styles.video}>
          <div className="flex flex-col w-full gap-3 text-black">
            <select
              id="audioSource"
              placeholder="выбери микрофон"
              onChange={(e) => setAudioSource(e.target.value)}
            />
            <select
              id="videoSource"
              onChange={(e) => setVideoSource(e.target.value)}
            />
            <button onClick={captureBtn}>{videoState}</button>
          </div>
          <div className="flex-grow flex flex-col items-center justify-center h-[90%]">
            <span className="text-white font-bold text-md mb-4 text-center underline"></span>
            <div className="flex flex-row gap-32">
              <div className="flex flex-row items-center justify-center w-full">
                <video
                  className="rounded-full"
                  ref={userVideo}
                  playsInline
                  autoPlay
                  style={{ width: "300px" }}
                />
                <div className="flex flex-col justify-center items-center">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/User-avatar.svg/2048px-User-avatar.svg.png"
                    className="rounded-full w-[15rem]"
                    alt="User Avatar"
                  />
                  <span className="text-white font-bold text-lg">
                    {idToCall}
                  </span>
                </div>
              </div>
            </div>
            <textarea
              className="text-black"
              value={idToCall}
              onChange={(e) => {
                setIdToCall(e.target.value);
              }}
            />

            <div>
              {callAccepted && !callEnded ? (
                <button
                  className="text-black hover:text-gray-400 mr-6 font-bold bg-white rounded-md m-4 px-2"
                  onClick={leaveCall}
                >
                  End Call
                </button>
              ) : (
                <button
                  className="text-black hover:text-gray-400 mr-6 font-bold bg-white rounded-md m-4 px-2"
                  onClick={() => callUser(idToCall)}
                >
                  Call
                </button>
              )}
            </div>

            <div className="text-white">
              {receivingCall && !callAccepted ? (
                <div className="caller flex flex-col">
                  <h1 className="text-white">{caller} is calling...</h1>
                  <button
                    className="text-black text-xl hover:text-gray-400 mr-6 font-bold bg-white rounded-md m-4 px-2"
                    onClick={answerCall}
                  >
                    Answer
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
