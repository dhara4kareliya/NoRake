using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PauseUI : MonoBehaviour
{
    [SerializeField] private UILabel m_ClockLabel;

    private float m_StartTime;

    private void OnEnable()
    {
        m_StartTime = Time.time;
    }

    private void Update()
    {
        var duration = TimeSpan.FromSeconds(Time.time - m_StartTime);
        m_ClockLabel.text = duration.ToString(@"hh\:mm\:ss");
    }
}
