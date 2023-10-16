using System;
using System.Linq;

using UnityEngine;

using System.Collections.Generic;
using System.Collections;

public class GameUI : MonoBehaviour
{
    [SerializeField] private MainUI m_MainUI;
    [SerializeField] private TableUI m_TableUI;
    [SerializeField] private BuyInUI m_BuyInUI;
    [SerializeField] private ViewMenuUI m_ViewMenuUI;
    [SerializeField] private ActionUI m_ActionUI;
    [SerializeField] private SoundPlay m_SoundPlay;

    private TableServer m_TableServer;
    private TableServer.RoundState m_PrevRoundState;
    private int m_PrevRound;

    private void Start()
    {
        m_TableServer = FindObjectOfType<TableServer>();

        m_TableServer.onPlayerInfo += OnPlayerInfo;
        m_TableServer.onTableSettings += OnTableSettings;
        m_TableServer.onPlayerLeave += OnPlayerLeave;
        m_TableServer.onPlayerState += OnPlayerState;
        m_TableServer.onTableStatus += OnTableStatus;
        m_TableServer.onSidePots += OnSidePots;
        m_TableServer.onRoundTurn += OnRoundTurn;
        m_TableServer.onRoundResult += OnRoundResult;
        m_TableServer.onShowCards += OnShowCards;

        m_MainUI.onLeaveClick += OnLeaveClick;
        m_MainUI.onAddChipsClick += OnAddChipsClick;
        m_MainUI.onViewOptionClick += OnViewOptionClick;
        m_MainUI.onShowCardsClick += OnShowCardsClick;
        m_MainUI.onOptionWaitForBB += OnOptionWaitForBB;
        m_MainUI.onSitInClick += OnSitInClick;
        m_MainUI.onSitOutClick += OnSitOutClick;
        m_MainUI.onOptionSitOutNextHand += OnOptionSitOutNextHand;
        m_MainUI.onOptionFoldToAnyBet += OnOptionActionFoldToAnyBet;
        m_MainUI.onOptionActionAutoCheck += OnOptionActionAutoCheck;
        m_MainUI.onOptionActionAutoCheckOrFold += OnOptionActionAutoCheckOrFold;

        m_ViewMenuUI.onOptionShowInBB += OnOptionShowInBB;
        m_ViewMenuUI.onOptionFourDeck += OnOptionFourDeck;

        m_TableUI.onSeatClick += OnSeatClick;

        m_ActionUI.gameObject.SetActive(false);
        m_ActionUI.onFold += OnFoldClick;
        m_ActionUI.onBet += OnBetClick;
    }

    private void OnLeaveClick()
    {
        m_TableServer.Leave();
    }

    private void OnPlayerLeave(IReadOnlyDictionary<string, object> reason)
    {
        m_TableUI.SetMode(TableUI.Mode.None);
        m_ActionUI.gameObject.SetActive(false);
    }

    private void OnPlayerInfo(TableServer.PlayerInfo info)
    {
        m_MainUI.SetPlayerName(info.name);
    }

    private void OnTableSettings(TableServer.TableSettings settings)
    {

        if (settings.mode == "tournament")
        {
            m_MainUI.ShowLevel(true);
            m_MainUI.SetLevelInfo(settings.level, settings.duration, settings.nextSB, settings.nextBB, settings.ante);
            m_MainUI.setShowDollarSign(false);
        }
        else
        {
            m_MainUI.ShowLevel(false);
            m_MainUI.setShowDollarSign(true);
        }
        m_MainUI.SetTableName(settings.name);
        m_MainUI.SetSmallBlind(settings.smallBlind);
        m_MainUI.SetBigBlind(settings.bigBlind);
    }

    private void OnPlayerState(TableServer.PlayerState state)
    {
        switch (state)
        {
            case TableServer.PlayerState.Joining:
                m_TableUI.SetMode(TableUI.Mode.Joining);
                break;
            case TableServer.PlayerState.Waiting:
            case TableServer.PlayerState.Playing:
            case TableServer.PlayerState.SitOut:
                m_TableUI.SetMode(TableUI.Mode.Playing);
                break;
        }

        m_TableUI.ClearTurn();

        m_ActionUI.gameObject.SetActive(false);

        m_MainUI.ShowSitIn(state == TableServer.PlayerState.SitOut);

        if (m_TableServer.tableSettings.mode == "cash")
        {
            m_MainUI.ShowWaitForBB(state == TableServer.PlayerState.Waiting);
            m_MainUI.SetWaitForBB(true);

            m_MainUI.ShowSitOutNextHand(state == TableServer.PlayerState.Playing);
            m_MainUI.SetSitOutNextHand(false);

            if (m_TableServer.playerSeat >= 0 && state == TableServer.PlayerState.Joining)
            { // kicked out
                Debug.Log($"Insufficient money. Waiting for buy-in.");
                SyncAndBuyIn();
            }
            else
            {
                HideBuyIn();
            }

            m_ActionUI.setShowDollarSign(true);
            m_TableUI.setShowDollarSign(true);
        }
        else
        {
            m_MainUI.ShowWaitForBB(false);
            m_MainUI.SetWaitForBB(false);

            m_MainUI.ShowSitOutNextHand(false);
            m_MainUI.SetSitOutNextHand(false);

            m_ActionUI.setShowDollarSign(false);
            m_TableUI.setShowDollarSign(false);
        }
    }

    private void OnSeatClick(int seat)
    {
        SitDown(seat);
    }

    private void SitDown(int seat)
    { 
        Debug.Log($"Trying sitdown. seat: {seat}");

        var promise = new Promise<bool>();
        promise.onResolvedWithResult += (result) =>
        {
            if (promise.result)
                Debug.Log($"Success to sitdown. seat: {seat}");
            else
                Debug.LogWarning($"Failed to sitdown. seat: {seat}");
        };
        promise.onRejected += (ex) => Debug.LogError($"Failed to sitdown. seat: {seat}");
        m_TableServer.SitDown(seat, promise);
    }

    private void OnViewOptionClick()
    {
        m_ViewMenuUI.gameObject.SetActive(true);
        m_ViewMenuUI.onBack = () => 
        {
            m_ViewMenuUI.gameObject.SetActive(false);
        };
    }

    private void OnAddChipsClick()
    {
        SyncAndBuyIn();
    }

    private void SyncAndBuyIn()
    {
        var promise = new Promise<bool>();
        promise.onRejected += (ex) => Debug.LogError($"Failed to update player info.");
        promise.onResolvedWithResult += (result) =>
        {
            if (!result)
            {
                Debug.LogError($"Failed to update player info.");
                return;
            }

            BuyIn();
        };
        m_TableServer.UpdatePlayerInfo(promise);
    }

    private void BuyIn()
    { 
        if (!m_TableServer.CheckCashForBuyIn())
        {
            Debug.LogWarning($"Insufficent cash to buyin");
            return;
        }

        var tableSettings = m_TableServer.tableSettings;
        m_BuyInUI.SetTableName(tableSettings.name);
        m_BuyInUI.SetBlinds(tableSettings.smallBlind, tableSettings.bigBlind);
        m_BuyInUI.SetBuyInRange(tableSettings.minBuyIn, tableSettings.maxBuyIn);
        m_BuyInUI.SetCash(m_TableServer.myInfo.cash);
        m_BuyInUI.SetMoney(m_TableServer.playerTotalMoney);

        m_BuyInUI.gameObject.SetActive(true);

        m_BuyInUI.onCancel = () =>
        {
            m_BuyInUI.gameObject.SetActive(false);

            Debug.Log($"Buy-in cancelled.");

            if (m_TableServer.playerTotalMoney < tableSettings.minBuyIn)
            {
                Debug.Log($"Player didn't buy-in sufficient amount. Leaving now");
                m_TableServer.Leave();
            }
        };
        m_BuyInUI.onOK = () =>
        {
            m_BuyInUI.gameObject.SetActive(false);

            var buyIn = m_BuyInUI.buyIn;
            Debug.Log($"Trying buy-in. buyin: {buyIn}");

            var promise = new Promise<bool>();
            promise.onResolvedWithResult += (result) =>
            {
                if (result)
                    Debug.Log($"Success to buy-in. buyin: {buyIn}");
                else
                    Debug.LogWarning($"Failed to buy-in. buyin: {buyIn}");
            };
            promise.onRejected += (ex) => Debug.LogError($"Failed to buy-in. buyin: {buyIn}");
            m_TableServer.BuyIn(buyIn, m_BuyInUI.autoTopUp, promise);
        };
    }

    private void HideBuyIn()
    {
        m_BuyInUI.gameObject.SetActive(false);
    }

    private void OnTableStatus(TableServer.TableStatus status)
    {

        m_MainUI.SetRound(status.round);
        m_MainUI.SetRoundState(Convert.ToString(status.state));

        if (m_TableServer.tableSettings.mode == "cash" && m_TableServer.playerSeat >= 0)
        {
            m_MainUI.ShowAddChips(true);
            m_MainUI.ShowSitOut(true);
        }
        else
        {
            m_MainUI.ShowAddChips(false);
            m_MainUI.ShowSitOut(false);
        }

        if (status.state != TableServer.RoundState.Showdown)
            m_MainUI.ShowShowCards(false);

        if (status.state != m_PrevRoundState)
            m_MainUI.ResetAutoCheckOptions();

        var firstSeat = Mathf.Max(0, m_TableServer.playerSeat);
        m_TableUI.SetFirstSeat(firstSeat);
        m_TableUI.SetSeats(status.seats);
        m_TableUI.SetButtons(status.seatOfDealer, status.seatOfSmallBlind, status.seatOfBigBlind);
        m_TableUI.SetTableCards(status.cards);
        if (status.state == TableServer.RoundState.None)
            m_TableUI.ClearPots();
        m_TableUI.ClearTurn();

        m_MainUI.ShowBreakTime(status.breakTime);
        m_MainUI.ShowPause(!status.breakTime && status.paused);

        if (status.state != m_PrevRoundState)
        {
            if (status.state == TableServer.RoundState.Flop)
            {
                m_SoundPlay.playFlop();
            }
            else if (status.state == TableServer.RoundState.Turn || status.state == TableServer.RoundState.River)
            {
                m_SoundPlay.playTurnRiver();
            }
            else if (status.state == TableServer.RoundState.Showdown)
            {
                // m_SoundPlay.playEndStreet();
            }
        }

        if (status.round != m_PrevRound)
        {
            m_SoundPlay.playCardDealt();
        }

        m_PrevRoundState = status.state;
        m_PrevRound = status.round;
    }

    private void OnSidePots(TableServer.Pot[] pots)
    {
        m_TableUI.ClearPots();

        float totalPot = 0;
        int i = 0;
        foreach (var pot in pots)
        {
            m_TableUI.SetSidePot(i, pot.amount);

            totalPot += pot.amount;
            ++i;
        }

        m_TableUI.SetTotalPot(totalPot);
    }

    private void OnRoundTurn(TableServer.Turn turn)
    {
        m_TableUI.SetTurn(turn);

        if (turn.seat != -1 && turn.seat == m_TableServer.playerSeat)
        {
            if (DoFoldToAnyBet())
                return;

            if (DoAutoCheckOrFold())
                return;

            if (DoAutoCheck())
                return;

            m_ActionUI.gameObject.SetActive(true);

            m_ActionUI.ShowCall(turn.call, turn.call >= m_TableServer.playerMoney);

            if (turn.canRaise)
                m_ActionUI.ShowRaise(turn.minRaise, turn.maxRaise, turn.pot, m_TableServer.tableSettings.bigBlind);
            else
                m_ActionUI.HideRaise();
        }
        else
        {
            m_ActionUI.gameObject.SetActive(false);
        }
    }

    private void OnOptionActionFoldToAnyBet(bool check)
    {
        DoFoldToAnyBet();
    }

    private bool DoFoldToAnyBet()
    {
        if (!m_MainUI.optionFoldToAnyBet || m_TableServer.playerSeat == -1 || m_TableServer.playerSeat != m_TableServer.turn.seat)
            return false;

        OnFoldClick();
        return true;
    }

    private void OnOptionActionAutoCheck(bool check)
    {
        DoAutoCheck();
    }

    private bool DoAutoCheck()
    {
        if (!m_MainUI.optionActionAutoCheck || m_TableServer.playerSeat == -1 || m_TableServer.playerSeat != m_TableServer.turn.seat)
            return false;

        m_MainUI.ResetAutoCheckOptions();

        if (!m_TableServer.turn.canCheck)
            return false;

        OnBetClick(0);
        return true;
    }

    private void OnOptionActionAutoCheckOrFold(bool check)
    {
        DoAutoCheckOrFold();
    }

    private bool DoAutoCheckOrFold()
    {
        if (!m_MainUI.optionActionAutoCheckOrFold || m_TableServer.playerSeat == -1 || m_TableServer.playerSeat != m_TableServer.turn.seat)
            return false;

        m_MainUI.ResetAutoCheckOptions();

        if (m_TableServer.turn.canCheck)
            OnBetClick(0);
        else
            OnFoldClick();
        return true;
    }

    private void OnFoldClick()
    {
        m_TableServer.TurnAction("fold");
        m_ActionUI.gameObject.SetActive(false);
    }

    private void OnBetClick(float bet)
    {
        m_TableServer.TurnAction("bet", bet);
        m_ActionUI.gameObject.SetActive(false);
    }

    private void OnRoundResult(TableServer.RoundResult result)
    {
        m_TableUI.ShowResult(result);

        var players = result.lastPlayers;
        m_MainUI.ShowShowCards(result.players.Length > 1 && players.Length == 1 && players[0].seat == m_TableServer.playerSeat);
    }

    private void OnShowCardsClick()
    {
        m_TableServer.ShowCards();
        m_MainUI.ShowShowCards(false);
    }

    private void OnShowCards(TableServer.SeatShowCards showCards)
    {
        if (showCards.seat != m_TableServer.playerSeat) // show others only
            m_TableUI.ShowCards(showCards.seat, showCards.cards);
    }

    private void OnOptionWaitForBB(bool value)
    {
        m_TableServer.WaitForBB(value);
    }

    private void OnOptionSitOutNextHand(bool value)
    {
        m_TableServer.SitOutNextHand(value);
    }

    private void OnSitOutClick()
    {
        m_TableServer.SitOut();
    }

    private void OnSitInClick()
    {
        m_TableServer.SitIn();
    }

    private void OnOptionShowInBB(bool value)
    {
        m_ActionUI.setOptionShowInBB(value, m_TableServer.tableSettings.bigBlind);
        m_TableUI.setOptionShowInBB(value, m_TableServer.tableSettings.bigBlind);
    }

    private void OnOptionFourDeck(bool value)
    {
        m_TableUI.setOptionFourDeck(value);
    }
    
}