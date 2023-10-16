using System;
using System.Collections.Generic;
using UnityEngine;

using BestHTTP.SocketIO;
using System.Linq;
using BestHTTP;
using LitJson;

public class TableServerException : ApplicationException
{
    public TableServerException(string message) : base(message) { }
}

public class TableServer : MonoBehaviour
{
    private string m_Address;
    public string address => m_Address;
    private string m_Token;   
    public string token => m_Token;
    private string m_Type;
    public string type => m_Type;
    private SocketManager m_SocketManager = null;

    public Action onConnect;
    public Action onDisconnect;

    public Action<IReadOnlyDictionary<string, object>> onPlayerLeave;

    public class PlayerInfo
    {
        public string name { get; set; }
        public string avatar { get; set; }
        public float cash { get; set; }
        public float chips { get; set; }

        public override string ToString() => $"PlayerInfo (name: {name}, avatar: {avatar}, cash: {cash}), chips: {chips})";
    }

    public PlayerInfo myInfo { get; } = new PlayerInfo();

    public Action<PlayerInfo> onPlayerInfo;

    public enum PlayerState
    {
        None,
        Leaving,
        Joining,
        SitOut,
        Waiting,
        Playing,
    }

    public PlayerState playerState { get; private set; }
    public Action<PlayerState> onPlayerState;

    public class TableSettings
    {
        public string name { get; set; }
        public int numberOfSeats { get; set; }
        public string mode { get; set; }
        public int level { get; set; }
        public float nextSB {get; set;}
        public float nextBB {get; set;}
        public int duration {get; set;}
        public float smallBlind { get; set; }
        public float bigBlind { get; set; }
        public float ante { get; set; }
        public float minBuyIn { get; set; }
        public float maxBuyIn { get; set; }

        public override string ToString() =>
            $"TableSettings (name: {name}, numberOfSeats: {numberOfSeats}, " +
            $"level: {level}, smallBlind: {smallBlind}, bigBlind: {bigBlind}, ante: {ante}" +
            $"minBuyIn: {minBuyIn}, maxBuyIn: {maxBuyIn})";
    }

    public TableSettings tableSettings { get; } = new TableSettings();

    public Action<TableSettings> onTableSettings;

    public int numberOfSeats => tableSettings.numberOfSeats;
    public float smallBlind => tableSettings.smallBlind;
    public float bigBlind => tableSettings.bigBlind;

    public int playerSeat { get; private set; } = -1;
    public float playerMoney => (playerSeat >= 0) ? round.seats[playerSeat].money : 0;
    public float playerTotalMoney => (playerSeat >= 0) ? round.seats[playerSeat].totalMoney : 0;

    public enum SeatState
    {
        Empty,
        Joining,
        SitOut,
        Waiting,
        Playing,
    }

    public class Seat
    {
        public SeatState state { get; set; }

        public PlayerInfo player { get; set; }

        public float money { get; set; }
        public float pendingMoney { get; set; }
        public float totalMoney => money + pendingMoney;

        public int play { get; set; }

        public string[] cards { get; set; }
        public bool fold { get; set; }
        public float bet { get; set; }
        public string action { get; set; }
        public string lastAction { get; set; }
        public float lastBet { get; set; }

        public bool missingBB { get; set; }
        public bool missingSB { get; set; }
        public float sum { get; set; }

        public override string ToString()
        {
            var playerState = state == SeatState.Empty ? string.Empty : $"({player.name}, ${totalMoney})";
            return $"{state}{playerState}";
        }
    }

    public enum RoundState
    {
        None,
        HoleCards,
        Flop,
        Turn,
        River,
        Showdown,
        End,
    }

    public class TableStatus
    {
        public bool breakTime { get; set; }
        public bool paused { get; set; }
        public int round { get; set; }
        public RoundState state { get; set; }
        public string[] cards { get; set; }
        public int seatOfDealer { get; set; }
        public int seatOfSmallBlind { get; set; }
        public int seatOfBigBlind { get; set; }
        public float pot { get; set; }
        public int turn { get; set; }

        public Seat[] seats { get; set; }

        public override string ToString() => $"{round}, {state}, d={seatOfDealer}, sb={seatOfSmallBlind}, bb={seatOfBigBlind}, turn={turn}, bet={pot}";
    }

    public TableStatus round { get; } = new TableStatus();

    public Action<TableStatus> onTableStatus;

    public class Pot
    {
        public float amount { get; set; }
        public int[] seats { get; set; }
    }

    public Action<Pot[]> onSidePots;

    public class Turn
    {
        public int seat { get; set; } = -1;
        public float pot { get; internal set; }
        public float call { get; set; }
        public bool canCheck => call == 0;
        public bool canCall => call > 0;
        public bool canRaise { get; set; }
        public float minRaise { get; set; }
        public float maxRaise { get; set; }
        public float timeout { get; set; }
        public float timeToReact { get; set; }
        public float timeBank { get; set; }

        public override string ToString() => $"{seat}, call={call}";
    }

    public Turn turn { get; } = new Turn();
    public Action<Turn> onRoundTurn;

    public enum HandRank
    {
        None, // 0
        HighCard, // 1
        Pair, // 2
        TwoPair, // 3
        ThreeOfAKind, // 4
        Straight, // 5
        Flush, // 6
        FullHouse, // 7
        FourOfAKind, // 8
        StraightFlush, // 9
    }

    public class PlayerResult
    {
        public int seat { get; set; }
        public bool fold { get; set; }
        public float bet { get; set; }
        public float prize { get; set; }
        public string[] handCards { get; set; }
        public HandRank handRank { get; set; }
        public override string ToString() => $"{seat}: fold:{fold}, bet:{bet}, prize:{prize}";
    }

    public class PotResult
    {
        public float amount { get; set; }
        public float prize { get; set; }
        public int[] winners { get; set; }

        public override string ToString() => $"amount:{amount}, prize:{prize}, winners:{string.Join(",", winners)}";
    }

    public class RoundResult
    {
        public PlayerResult[] players { get; set; }
        public PlayerResult[] lastPlayers => players.Where(player => !player.fold).ToArray();
        public PlayerResult[] winners => players.Where(player => player.prize > 0).ToArray();

        public PotResult[] pots { get; set; }
    }

    public Action<RoundResult> onRoundResult;

    public class SeatShowCards
    {
        public int seat { get; set; }
        public string[] cards { get; set; }

        public override string ToString() => $"{seat}, cards={string.Join(",", cards)}";
    }

    public Action<SeatShowCards> onShowCards;

    private void OnDestroy()
    {
        Disconnect();
    }

    public void SetServer(string address, string token, string type)
    {
        m_Address = address;
        m_Token = token;
        m_Type = type;
    }

    public void Disconnect()
    {
        m_SocketManager?.Close();
        m_SocketManager = null;
    }

    public void Connect()
    {
        Disconnect();

        var uri = new Uri(new Uri(m_Address), "/socket.io/");

        Debug.Log($"Connecting to server: {uri}");

        var options = new SocketOptions()
        {
            ServerVersion = SupportedSocketIOVersions.v3
        };

        m_SocketManager = new SocketManager(uri, options);

        m_SocketManager.Socket.On(SocketIOEventTypes.Connect, OnConnect);
        m_SocketManager.Socket.On(SocketIOEventTypes.Disconnect, OnDisconnect);
        m_SocketManager.Socket.On<Error>(SocketIOEventTypes.Error, Debug.LogError);

        m_SocketManager.Socket.On<IReadOnlyDictionary<string, object>>("REQ_PLAYER_LEAVE", OnPlayerLeave);
        m_SocketManager.Socket.On<IReadOnlyDictionary<string, object>>("REQ_PLAYER_INFO", OnPlayerInfo);
        m_SocketManager.Socket.On<IReadOnlyDictionary<string, object>>("REQ_TABLE_SETTINGS", OnTableSettings);
        m_SocketManager.Socket.On<IReadOnlyDictionary<string, object>>("REQ_PLAYER_STATE", OnPlayerState);
        m_SocketManager.Socket.On<IReadOnlyDictionary<string, object>>("REQ_TABLE_STATUS", OnTableStatus);
        m_SocketManager.Socket.On<IReadOnlyList<object>>("REQ_TABLE_SIDEPOTS", OnTableSidePots);
        m_SocketManager.Socket.On<IReadOnlyDictionary<string, object>>("REQ_TABLE_TURN", OnTableTurn);
        m_SocketManager.Socket.On<IReadOnlyDictionary<string, object>>("REQ_TABLE_ROUNDRESULT", OnTableRoundResult);
        m_SocketManager.Socket.On<IReadOnlyDictionary<string, object>>("REQ_TABLE_PLAYERSHOWCARDS", OnTablePlayerShowCards);
    }

    private void OnConnect()
    {
        Debug.Log($"Connected to the server: id:{m_SocketManager.Socket.Id}");
        onConnect?.Invoke();
    }

    private void OnDisconnect()
    {
        Debug.LogWarning("Disconnected from the server");
        onDisconnect?.Invoke();
    }

    private bool CheckConnection(Promise<bool> promise = null)
    {
        if (m_SocketManager == null)
        {
            promise?.Reject(new TableServerException("Table server not connected"));
            return false;
        }
        return true;
    }

    public void Join(string token, Promise<bool> promise = null)
    {
        Debug.Log($"Join. token: {token}");

        if (!CheckConnection(promise))
            return;

        playerState = PlayerState.None;

        m_SocketManager.Socket.Emit("REQ_PLAYER_ENTER", (s, p, a) => promise?.Resolve(Convert.ToBoolean(a[0])), new Dictionary<string, object>()
        {
            ["user_token"] = token,
            ["table_token"] = m_Token,
        });
    }

    public void UpdatePlayerInfo(Promise<bool> promise = null)
    {
        if (!CheckConnection(promise))
            return;

        m_SocketManager.Socket.Emit("REQ_PLAYER_INFO", (s, p, a) => promise?.Resolve(Convert.ToBoolean(a[0])));
    }

    private void OnPlayerInfo(IReadOnlyDictionary<string, object> info)
    {
        myInfo.name = info.GetString("name");
        myInfo.avatar = info.GetString("avatar");
        myInfo.cash = info.GetSingle("cash");

        Debug.Log($"OnPlayerInfo. info: {myInfo}");

        onPlayerInfo?.Invoke(myInfo);
    }

    private void OnPlayerState(IReadOnlyDictionary<string, object> state)
    {
        playerState = (PlayerState)Enum.Parse(typeof(PlayerState), state.GetString("state"));

        Debug.Log($"OnPlayerState. state: {playerState}");

        onPlayerState?.Invoke(playerState);
    }

    private void OnTableSettings(IReadOnlyDictionary<string, object> settings)
    {
        tableSettings.name = settings.GetString("name");
        tableSettings.mode = settings.GetString("mode");
        tableSettings.numberOfSeats = settings.GetInt32("numberOfSeats");
        tableSettings.level = settings.GetInt32("level");
        tableSettings.duration = settings.GetInt32("duration");
        tableSettings.nextSB = settings.GetSingle("nextSB");
        tableSettings.nextBB = settings.GetSingle("nextBB");
        tableSettings.smallBlind = settings.GetSingle("smallBlind");
        tableSettings.bigBlind = settings.GetSingle("bigBlind");
        tableSettings.ante = settings.GetSingle("ante");
        tableSettings.minBuyIn = settings.GetInt32("minBuyIn");
        tableSettings.maxBuyIn = settings.GetInt32("maxBuyIn");

        Debug.Log($"OnTableSettings. settings: {tableSettings}");

        onTableSettings?.Invoke(tableSettings);
    }

    private static Seat ToTableSeat(IReadOnlyDictionary<string, object> seat)
    {
        return new Seat()
        {
            state = (SeatState)Enum.Parse(typeof(SeatState), seat.GetString("state")),
            player = ToPlayerInfo(seat.GetObject("player")),
            money = seat.GetSingle("money"),
            pendingMoney = seat.GetSingle("pendingMoney"),
            play = seat.GetInt32("play"),
            cards = seat.GetArray<string>("cards"),
            fold = seat.GetBoolean("fold"),
            bet = seat.GetSingle("bet"),
            action = seat.GetString("action"),
            lastAction = seat.GetString("lastAction"),
            lastBet = seat.GetSingle("lastBet"),
            missingBB = seat.GetBoolean("missingBB"),
            missingSB = seat.GetBoolean("missingSB"),
            sum = seat.GetSingle("sum"),
        };
    }

    private static PlayerInfo ToPlayerInfo(IReadOnlyDictionary<string, object> playerInfo)
    {
        return playerInfo == null ? null : new PlayerInfo()
        {
            name = playerInfo.GetString("name"),
            avatar = playerInfo.GetString("avatar"),
            cash = playerInfo.GetSingle("cash"),
            chips = playerInfo.GetSingle("chips"),
        };
    }

    public void Leave()
    {
        if (!CheckConnection())
            return;

        m_SocketManager.Socket.Emit("REQ_PLAYER_LEAVE");

        playerState = PlayerState.Leaving;
        onPlayerState?.Invoke(playerState);
    }

    private void OnPlayerLeave(IReadOnlyDictionary<string, object> reason)
    {
        Debug.Log($"OnPlayerLeave");
        playerState = PlayerState.None;
        playerSeat = -1;
        onPlayerLeave?.Invoke(reason);
    }

    public void SitDown(int seatIndex, Promise<bool> promise = null)
    {
        if (!CheckConnection(promise))
            return;

        m_SocketManager.Socket.Emit("REQ_PLAYER_SITDOWN", (s, p, a) =>promise?.Resolve(Convert.ToBoolean(a[0])), new Dictionary<string, object>()
        {
            ["seat"] = seatIndex,
        });
    }

    public bool CheckCashForBuyIn() => myInfo.cash + playerTotalMoney >= tableSettings.minBuyIn;

    public void BuyIn(float amount, bool autoTopUp = false, Promise<bool> promise = null)
    {
        if (!CheckConnection(promise))
            return;

        m_SocketManager.Socket.Emit("REQ_PLAYER_BUYIN", (s, p, a) => promise?.Resolve(Convert.ToBoolean(a[0])), new Dictionary<string, object>()
        {
            ["amount"] = amount,
            ["autoTopUp"] = autoTopUp,
        });
    }

    private void OnTableStatus(IReadOnlyDictionary<string, object> status)
    {
        round.breakTime = status.GetBoolean("breakTime");
        round.paused = status.GetBoolean("paused");
        round.round = status.GetInt32("round");
        round.state = (RoundState)Enum.Parse(typeof(RoundState), status.GetString("state"));
        round.cards = status.GetArray<string>("cards");
        round.seatOfDealer = status.GetInt32("seatOfDealer", -1);
        round.seatOfSmallBlind = status.GetInt32("seatOfSmallBlind", -1);
        round.seatOfBigBlind = status.GetInt32("seatOfBigBlind", -1);
        round.pot = status.GetInt32("pot", 0);
        round.turn = status.GetInt32("turn", -1);
        round.seats = status.GetArray<IReadOnlyDictionary<string, object>>("seats").Select(ToTableSeat).ToArray();

        playerSeat = Array.FindIndex(round.seats, seat => seat.player?.name == myInfo.name);

        Debug.Log($"OnTableRoundStatus. round: {round.round}, state: {round.state}");
        var players = round.seats.Select(seat => $"{seat.state}({seat.player?.name ?? string.Empty})").ToArray();
        Debug.Log($"seats: [{string.Join(",", players)}], player seat: {playerSeat}");

        onTableStatus?.Invoke(round);
    }

    private void OnTableSidePots(IReadOnlyList<object> res)
    {
        var pots = res.Cast<IReadOnlyDictionary<string, object>>().Select(pot => new Pot()
        {
            amount = pot.GetSingle("amount"),
            seats = pot.GetArray("seats").Select(seat => Convert.ToInt32(seat)).ToArray(),
        }).ToArray();

        Debug.Log($"OnTableSidePots.");
        foreach (var pot in pots)
            Debug.Log($"POT: amount: {pot.amount}, seats: {string.Join(",", pot.seats)}");

        onSidePots?.Invoke(pots);
    }

    private void OnTableTurn(IReadOnlyDictionary<string, object> res)
    {
        turn.pot = res.GetSingle("pot");
        turn.seat = res.GetInt32("seat", -1);

        if (turn.seat >= 0)
        {
            turn.call = res.GetSingle("call");
            turn.canRaise = res.GetBoolean("canRaise");
            if (turn.canRaise)
            {
                var raise = res.GetArray("raise");
                turn.minRaise = Convert.ToSingle(raise[0]);
                if (m_Type == "plo")
                    turn.maxRaise = turn.pot;
                else
                    turn.maxRaise = Convert.ToSingle(raise[1]);
            }
            else
            {
                turn.minRaise = turn.maxRaise = 0;
            }
            var time = res.GetArray("time");
            turn.timeout = Convert.ToSingle(time[0]);
            turn.timeToReact = Convert.ToSingle(time[1]);
            turn.timeBank = Convert.ToSingle(time[2]);
        }
        else
        {
            turn.call = 0;
            turn.canRaise = false;
            turn.minRaise = turn.maxRaise = 0;
            turn.timeout = turn.timeToReact = turn.timeBank = 0;
        }

        Debug.Log($"OnTableTurn. seat: {turn.seat}, call: {turn.call}");

        onRoundTurn?.Invoke(turn);
    }

    public void TurnAction(string action, float bet = 0, Promise<bool> promise = null)
    {
        if (!CheckConnection(promise))
            return;

        m_SocketManager.Socket.Emit("REQ_PLAYER_ACTION", (s, p, a) => promise?.Resolve(Convert.ToBoolean(a[0])), new Dictionary<string, object>()
        {
            ["action"] = action,
            ["bet"] = bet,
        });
    }

    private void OnTableRoundResult(IReadOnlyDictionary<string, object> res)
    {
        var players = res.GetArray<IReadOnlyDictionary<string, object>>("players")
            .Select(w => new PlayerResult()
            {
                seat = w.GetInt32("seat"),
                fold = w.GetBoolean("fold"),
                bet = w.GetSingle("bet"),
                prize = w.GetSingle("prize"),
                handCards = w.GetObject("hand").GetArray<string>("cards"),
                handRank = (HandRank)Enum.Parse(typeof(HandRank), w.GetObject("hand").GetString("rank", "None")),
            })
            .ToArray();

        var pots = res.GetArray<IReadOnlyDictionary<string, object>>("pots").Select(pot => new PotResult()
        {
            amount = pot.GetSingle("amount"),
            prize = pot.GetSingle("prize"),
            winners = pot.GetArray("winners").Select(seat => Convert.ToInt32(seat)).ToArray(),
        }).ToArray();

        var result = new RoundResult()
        {
            players = players,
            pots = pots,
        };

        Debug.Log($"OnTableEndRound: winners: {string.Join(",", players.Select(winner => $"seat: {winner.seat}, prize: {winner.prize}"))}");

        onRoundResult?.Invoke(result);
    }

    public void ShowCards()
    {
        if (!CheckConnection())
            return;

        m_SocketManager.Socket.Emit("REQ_PLAYER_SHOWCARDS");
    }

    private void OnTablePlayerShowCards(IReadOnlyDictionary<string, object> res)
    {
        var showCards = new SeatShowCards()
        {
            seat = res.GetInt32("seat"),
            cards = res.GetArray<string>("cards"),
        };

        Debug.Log($"OnTablePlayerShowCards: seat: {showCards}, cards:{string.Join(",", showCards.cards)}");

        onShowCards?.Invoke(showCards);
    }

    public void WaitForBB(bool value = true, Promise<bool> promise = null)
    {
        if (!CheckConnection(promise))
            return;

        m_SocketManager.Socket.Emit("REQ_PLAYER_WAITFORBB", (s, p, a) => promise?.Resolve(Convert.ToBoolean(a[0])), new Dictionary<string, object>()
        {
            ["value"] = value,
        });
    }

    public void SitOutNextHand(bool value = true, Promise<bool> promise = null)
    {
        if (!CheckConnection(promise))
            return;

        m_SocketManager.Socket.Emit("REQ_PLAYER_SITOUTNEXTHAND", (s, p, a) => promise?.Resolve(Convert.ToBoolean(a[0])), new Dictionary<string, object>()
        {
            ["value"] = value,
        });
    }

    public void SitOut(Promise<bool> promise = null)
    {
        if (!CheckConnection(promise))
            return;

        m_SocketManager.Socket.Emit("REQ_PLAYER_SITOUT", (s, p, a) => promise?.Resolve(Convert.ToBoolean(a[0])));
    }

    public void SitIn(Promise<bool> promise = null)
    {
        if (!CheckConnection(promise))
            return;

        m_SocketManager.Socket.Emit("REQ_PLAYER_SITIN", (s, p, a) => promise?.Resolve(Convert.ToBoolean(a[0])));
    }


    private class Response
    {
        public string error;
    }

    public class Options
    {
        public string avatarServer { get; set; }
    }

    public void GetOptions(Promise<Options> promise = null)
    {
        var uri = new Uri(new Uri(m_Address), "/api/options");
        var request = new HTTPRequest(uri, (req, res) => OnGetOptionsResult(req, res, promise));
        request.Send();
    }

    private void OnGetOptionsResult(HTTPRequest request, HTTPResponse response, Promise<Options> promise)
    {
        if (request.State == HTTPRequestStates.Finished && request.Response.IsSuccess)
        {
            var json = request.Response.DataAsText;
            var res = JsonMapper.ToObject<Response>(json);

            if (res.error == null)
            {
                promise?.Resolve(JsonMapper.ToObject<Options>(json));
            }
            else
            {
                promise?.Reject(new TableServerException(res.error));
            }
        }
        else
        {
            promise?.Reject(new TableServerException($"Failed to connect to game server. request state: {request.State}"));
        }
    }
}
