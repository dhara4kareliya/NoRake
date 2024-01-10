using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class PlayerUI : MonoBehaviour
{
    [SerializeField] private UILabel m_LabelName;
    [SerializeField] private UILabel m_LabelMoney;

    [SerializeField] private UIMaskedTexture m_TextureIcon;
    [SerializeField] private GameObject m_StandbyMask;

    [SerializeField] private UILabel m_BetLabel;
    [SerializeField] private UISprite m_SpriteAction;
    [SerializeField] private string m_ActionFoldSpriteName = "Fold";
    [SerializeField] private string m_ActionSmallBlindSpriteName = "SB";
    [SerializeField] private string m_ActionBigBlindSpriteName = "BB";
    [SerializeField] private string m_ActionCheckSpriteName = "Check";
    [SerializeField] private string m_ActionCallSpriteName = "Call";
    [SerializeField] private string m_ActionRaiseSpriteName = "Raise";
    [SerializeField] private string m_ActionAllInSpriteName = "Allin";

    [SerializeField] private GameObject m_TimerObj;
    [SerializeField] private UISprite m_SpriteTime;
    [SerializeField] private UISprite m_SpriteTimeFrame;
    [SerializeField] private UILabel m_LabelTime;
    [SerializeField] private UILabel m_LabelTimeBank;
    [SerializeField] private string m_ThinkTimeSpriteName = "Thought Timer Full";
    [SerializeField] private string m_ThinkTimeFrameSpriteName = "Thought Timer Empty";
    [SerializeField] private Color m_ThinkTimeColor = Color.green;
    [SerializeField] private string m_TimeBankSpriteName = "Timer bank Full";
    [SerializeField] private string m_TimeBankFrameSpriteName = "Timer bank Empty";
    [SerializeField] private Color m_TimeBankColor = Color.red;

    [SerializeField] private CardUI[] m_Cards;
    [SerializeField] private GameObject m_WinnerObj;
    [SerializeField] private UILabel m_LabelWon;

    private List<Coroutine> m_TimerCoroutines = new List<Coroutine>();
    private bool m_ShowInBB;
    private bool m_FourColorDeck;
    private float m_bigBlind;
    private float m_Money;
    private float m_bet;
    private float m_prize;
    private bool m_showDollarSign;

    private bool m_showFoldCards;

    private void OnEnable()
    {
        ClearCards();
        ClearTurnTimer();
        ClearWinner();
    }

    public void SetPlayer(string name, Texture2D avatar, float money)
    {
        m_Money = money;
        m_LabelName.text = name;
        m_TextureIcon.mainTexture = avatar;
        m_LabelMoney.text = m_ShowInBB ? $"{(int)(money / m_bigBlind * 100) / 100f}BB" : m_showDollarSign ? $"${(int)(money * 100) / 100f}" : $"{(int)(money * 100) / 100f}";
    }

    public void SetStandby(bool standby)
    {
        m_StandbyMask.SetActive(standby);
    }

    public void ClearAction()
    {
        m_SpriteAction.gameObject.SetActive(false);
    }

    public void ShowAction(string action, float bet)
    {
        if (action != null)
        {
            m_SpriteAction.gameObject.SetActive(true);
            m_bet = bet;
            m_BetLabel.text = bet > 0 ? (m_ShowInBB ? $"{(int)(bet / m_bigBlind * 100) / 100f}BB" : m_showDollarSign ? $"${bet:N0}" : $"{bet:N0}") : string.Empty;
            switch (action)
            {
                case "fold": m_SpriteAction.spriteName = m_ActionFoldSpriteName; break;
                case "sb": m_SpriteAction.spriteName = m_ActionSmallBlindSpriteName; break;
                case "bb": m_SpriteAction.spriteName = m_ActionBigBlindSpriteName; break;
                case "check": m_SpriteAction.spriteName = m_ActionCheckSpriteName; break;
                case "call": m_SpriteAction.spriteName = m_ActionCallSpriteName; break;
                case "raise": m_SpriteAction.spriteName = m_ActionRaiseSpriteName; break;
                case "allin": m_SpriteAction.spriteName = m_ActionAllInSpriteName; break;
            }
        }
        else
        {
            m_SpriteAction.gameObject.SetActive(false);
        }
    }

    private string changeFor4Deck(string card)
    {
        var str = card;

        if (!m_FourColorDeck || card == "?") 
            return str;

        Debug.Log(str);
        char[] charArray = str.ToCharArray();
        char c = charArray[1];
        if(c == 'C') 
        {
            str += "_green";
        }
        else if (c == 'D') 
        {
            str += "_blue";
        }

        return str;
    }
    public void ShowCards(string[] cards)
    {
        for (int i = 0; i < cards.Length; ++i)
        {
            var card = changeFor4Deck(cards[i]);
            
            m_Cards[i].gameObject.SetActive(true);
            m_Cards[i].SetShade(false);
            m_Cards[i].SetCard(card);
            m_Cards[i].initCard(true);
        }
    }

    public void ClearCards()
    {
        for (int i = 0; i < m_Cards.Length; ++i)
        {
            m_Cards[i].gameObject.SetActive(false);
            m_Cards[i].resetCard();
        }
    }

    public void HighlightCards(string[] cards = null)
    {
        var set = new HashSet<string>();
        if (cards != null)
            set.UnionWith(cards);

        for (int i = 0; i < m_Cards.Length; ++i)
        {
            var ui = m_Cards[i];
            ui.SetShade(ui.card == null || !set.Contains(ui.card));
        }
    }
    
    public void SetTurnTimer(float timeout, float timeToReact, float timeBank)
    {
        ClearTurnTimer();

        m_TimerObj.SetActive(true);
        m_TimerCoroutines.Add(StartCoroutine(DoTimer(timeout, timeToReact, timeBank)));
    }

    private IEnumerator DoTimer(float timeout, float timeToReact, float timeBank)
    {
        //                              .-- current (Time.time)                     .-- endTime
        //                              |<--------------- timeout ----------------->|
        // ----+----------------------------------+---------------------------------+---------------
        //     |<- timeToReact (fixed in table) ->|<- timeBank (variable in seat) ->|
        //
        var endTime = Time.time + timeout;
        var timeBankTimerStartTime = endTime - timeBank;
        var reactTimerStartTime = timeBankTimerStartTime - timeToReact;

        m_LabelTimeBank.gameObject.SetActive(true);
        m_LabelTimeBank.text = TimeSpan.FromSeconds(timeBank).ToString(@"mm\:ss");

        var reactTimer = StartCoroutine(DoTimer(reactTimerStartTime, timeBankTimerStartTime, m_ThinkTimeSpriteName, m_ThinkTimeFrameSpriteName, m_ThinkTimeColor));
        m_TimerCoroutines.Add(reactTimer);
        yield return reactTimer;

        m_LabelTimeBank.gameObject.SetActive(false);

        var timeBankTimer = StartCoroutine(DoTimer(timeBankTimerStartTime, endTime, m_TimeBankSpriteName, m_TimeBankFrameSpriteName, m_TimeBankColor));
        m_TimerCoroutines.Add(timeBankTimer);
        yield return timeBankTimer;

        ClearTurnTimer();
    }

    private IEnumerator DoTimer(float startTime, float endTime, string spriteName, string frameSpriteName, Color timeLabelColor)
    {
        m_SpriteTime.spriteName = spriteName;
        m_SpriteTimeFrame.spriteName = frameSpriteName;
        m_LabelTime.color = timeLabelColor;
        while (Time.time < endTime)
        {
            m_SpriteTime.fillAmount = Mathf.InverseLerp(endTime, startTime, Time.time);
            var timeLeft = endTime - Time.time;
            m_LabelTime.text = TimeSpan.FromSeconds(timeLeft).ToString(@"mm\:ss");
            yield return null;
        }
    }

    public void ClearTurnTimer()
    {
        m_TimerObj.SetActive(false);
        foreach (var c in m_TimerCoroutines.Where(c => c != null))
            StopCoroutine(c);
        m_TimerCoroutines.Clear();
    }

    public Coroutine ShowWinner(float prize)
    {
        return StartCoroutine(DoShowWinner(prize));
    }

    private IEnumerator DoShowWinner(float prize)
    {

        m_prize = prize;
        m_LabelWon.text = m_ShowInBB ? $"{(int)(prize / m_bigBlind * 100) / 100f}BB" : m_showDollarSign ? $"${(int)(prize * 100) / 100f}" : $"{(int)(prize * 100) / 100f}";
        
        m_LabelWon.gameObject.SetActive(true);

        m_WinnerObj.SetActive(true);

        m_LabelWon.transform.localScale = Vector3.zero;
        TweenScale.Begin(m_LabelWon.gameObject, .2f, Vector3.one);
        yield return new WaitForSeconds(1.5f);
        TweenScale.Begin(m_LabelWon.gameObject, .2f, Vector3.zero);
        yield return new WaitForSeconds(0.3f);

        ClearWinner();
    }

    public void ClearWinner()
    {
        m_LabelWon.gameObject.SetActive(false);
        m_WinnerObj.SetActive(false);
    }

    public void setOptionShowInBB(bool value, float bb)
    {
        m_ShowInBB = value;
        m_bigBlind = bb;

        m_LabelMoney.text = m_ShowInBB ? $"{(int)(m_Money / m_bigBlind * 100) / 100f}BB" : m_showDollarSign ? $"${(int)(m_Money * 100) / 100f}" : $"{(int)(m_Money * 100) / 100f}";
        m_BetLabel.text = m_bet > 0 ? (m_ShowInBB ? $"{(int)(m_bet / m_bigBlind * 100) / 100f}BB" : m_showDollarSign ? $"${m_bet:N0}" : $"{m_bet:N0}") : string.Empty;
        m_LabelWon.text = m_ShowInBB ? $"{(int)(m_prize / m_bigBlind * 100) / 100f}BB" : m_showDollarSign ? $"${(int)(m_prize * 100) / 100f}" : $"{(int)(m_prize * 100) / 100f}";
    }
    public void setOptionFourDeck(bool value)
    {
        m_FourColorDeck = value;
    }

    public void setShowDollarSign(bool value)
    {
        m_showDollarSign = value;
    }

    public void setShowFoldCard(bool value)
    {
        m_showFoldCards = value;
    }
    
    public void OnMouseDown()
    {
        if(m_showFoldCards) 
        {
            for (int i = 0; i < m_Cards.Length; ++i)
            {
                var ui = m_Cards[i];
                ui.gameObject.SetActive(true);
                ui.SetShade(true);
            }
        }
    }

    public void OnMouseUp() 
    {
        if(m_showFoldCards)
        {
            for (int i = 0; i < m_Cards.Length; ++i)
            {
                var ui = m_Cards[i];
                ui.gameObject.SetActive(false);
                ui.SetShade(false);
            }
        }
    }
}