using System;
using UnityEngine;


public class Promise : CustomYieldInstruction
{
    private enum State
    {
        Pending,
        Resolved,
        Rejected,
    }

    private State _state = State.Pending;
    public bool pending => _state == State.Pending;
    public bool resolved => _state == State.Resolved;
    public bool rejected => _state == State.Rejected;

    private Exception _exception;
    public Exception exception => _exception;

    public override bool keepWaiting => pending;

    public Action onResolved;
    public Action<Exception> onRejected;

    public void Resolve()
    {
        _state = State.Resolved;
        this.onResolved?.Invoke();
    }

    public void Reject(Exception exception = null)
    {
        _exception = exception;
        _state = State.Rejected;
        this.onRejected?.Invoke(exception);
    }

    public void ThrowIfRejected()
    {
        if (_exception != null)
            throw _exception;
    }
}

public class Promise<T> : Promise
{
    private T _result = default(T);
    public T result => _result;

    public Action<T> onResolvedWithResult;

    public void Resolve(T result)
    {
        _result = result;
        Resolve();
        onResolvedWithResult?.Invoke(result);
    }
}
