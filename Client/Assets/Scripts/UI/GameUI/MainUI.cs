using System.Collections;
using System.Collections.Generic;
using UnityEngine;

using System;

public class MainUI : MonoBehaviour
{
    [SerializeField] private UILabel m_UserNameLabel;
    [SerializeField] private UILabel m_TableNameLabel;
    [SerializeField] private UILabel m_LevelLabel;
    [SerializeField] private UILabel m_SmallBlindLabel;
    [SerializeField] private UILabel m_BigBlindLabel;
    [SerializeField] private UILabel m_RoundLabel;
    [SerializeField] private UILabel m_RoundStateLabel;
    [SerializeField] private UIToggle m_WaitForBBCheck;
    [SerializeField] private UIToggle m_FoldToAnyBetCheck;
    [SerializeField] private UIToggle m_AutoCheckCheck;
    [SerializeField] private UIToggle m_AutoCheckOrFoldCheck;
    [SerializeField] private UIToggle m_SitOutNextHandCheck;
    [SerializeField] private GameObject m_AddChipsObj;
    [SerializeField] private GameObject m_ShowCardsObj;
    [SerializeField] private GameObject m_SitOutObj;
    [SerializeField] private GameObject m_SitInObj;
    [SerializeField] private ConfirmUI m_FoldToAnyBetConfirmUI;
    [SerializeField] private GameObject m_PauseUI;
    [SerializeField] private GameObject m_BreakTimeUI;

    [SerializeField] private UILabel m_NextSBLabel;
    [SerializeField] private UILabel m_NextBBLabel;
    [SerializeField] private UILabel m_AnteValueLabel;
    [SerializeField] private UILabel m_LevelTimerLabel;
    [SerializeField] private UILabel m_AnteLabel;
    [SerializeField] private UILabel m_NextLevelLabel;

    private Timer m_breakTimer;
    private LevelTimer m_levelTimer;
    private bool m_showDollarSign;

    public Action onLeaveClick;

    public bool optionWaitForBB { get; private set; }
    public Action<bool> onOptionWaitForBB;

    public bool optionFoldToAnyBet { get; private set; }
    public Action<bool> onOptionFoldToAnyBet;

    public bool optionAutoMuck { get; private set; }
    public Action<bool> onOptionAutoMuck;

    public bool optionActionAutoCheck { get; private set; }
    public Action<bool> onOptionActionAutoCheck;

    public bool optionActionAutoCheckOrFold { get; private set; }
    public Action<bool> onOptionActionAutoCheckOrFold;

    public Action onAddChipsClick;
    public Action onViewOptionClick;
    public Action onShowCardsClick;
    public Action onSitOutClick;
    public Action onSitInClick;
    public Action onStandUpClick;
    public bool optionSitOutNextHand { get; private set; }
    public bool optionShowInBB { get; private set; }
    public Action<bool> onOptionSitOutNextHand;
    public Action<bool> onOptionShowInBB;
    
    
    private void Start()
    {
        m_breakTimer = FindObjectOfType<Timer>();
        m_levelTimer = FindObjectOfType<LevelTimer>();
    }
    
    public void SetPlayerName(string name)
    {
        m_UserNameLabel.text = name;
    }

    public void SetTableName(string name)
    {
        m_TableNameLabel.text = name;
    }

    public void SetSmallBlind(float smallBlind)
    {
        m_SmallBlindLabel.text = m_showDollarSign ? $"${smallBlind}" : $"{smallBlind}";
    }

    public void SetBigBlind(float bigBlind)
    {
        m_BigBlindLabel.text = m_showDollarSign ? $"${bigBlind}" : $"{bigBlind}";
    }

    public void SetLevelInfo(int level, int duration, float nextSB, float nextBB, float ante)
    {
        m_LevelLabel.text = $"{level}";
        m_NextSBLabel.text = $"{nextSB}";
        m_NextBBLabel.text = $"{nextBB}";
        m_AnteValueLabel.text = $"{ante}";

        if(m_levelTimer.timeRemaining == 0)
            m_levelTimer.timeRemaining = duration;
       
    }

    public void ShowLevel(bool visible)
    {
        m_LevelLabel.gameObject.SetActive(visible);
        m_NextSBLabel.gameObject.SetActive(visible);
        m_NextBBLabel.gameObject.SetActive(visible);
        m_AnteValueLabel.gameObject.SetActive(visible);
        m_levelTimer.gameObject.SetActive(visible);
        m_AnteLabel.gameObject.SetActive(visible);
        m_NextLevelLabel.gameObject.SetActive(visible);
        m_levelTimer.timerIsRunning = visible;
    }

    public void SetRound(int round)
    {
        m_RoundLabel.text = $"{round}";
    }

    public void SetRoundState(string state)
    {
        m_RoundStateLabel.text = state;
    }

    public void OnLeaveClick()
    {
        onLeaveClick?.Invoke();
    }

    public void ShowWaitForBB(bool visible)
    {
        m_WaitForBBCheck.gameObject.SetActive(visible);
    }

    public void SetWaitForBB(bool value)
    {
        m_WaitForBBCheck.value = value;
        OnOptionWaitForBBToggle(m_WaitForBBCheck);
    }

    public void OnOptionWaitForBBToggle(UIToggle toggle)
    {
        optionWaitForBB = toggle.value;
        onOptionWaitForBB?.Invoke(optionWaitForBB);
    }

    public void ShowFoldToAnyBet(bool visible)
    {
        m_FoldToAnyBetCheck.gameObject.SetActive(visible);
    }

    public void SetFoldToAnyBet(bool value)
    {
        m_FoldToAnyBetCheck.value = value;
    }

    public void OnOptionFoldToAnyBetToggle(UIToggle toggle)
    {
        if (toggle.value)
        {
            m_FoldToAnyBetConfirmUI.gameObject.SetActive(true);
            m_FoldToAnyBetConfirmUI.onYes = () =>
            {
                optionFoldToAnyBet = toggle.value;
                onOptionFoldToAnyBet?.Invoke(optionFoldToAnyBet);

                ShowAutoCheckOptions(false);
            };
            m_FoldToAnyBetConfirmUI.onNo = () =>
            {
                toggle.value = false;
                OnOptionFoldToAnyBetToggle(toggle);
            };
        }
        else
        {
            optionFoldToAnyBet = toggle.value;
            onOptionFoldToAnyBet?.Invoke(optionFoldToAnyBet);

            ShowAutoCheckOptions(true);
        }
    }

    public void ShowAutoCheckOptions(bool visible)
    {
        m_AutoCheckCheck.gameObject.SetActive(visible);
        m_AutoCheckOrFoldCheck.gameObject.SetActive(visible);
        ResetAutoCheckOptions();
    }

    public void ResetAutoCheckOptions()
    {
        m_AutoCheckCheck.value = false;
        OnOptionActionAutoCheckToggle(m_AutoCheckCheck);
        m_AutoCheckOrFoldCheck.value = false;
        OnOptionActionAutoCheckOrFoldToggle(m_AutoCheckOrFoldCheck);
    }

    public void OnOptionActionAutoCheckToggle(UIToggle toggle)
    {
        optionActionAutoCheck = toggle.value;
        onOptionActionAutoCheck?.Invoke(optionActionAutoCheck);

        if (optionActionAutoCheck)
        {
            m_AutoCheckOrFoldCheck.value = false;
            OnOptionActionAutoCheckOrFoldToggle(m_AutoCheckOrFoldCheck);
        }
    }

    public void OnOptionActionAutoCheckOrFoldToggle(UIToggle toggle)
    {
        optionActionAutoCheckOrFold = toggle.value;
        onOptionActionAutoCheckOrFold?.Invoke(optionActionAutoCheckOrFold);

        if (optionActionAutoCheckOrFold)
        {
            m_AutoCheckCheck.value = false;
            OnOptionActionAutoCheckToggle(m_AutoCheckCheck);
        }
    }

    public void OnOptionAutoMuckToggle(UIToggle toggle)
    {
        optionAutoMuck = toggle.value;
        onOptionAutoMuck?.Invoke(optionAutoMuck);
    }

    public void ShowSitOutNextHand(bool visible)
    {
        m_SitOutNextHandCheck.gameObject.SetActive(visible);
    }

    public void SetSitOutNextHand(bool value)
    {
        m_SitOutNextHandCheck.value = value;
    }

    public void ShowAddChips(bool visible)
    {
        m_AddChipsObj.SetActive(visible);
    }

    public void OnAddChipsClick()
    {
        onAddChipsClick?.Invoke();
    }

    public void OnViewOptionClick()
    {
        onViewOptionClick?.Invoke();
    }

    public void ShowShowCards(bool visible)
    {
        m_ShowCardsObj.SetActive(visible);
    }

    public void OnShowCardsClick()
    {
        onShowCardsClick?.Invoke();
    }

    public void ShowSitIn(bool visible)
    {
        m_SitInObj.SetActive(visible);
    }

    public void OnSitInClick()
    {
        onSitInClick?.Invoke();
    }

    public void ShowSitOut(bool visible)
    {
        m_SitOutObj.SetActive(visible);
    }

    public void OnSitOutClick()
    {
        onSitOutClick?.Invoke();
    }

    public void OnOptionSitOutNextHandToggle(UIToggle toggle)
    {
        optionSitOutNextHand = toggle.value;
        onOptionSitOutNextHand?.Invoke(optionSitOutNextHand);
    }

    public void OnStandUpClick()
    {
        onStandUpClick?.Invoke();
    }

    public void ShowPause(bool visible)
    {
        m_PauseUI.SetActive(visible);
    }

    public void ShowBreakTime(bool visible)
    {
        m_BreakTimeUI.SetActive(visible);

        if (visible && m_breakTimer.timerIsRunning)
            return;

        if(visible) {
            m_breakTimer.timeRemaining = 60;
        }
        else {
            m_breakTimer.timeRemaining = 0;
        }
        m_breakTimer.timerIsRunning = visible;
    }

    public void setShowDollarSign(bool value)
    {
        m_showDollarSign = value;
    }
}
