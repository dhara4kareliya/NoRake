using System;
using UnityEngine;

public class BuyInUI : MonoBehaviour
{
    [SerializeField] private UILabel m_TableNameLabel;
    [SerializeField] private UILabel m_TableStakesLabel;
    [SerializeField] private UILabel m_CashLabel;
    [SerializeField] private UILabel m_MoneyLabel;
    [SerializeField] private UILabel m_TableMinBuyInLabel;
    [SerializeField] private UILabel m_TableMaxBuyInLabel;
    [SerializeField] private UIInput m_BuyInInput;

    [SerializeField] private UILabel m_MinAllowedBuyInLabel;
    [SerializeField] private UILabel m_MaxAllowedBuyInLabel;

    [SerializeField] private UISlider m_BuyInSlider;
    [SerializeField] private UIToggle m_AutoTopUp;

    public float buyIn { get; private set; }
    public bool autoTopUp { get; private set; }

    public Action onOK;
    public Action onCancel;
    public Action onCashier;

    private float m_SmallBlind, m_BigBlind;
    private float m_MinBuyIn, m_MaxBuyIn, m_Cash, m_TableMoney;
    private float minBuyIn => m_MinBuyIn;
    private float maxBuyIn => m_MaxBuyIn > 0 ? Mathf.Min(m_MaxBuyIn, m_Cash) : m_Cash;
    private float minAllowedBuyIn => m_TableMoney < m_BigBlind ? Mathf.Max(0, minBuyIn - m_TableMoney) : 0;
    private float maxAllowedBuyIn => Mathf.Max(0, maxBuyIn - m_TableMoney);

    public void SetTableName(string tableName)
    {
        m_TableNameLabel.text = tableName;
    }

    public void SetBlinds(float smallBlind, float bigBlind)
    {
        m_SmallBlind = smallBlind;
        m_BigBlind = bigBlind;
        m_TableStakesLabel.text = $"${smallBlind:N0}/${bigBlind:N0}";
    }

    public void SetCash(float cash)
    {
        m_Cash = cash;
        m_CashLabel.text = $"${cash:N0}";
    }

    public void SetMoney(float money)
    {
        m_TableMoney = money;
        m_MoneyLabel.text = $"${money:N0}";
    }

    public void SetBuyInRange(float minBuyIn, float maxBuyIn)
    {
        m_MinBuyIn = minBuyIn;
        m_MaxBuyIn = maxBuyIn;
    }

    private void OnEnable()
    {
        m_TableMinBuyInLabel.text = $"${minBuyIn:N0}";
        m_TableMaxBuyInLabel.text = $"${maxBuyIn:N0}";
        m_MinAllowedBuyInLabel.text = $"${minAllowedBuyIn:N0}";
        m_MaxAllowedBuyInLabel.text = $"${maxAllowedBuyIn:N0}";

        m_BuyInInput.submitOnUnselect = true;
        EventDelegate.Add(m_BuyInInput.onSubmit, OnBuyInSubmit);
        EventDelegate.Add(m_BuyInSlider.onChange, OnBuyInSliderValueChange);

        m_BuyInSlider.value = 0;
        OnBuyInSliderValueChange();

        m_AutoTopUp.value = false;
        OnAutoTopUp(m_AutoTopUp);
    }

    private void OnDisable()
    {
        EventDelegate.Remove(m_BuyInInput.onSubmit, OnBuyInSubmit);
        EventDelegate.Remove(m_BuyInSlider.onChange, OnBuyInSliderValueChange);
    }

    private void OnBuyInSubmit()
    {
        var buyIn = Convert.ToSingle(m_BuyInInput.value);
        UpdateBuyIn(buyIn);
    }

    private void OnBuyInSliderValueChange()
    {
        var buyIn = (int)Mathf.Lerp(minAllowedBuyIn, maxAllowedBuyIn, m_BuyInSlider.value);
        UpdateBuyIn(buyIn);
    }

    private void UpdateBuyIn(float buyIn)
    {
        var t = Mathf.InverseLerp(minAllowedBuyIn, maxAllowedBuyIn, buyIn);
        m_BuyInSlider.value = t;

        this.buyIn = (int)Mathf.Lerp(minAllowedBuyIn, maxAllowedBuyIn, t);
        m_BuyInInput.value = $"{this.buyIn:N0}";
    }

    public void OnAutoTopUp(UIToggle check)
    {
        autoTopUp = check.value;
    }

    public void OnOK()
    {
        onOK?.Invoke();
    }

    public void OnCancel()
    {
        onCancel?.Invoke();
    }

    public void OnCashier()
    {
        onCashier?.Invoke();
    }
}
