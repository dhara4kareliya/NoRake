import crypto from 'crypto';
import moment from 'moment';
import { getErrorMessage } from '../messages';

const encryptionMethod = 'AES-256-CBC';
const secret = "gffuy7rk6fmu7rkfg7532h6u7cjk09ol"; //must be 32 char length
const iv = secret.substr(0,16);

export function decrypt(encryptedStr: string) {
    const decryptor = crypto.createDecipheriv(encryptionMethod, secret, iv);
    const decypted =  decryptor.update(encryptedStr, 'base64', 'utf8') + decryptor.final('utf8');
    return decypted.substr(20, decypted.length); 
};

export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export function generateRandomString(length: number = 20): string {
    const characters: string = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const charactersLength: number = characters.length;
    let randomString: string = '';
    for (let i: number = 0; i < length; i++) {
        randomString += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return randomString;
}

export function encrypt(textToEncrypt: string): string {
    const encryptionMethod: string = "AES-256-CBC";
    const secret: string = "gffuy7rk6fmu7rkfg7532h6u7cjk09ol";  // Must be 32 characters in length
    const iv: string = secret.substr(0, 16);
    const crypto = require('crypto');
    const cipher = crypto.createCipheriv(encryptionMethod, Buffer.from(secret), Buffer.from(iv));
    let encryptedText = cipher.update(textToEncrypt, 'utf8', 'base64');
    encryptedText += cipher.final('base64');
    return encryptedText;
}

export function generateHashAndServerString(){
    const randomString = crypto.randomBytes(64).toString('hex');
    const hash = crypto.createHash('sha256').update(randomString).digest('hex');
    return {randomString,hash};
}

export function generateJSONAndShuffleKey(randomStrings:any,hashes:any){
    const data = {
        randomStrings,hashes
    };
    const jsonString = JSON.stringify(data, null, 2); // Pretty print for readability
    
    
    const shuffleKey = crypto.createHash('sha256').update(jsonString).digest('hex');
    return { jsonString, shuffleKey };

}

export  function verifyAllUserHashes(userRandomStrings:any,userHashes:any) {
    var players = [];
    for (const [userId, randomStr] of Object.entries(userRandomStrings)) {
        const computedHash = crypto.createHash('sha256').update(String(randomStr)).digest('hex');
        if (computedHash !== userHashes[userId]){
            players.push(userId);
        }
    }
    if(players.length > 0 )
        return {"status":false,"message": getErrorMessage("hashVerifyError"),players};

    return {"status":true,"message": getErrorMessage("hashVerifySuccess"),players};
}

export function verifyJSONFromServer(jsonString:string) {
    const data = JSON.parse(jsonString);
    var players = [];
    for (const [userId, randomStr] of Object.entries(data.randomStrings)) {
        const computedHash = crypto.createHash('sha256').update(String(randomStr)).digest('hex');
        if (computedHash !== data.hashes[userId]) 
            players.push(userId);
    }
    if(players.length > 0 )
        return {"status":false,"message": getErrorMessage("hashVerifyError"),players};

    return {"status":true,"message": getErrorMessage("serverHashSuccessfull"),players};
}