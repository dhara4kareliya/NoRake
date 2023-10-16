using System;
using UnityEngine;


public class ViewMenuUI : MonoBehaviour
{
    public bool bbView { get; private set; }
    public bool fourColorDeck { get; private set; }
    public Action onBack;
    public Action<bool> onOptionShowInBB;
    public Action<bool> onOptionFourDeck;

    public UnityEngine.UI.Toggle fourColorToggle;
    public UnityEngine.UI.Toggle bbViewToggle;

    public void OnBBView()
    {
        bbView = bbViewToggle.isOn;
        onOptionShowInBB?.Invoke(bbView);
    }
    
    public void OnFourColorDeck()
    {
        fourColorDeck = fourColorToggle.isOn;
        onOptionFourDeck?.Invoke(fourColorDeck);
    }

    public void OnBack()
    {
        onBack?.Invoke();
    }

    void Start()
    {
        
    }

    void Update()
    {
        
    }

}
