using BestHTTP.SocketIO.Events;
using System;

namespace BestHTTP.SocketIO
{
    public static class SocketIOExtensions
    {
        public static SocketIOCallback On(this Socket socket, string eventName, Action callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback();
            socket.On(eventName, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback On<T1>(this Socket socket, string eventName, Action<T1> callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0]);
            socket.On(eventName, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback On<T1, T2>(this Socket socket, string eventName, Action<T1, T2> callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[1]);
            socket.On(eventName, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback On<T1, T2, T3>(this Socket socket, string eventName, Action<T1, T2, T3> callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[1], (T3)a[2]);
            socket.On(eventName, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback On(this Socket socket, SocketIOEventTypes type, Action callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback();
            socket.On(type, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback On<T1>(this Socket socket, SocketIOEventTypes type, Action<T1> callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0]);
            socket.On(type, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback On<T1, T2>(this Socket socket, SocketIOEventTypes type, Action<T1, T2> callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[0]);
            socket.On(type, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback On<T1, T2, T3>(this Socket socket, SocketIOEventTypes type, Action<T1, T2, T3> callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[0], (T3)a[2]);
            socket.On(type, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback On(this Socket socket, string eventName, Action callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback();
            socket.On(eventName, ioCallback, autoDecodePayload);
            return ioCallback;
        }

        public static SocketIOCallback On<T1>(this Socket socket, string eventName, Action<T1> callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0]);
            socket.On(eventName, ioCallback, autoDecodePayload);
            return ioCallback;
        }

        public static SocketIOCallback On<T1, T2>(this Socket socket, string eventName, Action<T1, T2> callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[1]);
            socket.On(eventName, ioCallback, autoDecodePayload);
            return ioCallback;
        }

        public static SocketIOCallback On<T1, T2, T3>(this Socket socket, string eventName, Action<T1, T2, T3> callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[1], (T3)a[2]);
            socket.On(eventName, ioCallback, autoDecodePayload);
            return ioCallback;
        }

        public static SocketIOCallback On(this Socket socket, SocketIOEventTypes type, Action callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback();
            socket.On(type, ioCallback, autoDecodePayload);
            return ioCallback;
        }

        public static SocketIOCallback On<T1>(this Socket socket, SocketIOEventTypes type, Action<T1> callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0]);
            socket.On(type, ioCallback, autoDecodePayload);
            return ioCallback;
        }

        public static SocketIOCallback On<T1, T2>(this Socket socket, SocketIOEventTypes type, Action<T1, T2> callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[1]);
            socket.On(type, ioCallback, autoDecodePayload);
            return ioCallback;
        }

        public static SocketIOCallback On<T1, T2, T3>(this Socket socket, SocketIOEventTypes type, Action<T1, T2, T3> callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[1], (T3)a[2]);
            socket.On(type, ioCallback, autoDecodePayload);
            return ioCallback;
        }

        public static SocketIOCallback Once(this Socket socket, string eventName, Action callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback();
            socket.Once(eventName, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback Once<T1>(this Socket socket, string eventName, Action<T1> callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0]);
            socket.Once(eventName, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback Once<T1, T2>(this Socket socket, string eventName, Action<T1, T2> callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[1]);
            socket.Once(eventName, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback Once<T1, T2, T3>(this Socket socket, string eventName, Action<T1, T2, T3> callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[1], (T3)a[2]);
            socket.Once(eventName, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback Once(this Socket socket, SocketIOEventTypes type, Action callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback();
            socket.Once(type, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback Once<T1>(this Socket socket, SocketIOEventTypes type, Action<T1> callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0]);
            socket.Once(type, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback Once<T1, T2>(this Socket socket, SocketIOEventTypes type, Action<T1, T2> callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[0]);
            socket.Once(type, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback Once<T1, T2, T3>(this Socket socket, SocketIOEventTypes type, Action<T1, T2, T3> callback)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[0], (T3)a[2]);
            socket.Once(type, ioCallback);
            return ioCallback;
        }

        public static SocketIOCallback Once(this Socket socket, string eventName, Action callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback();
            socket.Once(eventName, ioCallback, autoDecodePayload);
            return ioCallback;
        }

        public static SocketIOCallback Once<T1>(this Socket socket, string eventName, Action<T1> callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0]);
            socket.Once(eventName, ioCallback, autoDecodePayload);
            return ioCallback;
        }

        public static SocketIOCallback Once<T1, T2>(this Socket socket, string eventName, Action<T1, T2> callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[1]);
            socket.Once(eventName, ioCallback, autoDecodePayload);
            return ioCallback;
        }

        public static SocketIOCallback Once<T1, T2, T3>(this Socket socket, string eventName, Action<T1, T2, T3> callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[1], (T3)a[2]);
            socket.Once(eventName, ioCallback, autoDecodePayload);
            return ioCallback;
        }

        public static SocketIOCallback Once(this Socket socket, SocketIOEventTypes type, Action callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback();
            socket.Once(type, ioCallback, autoDecodePayload);
            return ioCallback;
        }

        public static SocketIOCallback Once<T1>(this Socket socket, SocketIOEventTypes type, Action<T1> callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0]);
            socket.Once(type, ioCallback, autoDecodePayload);
            return ioCallback;
        }

        public static SocketIOCallback Once<T1, T2>(this Socket socket, SocketIOEventTypes type, Action<T1, T2> callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[1]);
            socket.Once(type, ioCallback, autoDecodePayload);
            return ioCallback;
        }

        public static SocketIOCallback Once<T1, T2, T3>(this Socket socket, SocketIOEventTypes type, Action<T1, T2, T3> callback, bool autoDecodePayload)
        {
            SocketIOCallback ioCallback = (s, p, a) => callback((T1)a[0], (T2)a[1], (T3)a[2]);
            socket.Once(type, ioCallback, autoDecodePayload);
            return ioCallback;
        }
    }
}
