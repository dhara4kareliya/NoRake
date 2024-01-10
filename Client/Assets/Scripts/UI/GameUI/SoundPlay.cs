using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class SoundPlay : MonoBehaviour
{
    [SerializeField] private AudioSource m_audioCardDealt;

    [SerializeField] private AudioSource m_audioEndStreet;

    [SerializeField] private AudioSource m_audioFlop;

    [SerializeField] private AudioSource m_audioTurnRiver;

    [SerializeField] private AudioSource m_audioWinnerTakePot;

    [SerializeField] private AudioSource m_audioCall;

    [SerializeField] private AudioSource m_audioCheck;

    [SerializeField] private AudioSource m_audioRaise;

    public void playCardDealt()
    {
        try { m_audioCardDealt.Play(); }
        catch {}
    }

    public void playEndStreet()
    {
        try { m_audioEndStreet.Play(); }
        catch {}
    }

    public void playFlop()
    {
        try { m_audioFlop.Play(); }
        catch {}
    }

    public void playTurnRiver()
    {
        try { m_audioTurnRiver.Play(); }
        catch {}
    }

    public void playWinnerPot()
    {
        try { m_audioWinnerTakePot.Play(); }
        catch {}
    }

    public void playCall()
    {
        try { m_audioCall.Play(); }
        catch {}
    }

    public void playCheck()
    {
        try { m_audioCheck.Play(); }
        catch {}
    }

    public void playRaise()
    {
        try { m_audioRaise.Play(); }
        catch {}
    }
}
