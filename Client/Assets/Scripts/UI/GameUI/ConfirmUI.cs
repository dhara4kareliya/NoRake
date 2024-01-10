using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class ConfirmUI : MonoBehaviour
{
    [SerializeField] private bool m_AutoHide = true;

    public Action onYes;
    public Action onNo;

    public void OnYesClick()
    {
        onYes?.Invoke();

        TryHide();
    }

    public void OnNoClick()
    {
        onNo?.Invoke();

        TryHide();
    }

    private void TryHide()
    {
        if (m_AutoHide)
            gameObject.SetActive(false);
    }
}
