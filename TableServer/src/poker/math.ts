export function floor4(n: number) {
    return Number(Number(n).toFixed(4));
}

export function floor2(n: number) {
    return Number(Number(n).toFixed(2));
}

export function round0(n: number) {
    return Math.round(n);
}

export function equal(a?: number, b?: number) {
    if (a === undefined && b === undefined) {
        return true;
    }
    else if (a === undefined || b === undefined) {
        return false;
    }
    
    return Math.abs(a - b) < 0.0005
}
