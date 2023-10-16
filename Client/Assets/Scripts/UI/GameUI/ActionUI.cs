using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class ActionUI : MonoBehaviour
{
    [SerializeField] private GameObject m_CheckButton;
    [SerializeField] private GameObject m_CallButton;
    [SerializeField] private UILabel m_CallBetLabel;
    [SerializeField] private GameObject m_CallLabelObj;
    [SerializeField] private GameObject m_CallAllInLabelObj;
    [SerializeField] private GameObject m_RaiseButton;
    [SerializeField] private UILabel m_RaiseBetLabel;
    [SerializeField] private GameObject m_RaiseRoot;

    [SerializeField] private UISlider m_BetSlider;
    [SerializeField] private UIInput m_BetInput;

    public SoundPlay m_SoundPlay;

    public Action onFold;
    public Action<float> onBet;

    private float m_Call, m_Raise;
    private float m_MinRaise, m_MaxRaise, m_POT;
    private float m_Increment;
    private bool m_ShowInBB;
    private float m_bigBlind;
    private bool m_showDollarSign;

    private void Start()
    {
        m_SoundPlay = FindObjectOfType<SoundPlay>();
    }

    public void ShowCall(float call, bool allin)
    {
        m_Call = call;

        if (call == 0)
        {
            m_CheckButton.SetActive(true);
            m_CallButton.SetActive(false);
        }
        else
        {
            m_CheckButton.SetActive(false);
            m_CallButton.SetActive(true);

            if (m_ShowInBB)
            {
                m_CallBetLabel.text = $"{(int)(call / m_bigBlind * 100) / 100f}BB";
            }
            else
            {
                m_CallBetLabel.text = m_showDollarSign ? $"${call:N0}" : $"{call:N0}";
            }
            

            if (allin)
            {
                m_CallLabelObj.SetActive(false);
                m_CallAllInLabelObj.SetActive(true);
            }
            else
            {
                m_CallLabelObj.SetActive(true);
                m_CallAllInLabelObj.SetActive(false);
            }
        }
    }

    public void ShowRaise(float minRaise, float maxRaise, float pot, float increment)
    {
        m_RaiseRoot.SetActive(true);
        m_RaiseButton.SetActive(true);

        m_MinRaise = minRaise;
        m_MaxRaise = maxRaise;
        m_POT = pot;
        m_Increment = increment;

        m_BetInput.submitOnUnselect = true;

        m_BetSlider.value = 0;
        OnBetSliderChange();
    }

    public void HideRaise()
    {
        m_RaiseRoot.SetActive(false);
        m_RaiseButton.SetActive(false);
    }

    public void OnFoldClick()
    {
        onFold?.Invoke();
    }

    public void OnCheckClick()
    {
        onBet?.Invoke(0);
    }

    public void OnCallClick()
    {
        onBet?.Invoke(m_Call);
    }

    public void OnRaiseClick()
    {
        onBet?.Invoke(m_Raise);
    }

    public void OnMinClick()
    {
        SetRaise(m_MinRaise);
    }

    public void OnPOT_1_3_Click()
    {
        SetRaise(m_POT / 3);
    }

    public void OnPOT_1_2_Click()
    {
        SetRaise(m_POT / 2);
    }

    public void OnPOT_2_3_Click()
    {
        SetRaise(2 * m_POT / 3);
    }

    public void OnPOTClick()
    {
        SetRaise(m_POT);
    }

    public void OnAllInClick()
    {
        SetRaise(m_MaxRaise);
    }

    public void OnBetInputSubmit()
    {
        var raise = Convert.ToSingle(m_BetInput.value.Trim('B'));
        SetRaise(raise);
    }

    public void OnPlusClick()
    {
        SetRaise(m_Raise + m_Increment);
    }

    public void OnMinusClick()
    {
        SetRaise(m_Raise - m_Increment);
    }

    public void OnBetSliderChange()
    {
        SetRaise(Mathf.Lerp(m_MinRaise, m_MaxRaise, m_BetSlider.value));
    }

    private void SetRaise(float raise)
    {
        m_Raise = Mathf.Clamp(raise, m_MinRaise, m_MaxRaise);

        m_RaiseBetLabel.text = m_ShowInBB ? $"{(int)(m_Raise / m_bigBlind * 100) / 100f}BB" : m_showDollarSign ? $"${m_Raise:N0}" : $"{m_Raise:N0}";
        m_BetInput.value = m_ShowInBB ? $"{(int)(m_Raise / m_bigBlind * 100) / 100f}BB" : m_showDollarSign ? $"${m_Raise:N0}" : $"{m_Raise:N0}";
        m_BetSlider.value = Mathf.InverseLerp(m_MinRaise, m_MaxRaise, m_Raise);
    }

    public void setOptionShowInBB(bool value, float bb)
    {
        m_ShowInBB = value;
        m_bigBlind = bb;

        m_BetInput.value = m_ShowInBB ? $"{(int)(m_Raise / m_bigBlind * 100) / 100f}BB" : m_showDollarSign ? $"${m_Raise:N0}" : $"{m_Raise:N0}";
        m_RaiseBetLabel.text = m_ShowInBB ? $"{(int)(m_Raise / m_bigBlind * 100) / 100f}BB" : m_showDollarSign ? $"${m_Raise:N0}" : $"{m_Raise:N0}";
        m_CallBetLabel.text = m_ShowInBB ? $"{(int)(m_Call / m_bigBlind * 100) / 100f}BB" : m_showDollarSign ? $"${m_Call:N0}" : $"{m_Call:N0}";
    }

    public void setShowDollarSign(bool value)
    {
        m_showDollarSign = value;
    }
}
