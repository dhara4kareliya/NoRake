using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class LevelTimer : MonoBehaviour
{
    public float timeRemaining = 60;
    public bool timerIsRunning = false;
    [SerializeField] private UILabel timeText;

    private void Start()
    {
        timerIsRunning = false;
    }

    void Update()
    {
        if (timerIsRunning)
        {
            if (timeRemaining > 0)
            {
                timeRemaining -= Time.deltaTime;
                DisplayTime(timeRemaining);
            }
            else
            {
                timeRemaining = 0;
                timerIsRunning = false;
            }
        }
    }

    void DisplayTime(float timeToDisplay)
    {
        timeToDisplay += 1;
        float hours = Mathf.FloorToInt(timeToDisplay / 3600);
        float tmpSeconds = Mathf.FloorToInt(timeToDisplay % 3600);
        float minutes = Mathf.FloorToInt(tmpSeconds / 60); 
        float seconds = Mathf.FloorToInt(tmpSeconds % 60);

        timeText.text = string.Format("{0:0}:{1:00}:{2:00}", hours, minutes, seconds);
    }
}