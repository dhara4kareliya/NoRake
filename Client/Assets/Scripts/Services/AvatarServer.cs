using BestHTTP;
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

public class AvatarServerException : ApplicationException
{
    public AvatarServerException(string message) : base(message) { }
}

public class AvatarServer: MonoBehaviour
{
    private string _baseUrl;

    private Dictionary<int, Texture2D> _cache = new Dictionary<int, Texture2D>();
    private Dictionary<int, int> _retries = new Dictionary<int, int>();

    public void SetServer(string baseUrl)
    {
        _baseUrl = baseUrl;
    }

    public IEnumerator LoadWithUrl(string url, Action<Texture2D> callback)
    {
        Texture2D tex;
        UnityWebRequest www = UnityWebRequestTexture.GetTexture(url);
        yield return www.SendWebRequest();

        if (www.isNetworkError || www.isHttpError) {
            Debug.LogWarning($"Failed to download avatar texture for url: {url}\n{www.error}");
            callback(null);
        }
        else {
            Debug.Log($"Success to download avatar texture for url: {url}");
            tex = ((DownloadHandlerTexture)www.downloadHandler).texture;
            callback(tex);
        }
    }

    public void Load(int index, Action<Texture2D> callback)
    {
        Texture2D tex;
        if (_cache.TryGetValue(index, out tex))
        {
            callback(tex);
            return;
        }

        var promise = new Promise<Texture2D>();
        promise.onResolvedWithResult += (texture) =>
        {
            Debug.Log($"Success to download avatar texture for id: {index}");

            _cache[index] = texture;
            callback(texture);
        };
        promise.onRejected += (exception) =>
        {
            Debug.LogWarning($"Failed to download avatar texture for id: {index}");

            int retry;
            if (!_retries.TryGetValue(index, out retry))
                retry = 0;
            if (retry < 3)
            {
                Debug.Log($"Retry to download avatar texture for id: {index}");

                Load(index, callback);
                _retries[index] = ++retry;
            }
            else
            {
                Debug.LogError($"Failed to download avatar texture for id: {index}");

                _cache[index] = null;
                callback(null);
            }
        };

        DownloadAvatar(index, promise);
    }

    private void DownloadAvatar(int id, Promise<Texture2D> promise = null)
    {
        if (string.IsNullOrEmpty(_baseUrl))
            return;

        var uri = new Uri(new Uri(_baseUrl), $"/avatar/{id}");
        var request = new HTTPRequest(uri, (req, res) => OnAvatarDownload(req, res, promise));
        request.Send();
    }

    private void OnAvatarDownload(HTTPRequest request, HTTPResponse response, Promise<Texture2D> promise)
    {
        if (request.State == HTTPRequestStates.Finished && request.Response.IsSuccess)
        {
            var texture = request.Response.DataAsTexture2D;

            if (texture != null)
            {
                promise?.Resolve(texture);
            }
            else
            {
                promise?.Reject(new AvatarServerException($"Failed to download avatar from avatar server. request url: {request.Uri}"));
            }
        }
        else
        {
            promise?.Reject(new AvatarServerException($"Failed to connect to avatar server. request state: {request.State}"));
        }
    }
}
