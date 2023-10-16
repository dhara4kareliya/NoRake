using BestHTTP;
using LitJson;
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class GameServerException : ApplicationException
{
    public GameServerException(string message) : base(message) { }
}

public class GameServer : MonoBehaviour
{
    private string m_BaseUrl;

    public void SetServer(string baseUrl)
    {
        m_BaseUrl = baseUrl;
    }

    private Uri FullUri(string relativeUrl) => new Uri(new Uri(m_BaseUrl), relativeUrl);

    public string token { get; private set; }

    private class Response
    {
        public string error;
    }

    public class LoginResponse
    {
        public string token;
    }

    public void Login(string userId, string password, Promise<LoginResponse> promise = null)
    {
        token = null;

        var request = new HTTPRequest(FullUri("/api/users/authenticate"), HTTPMethods.Post, (req, res) => OnLoginResult(req, res, promise));
        request.AddField("username", userId);
        request.AddField("password", password);
        request.Send();
    }

    private void OnLoginResult(HTTPRequest request, HTTPResponse response, Promise<LoginResponse> promise)
    {
        if (request.State == HTTPRequestStates.Finished && request.Response.IsSuccess)
        {
            var json = request.Response.DataAsText;
            var res = JsonMapper.ToObject<Response>(json);

            if (res.error == null)
            {
                var login = JsonMapper.ToObject<LoginResponse>(json);
                token = login.token;
                promise?.Resolve(login);
            }
            else
            {
                promise?.Reject(new GameServerException(res.error));
            }
        }
        else
        {
            promise?.Reject(new GameServerException($"Failed to connect to game server. request state: {request.State}"));
        }
    }

    public class ThreadResponse
    {
        public string server;
        public string token;
        public string gameType;
    }

    public void GetThread(string token, Promise<ThreadResponse> promise = null)
    {
        var request = new HTTPRequest(FullUri($"/api.php?api=get_ts&t={token}"), (req, res) => OnGetThreadResult(req, res, promise));
        request.Send();
    }

    private void OnGetThreadResult(HTTPRequest request, HTTPResponse response, Promise<ThreadResponse> promise)
    {
        if (request.State == HTTPRequestStates.Finished && request.Response.IsSuccess)
        {
            var json = request.Response.DataAsText;
            var res = JsonMapper.ToObject<Response>(json);

            if (res.error == null)
            {
                var thread = JsonMapper.ToObject<ThreadResponse>(json);
                promise?.Resolve(thread);
            }
            else
            {
                promise?.Reject(new GameServerException(res.error));
            }
        }
        else
        {
            promise?.Reject(new GameServerException($"Failed to connect to game server. request state: {request.State}"));
        }
    }
}
