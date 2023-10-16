using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using System;
using System.Linq;

public class TableUI : MonoBehaviour
{
    [SerializeField] private SeatUI[] m_Seats;
    [SerializeField] private CardUI[] m_Cards;
    [SerializeField] private UILabel m_TotalPotLabel;
    [SerializeField] private UILabel[] m_SidePotLabels;

    public enum Mode
    {
        None, Joining, Playing,
    }

    public Action<int> onSeatClick;

    public SoundPlay m_SoundPlay;

    private int m_NumberOfSeats = 1;
    private int m_FirstSeat = 0;
    private Mode m_Mode = Mode.None;
    private AvatarServer m_AvatarManager;
    private bool m_ShowInBB;
    private float m_bigBlind;
    private bool m_FourColorDeck;
    private bool m_showDollarSign;

    private void Start()
    {
        m_AvatarManager = FindObjectOfType<AvatarServer>();
        m_SoundPlay = FindObjectOfType<SoundPlay>();

        foreach (var seat in m_Seats)
        {
            seat.onClick += () => OnSeatClick(seat);
        }
    }

    private void OnSeatClick(SeatUI seat)
    {
        onSeatClick?.Invoke(seat.index);
    }

    public void SetFirstSeat(int seat)
    {
        m_FirstSeat = seat;
    }

    public void SetMode(Mode mode)
    {
        m_Mode = mode;
    }

    public void SetSeats(TableServer.Seat[] seats)
    {
        m_NumberOfSeats = seats.Length;

        for (int i = 0; i < seats.Length; ++i)
        {
            var ui = m_Seats[i];
            var seat = seats[PlayerIndexToTableSeat(i)];

            if (seat.state == TableServer.SeatState.Empty)
            {
                ui.ClearPlayer();
                ui.ShowSeat(m_Mode == Mode.Joining);
            }
            else
            {
                ui.gameObject.SetActive(true);
                ui.SetPlayer();

                var player = ui.player;

                StartCoroutine(m_AvatarManager.LoadWithUrl(seat.player.avatar, (avatar) =>
                {
                    player.setOptionShowInBB(m_ShowInBB, m_bigBlind);
                    player.SetPlayer(seat.player.name, avatar, seat.money);
                }));

                player.SetStandby(seat.state != TableServer.SeatState.Playing || seat.fold);

                if (seat.state == TableServer.SeatState.Playing || seat.state == TableServer.SeatState.SitOut)
                    player.ShowAction(seat.lastAction, seat.lastAction == "allin" ? seat.bet : seat.lastBet);
                else
                    player.ClearAction();

                player.HighlightCards();
                if (seat.state == TableServer.SeatState.Playing && !seat.fold)
                    player.ShowCards(seat.cards);
                else
                    player.ClearCards();
                
                if (!seat.fold)
                    player.setShowFoldCard(false);
                else if(seat.state == TableServer.SeatState.Playing && seat.fold)
                    player.setShowFoldCard(true);
                
                if (seat.state == TableServer.SeatState.Playing)
                {
                    switch (seat.lastAction)
                    {
                        case "check": m_SoundPlay.playCheck(); break;
                        case "call": m_SoundPlay.playCall(); break;
                        case "raise": m_SoundPlay.playRaise(); break;
                    }
                }
            }

            ui.SetMissingBigBlindButton(seat.missingBB);
            ui.SetMissingSmallBlindButton(seat.missingSB);
        }
    }

    public void SetButtons(int seatOfDealer, int seatOfSmallBlind, int seatOfBigBlind)
    {
        for (int i = 0; i < m_Seats.Length; ++i)
        {
            var ui = m_Seats[i];
            var seat = PlayerIndexToTableSeat(i);

            ui.SetDealerButton(seat == seatOfDealer);
            ui.SetSmallBlindButton(seat == seatOfSmallBlind);
            ui.SetBigBlindButton(seat == seatOfBigBlind);
        }
    }

    public void ClearPots()
    {
        m_TotalPotLabel.gameObject.SetActive(false);
        foreach (var label in m_SidePotLabels)
        {
            label.gameObject.SetActive(false);
        }
    }

    public void SetSidePot(int i, float amount)
    {
        if (i < m_SidePotLabels.Length)
        {
            m_SidePotLabels[i].gameObject.SetActive(true);

            m_SidePotLabels[i].text = m_ShowInBB ? $"{(int)(amount / m_bigBlind * 100) / 100f} BB" : m_showDollarSign ? $"${amount:N0}" : $"{amount:N0}";
        }
    }

    public void SetTotalPot(float totalPot)
    {
        m_TotalPotLabel.gameObject.SetActive(true);
        m_TotalPotLabel.text = m_ShowInBB ? $"{(int)(totalPot / m_bigBlind * 100) / 100f} BB" : m_showDollarSign ? $"${totalPot:N0}" : $"{totalPot:N0}";
    }

    public void ClearTurn()
    {
        for (int i = 0; i < m_Seats.Length; ++i)
        {
            var player = m_Seats[i].player;
            if (player != null)
            {
                player.ClearTurnTimer();
            }
        }
    }

    public void SetTurn(TableServer.Turn turn)
    {
        for (int i = 0; i < m_Seats.Length; ++i)
        {
            var player = m_Seats[i].player;
            if (player != null)
            {
                var seat = PlayerIndexToTableSeat(i);
                if (seat == turn.seat)
                {
                    player.SetTurnTimer(turn.timeout, turn.timeToReact, turn.timeBank);
                }
                else
                {
                    player.ClearTurnTimer();
                }
            }
        }
    }

    private string changeFor4Deck(string card)
    {
        var str = card;

        if(!m_FourColorDeck || card == "?") 
            return str;

        char[] charArray = str.ToCharArray();
        char c = charArray[1];
        if (c == 'C') 
        {
            str += "_green";
        }
        else if (c == 'D') 
        {
            str += "_blue";
        }

        return str;
    }

    public void SetTableCards(string[] cards)
    {
        for (int i = 0; i < m_Cards.Length; ++i)
        {
            var ui = m_Cards[i];
            ui.SetShade(false);
            if (i < cards.Length)
            {
                ui.gameObject.SetActive(true);
                ui.SetCard(changeFor4Deck(cards[i]));
            }
            else
            {
                ui.gameObject.SetActive(false);
                ui.SetCard();
            }
        }
    }

    public void HighlightTableCards(string[] cards = null)
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

    public Coroutine ShowResult(TableServer.RoundResult result)
    {
        return StartCoroutine(DoShowResult(result));
    }

    private IEnumerator DoShowResult(TableServer.RoundResult result)
    {
        var playersMap = result.players.ToDictionary(p => p.seat);

        foreach (var pot in result.pots)
        {
            var winners = new HashSet<int>(pot.winners);
            for (int i = 0; i < m_Seats.Length; ++i)
            {
                var player = m_Seats[i].player;
                if (player != null)
                {
                    var seat = PlayerIndexToTableSeat(i);
                    if (winners.Contains(seat))
                    {
                        m_SoundPlay.playWinnerPot();
                        var data = playersMap[seat];

                        player.SetStandby(false);
                        player.ShowWinner(pot.prize);

                        HighlightTableCards(data.handCards);
                        player.HighlightCards(data.handCards);
                    }
                    else
                    {
                        player.SetStandby(true);
                        player.HighlightCards();
                    }
                }
            }

            yield return new WaitForSeconds(2f);

            HighlightTableCards();
        }

        for (int i = 0; i < m_Seats.Length; ++i)
        {
            var player = m_Seats[i].player;
            if (player != null)
            {
                player.SetStandby(true);
                player.HighlightCards();
            }
        }
    }

    public void ShowCards(int seat, string[] cards)
    {
        var player = m_Seats[TableSeatToPlayerIndex(seat)].player;
        if (player != null)
            player.ShowCards(cards);
    }

    private int TableSeatToPlayerIndex(int seat) => (seat - m_FirstSeat + m_NumberOfSeats) % m_NumberOfSeats;
    private int PlayerIndexToTableSeat(int index) => (m_FirstSeat + index) % m_NumberOfSeats;

    public void setOptionShowInBB(bool value, float bb)
    {
        m_ShowInBB = value;
        m_bigBlind = bb;
        for (int i = 0; i < m_Seats.Length; ++i)
        {
            var player = m_Seats[i].player;
            if (player != null)
            {
                player.setOptionShowInBB(value, bb);
            }
        }
    }

    public void setOptionFourDeck(bool value)
    {
        m_FourColorDeck = value;
        for (int i = 0; i < m_Seats.Length; ++i)
        {
            var player = m_Seats[i].player;
            if (player != null)
            {
                player.setOptionFourDeck(value);
            }
        }
    }

    public void setShowDollarSign(bool value)
    {
        m_showDollarSign = value;
        
        for (int i = 0; i < m_Seats.Length; ++i)
        {
            var player = m_Seats[i].player;
            if (player != null)
            {
                player.setShowDollarSign(value);
            }
        }
    }
    
}
