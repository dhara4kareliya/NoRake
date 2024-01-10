using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class SeatUI : MonoBehaviour
{
    [SerializeField] private GameObject m_Seat;
    [SerializeField] private PlayerUI m_Player;
    [SerializeField] private GameObject m_DealerObj;
    [SerializeField] private GameObject m_BigBlindObj;
    [SerializeField] private GameObject m_SmallBlindObj;
    [SerializeField] private GameObject m_MissBB;
    [SerializeField] private GameObject m_MissSB;
    [SerializeField] private int m_Index;

    public int index => m_Index;

    private bool m_PlayerSet;

    public PlayerUI player => m_PlayerSet ? m_Player : null;

    public Action onClick;

    public void SetPlayer()
    {
        m_PlayerSet = true;
        m_Seat.SetActive(false);
        m_Player.gameObject.SetActive(true);
    }

    public void ClearPlayer()
    {
        m_PlayerSet = false;

        m_Seat.SetActive(false);
        m_Player.gameObject.SetActive(false);
    }

    public void ShowSeat(bool visible = true)
    {
        m_Seat.SetActive(visible);
    }

    public void OnSeatClick()
    {
        onClick?.Invoke();
    }

    public void SetDealerButton(bool visible)
    {
        m_DealerObj.SetActive(visible);
    }

    public void SetSmallBlindButton(bool visible)
    {
        m_SmallBlindObj.SetActive(visible);
    }

    public void SetBigBlindButton(bool visible)
    {
        m_BigBlindObj.SetActive(visible);
    }

    public void SetMissingSmallBlindButton(bool visible)
    {
        m_MissSB.SetActive(visible);
    }

    public void SetMissingBigBlindButton(bool visible)
    {
        m_MissBB.SetActive(visible);
    }
}
