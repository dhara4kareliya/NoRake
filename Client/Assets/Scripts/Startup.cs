using System;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.UI;

using System.Collections;
using System.Collections.Generic;

public class Startup : MonoBehaviour
{
    [SerializeField]
    private LoginUI m_LoginUI;
    [SerializeField]
    private string m_GameServerAddress = "http://localhost:3000";

    [SerializeField]
    private GameUI m_GameUI;

    [SerializeField]
    private string m_Thread = "test_thread";

    private string m_TableServerAddress;
    private string m_TableServerToken;
    private string m_TableServerType;

    private GameServer m_GameServer;
    private TableServer m_TableServer;
    private AvatarServer m_AvatarManager;

    private string m_UserToken;

#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern string GetGameServer();
    [DllImport("__Internal")]
    private static extern string GetThread();
    [DllImport("__Internal")]
    private static extern string GetUser();
    [DllImport("__Internal")]
    private static extern void SetTableName(string name);
    [DllImport("__Internal")]
    private static extern void Leave();
#else
    private string GetGameServer() => m_GameServerAddress;
    private string GetThread() => m_Thread;

    private static void SetTableName(string name)
    {
    }

    private static void Leave()
    {
        Application.Quit();
    }
#endif

    private IEnumerator Start()
    {
        m_GameServer = FindObjectOfType<GameServer>();
        m_TableServer = FindObjectOfType<TableServer>();
        m_AvatarManager = FindObjectOfType<AvatarServer>();

        m_GameServer.SetServer(GetGameServer());

        m_TableServer.onConnect += () => JoinToTableServer();
        m_TableServer.onTableSettings += (settings) => OnTableSettings(settings);
        m_TableServer.onPlayerLeave += (reason) => OnPlayerLeave(reason);

        yield return StartCoroutine(DoStartThread());
    }

    private IEnumerator DoStartThread()
    {
        yield return StartCoroutine(DoGetThreadInfo());
        yield return StartCoroutine(DoGetUserToken());
        ConnectTableServer();
    }

    private IEnumerator DoGetThreadInfo()
    {
        m_Thread = GetThread();
        Debug.Log($"Trying to get info for thread: {m_Thread}");

        var promise = new Promise<GameServer.ThreadResponse>();
        m_GameServer.GetThread(m_Thread, promise);
        yield return promise;
        if (promise.resolved)
        {
            m_TableServerAddress = promise.result.server;
            m_TableServerToken = promise.result.token;
            m_TableServerType = promise.result.gameType;
            Debug.Log($"Success to get thread info: server: {m_TableServerAddress}, token: {m_TableServerToken}");
        }
        else
        {
            Debug.LogError($"Failed to get thread info from game server.");
            m_TableServerAddress = null;
            m_TableServerToken = null;
            m_TableServerType = null;
        }
    }

    private void ConnectTableServer()
    {
        Debug.Log($"Table Server Address: {m_TableServerAddress}");
        Debug.Log($"Table Server Token: {m_TableServerToken}");
        Debug.Log($"Table Server Game Type: {m_TableServerType}");
        
        if (string.IsNullOrEmpty(m_TableServerAddress)
            || string.IsNullOrEmpty(m_TableServerToken)
            || string.IsNullOrEmpty(m_TableServerType))
            return;

        m_TableServer.SetServer(m_TableServerAddress, m_TableServerToken, m_TableServerType);
        m_TableServer.Connect();

        var promise = new Promise<TableServer.Options>();
        promise.onRejected += (ex) =>
        {
            Debug.LogError($"Failed to get options from table server.");
        };
        promise.onResolvedWithResult += (options) =>
        {
            var avatarServer = options.avatarServer;
            Debug.Log($"Avatar server: {avatarServer}");
            m_AvatarManager.SetServer(avatarServer);
        };

        m_TableServer.GetOptions(promise);
    }

    private void JoinToTableServer()
    {
        if (string.IsNullOrEmpty(m_UserToken))
        {
            Debug.LogError($"Invalid user token. Quiting now.");
            return;
        }

        m_LoginUI.gameObject.SetActive(false);
        m_GameUI.gameObject.SetActive(true);

        var joinPromise = new Promise<bool>();
        joinPromise.onResolvedWithResult += success =>
        {
            if (success)
            {
                Debug.Log($"Success to join table server.");
            }
            else
            {
                Debug.LogError($"Failed to join table server. Quiting now.");
                Leave();
            }
        };
        m_TableServer.Join(m_Thread, joinPromise);
    }

    private IEnumerator DoGetUserToken()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        m_UserToken = GetUser();
        yield return null;
#else
        m_LoginUI.gameObject.SetActive(false);
        m_GameUI.gameObject.SetActive(false);

        while (true)
        {
            var uiPromise = new Promise();
            m_LoginUI.onLogin = uiPromise.Resolve;
            m_LoginUI.gameObject.SetActive(true);
            yield return uiPromise;
            m_LoginUI.gameObject.SetActive(false);

            var username = m_LoginUI.userName;

            Debug.Log($"Try to login into game server. username: {username}");

            var loginPromise = new Promise<GameServer.LoginResponse>();
            m_GameServer.Login(username, string.Empty, loginPromise);
            yield return loginPromise;

            try
            {
                loginPromise.ThrowIfRejected();

                m_UserToken = loginPromise.result.token;
                Debug.Log($"Succeed to login into game server. token: {m_UserToken}");
                break;
            }
            catch (GameServerException ex)
            {
                Debug.LogError($"Failed to login into game server. message: {ex.Message}");
            }
        }

        m_GameUI.gameObject.SetActive(true);
#endif
    }

    private void OnTableSettings(TableServer.TableSettings settings)
    {
        SetTableName(settings.name);
    }

    private void OnPlayerLeave(IReadOnlyDictionary<string, object> reason)
    {
        var type = reason.GetString("type");
        if (type == "migrate")
        {
            m_TableServerAddress = reason.GetString("server");
            m_TableServerToken = reason.GetString("token");

            ConnectTableServer();
        }
        else
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            Leave();
#else
            StartCoroutine(DoStartThread());
#endif
        }
    }
}
