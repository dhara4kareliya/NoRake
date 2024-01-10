using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class CardUI : MonoBehaviour
{
    [SerializeField] private UISprite m_Sprite;
    [SerializeField] private string m_BackSpriteName = "Card Back";
    [SerializeField] private Color m_NormalColor = Color.white;
    [SerializeField] private Color m_ShadeColor = new Color(.5f, .5f, .5f);

    private bool m_canClick = false;
    private int m_InitialDepth;
    private bool m_IsPopup;
    private string m_Card;
    public string card => m_Card;

    public void initCard(bool canClick)
    {
        if (m_canClick) return;

        m_InitialDepth = m_Sprite.depth;
        m_IsPopup = false;
        m_canClick = canClick;
    }

    public void resetCard()
    {
        if (!m_canClick)
            return;

        m_Sprite.depth = m_InitialDepth;
    }

    public void SetCard(string card = null)
    {
        m_Card = card;
        m_Sprite.spriteName = card == "?" ? m_BackSpriteName : card;
    }

    public void SetShade(bool shade)
    {
        m_Sprite.color = shade ? m_ShadeColor : m_NormalColor;
    }

    public void OnMouseDown()
    {

        if (!m_IsPopup)
            m_Sprite.depth = 15;
        else
            m_Sprite.depth = m_InitialDepth;
        m_IsPopup = !m_IsPopup;

    }
}
