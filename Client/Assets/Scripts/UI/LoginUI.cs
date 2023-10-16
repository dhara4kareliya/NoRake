using System;
using UnityEngine;
using UnityEngine.UI;

public class LoginUI : MonoBehaviour
{
    public string userName { get; private set; }

    [SerializeField]
    private InputField m_UserNameInputField;

    public Action onLogin;

    public void OnLogin()
    {
        userName = m_UserNameInputField.text;

        onLogin?.Invoke();
    }
}
