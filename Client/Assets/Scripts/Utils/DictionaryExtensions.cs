using System;
using System.Collections.Generic;
using System.Linq;

public static class IReadOnlyDictionaryExtensions
{
    public static int GetInt32(this IReadOnlyDictionary<string, object> d, string key, int defaultValue = 0)
    {
        return d.TryGetValue(key, out var obj) ? Convert.ToInt32(obj) : defaultValue;
    }

    public static bool GetBoolean(this IReadOnlyDictionary<string, object> d, string key, bool defaultValue = false)
    {
        return d.TryGetValue(key, out var obj) ? Convert.ToBoolean(obj) : defaultValue;
    }

    public static string GetString(this IReadOnlyDictionary<string, object> d, string key, string defaultValue = null)
    {
        return d.TryGetValue(key, out var obj) ? Convert.ToString(obj) : defaultValue;
    }

    public static float GetSingle(this IReadOnlyDictionary<string, object> d, string key, float defaultValue = 0)
    {
        return d.TryGetValue(key, out var obj) ? Convert.ToSingle(obj) : defaultValue;
    }

    public static IReadOnlyDictionary<string, object> GetObject(this IReadOnlyDictionary<string, object> d, string key, IReadOnlyDictionary<string, object> defaultValue = null)
    {
        return d.TryGetValue(key, out var obj) ? obj as IReadOnlyDictionary<string, object> : (defaultValue ?? new Dictionary<string, object>());
    }

    public static object[] GetArray(this IReadOnlyDictionary<string, object> d, string key, object[] defaultValue = null)
    {
        return d.TryGetValue(key, out var obj) ? (obj as IReadOnlyList<object>).ToArray() : (defaultValue ?? new object[0]);
    }

    public static T[] GetArray<T>(this IReadOnlyDictionary<string, object> d, string key, T[] defaultValue = null)
    {
        return d.TryGetValue(key, out var obj) ? (obj as IReadOnlyList<object>).Cast<T>().ToArray() : (defaultValue ?? new T[0]);
    }
}
