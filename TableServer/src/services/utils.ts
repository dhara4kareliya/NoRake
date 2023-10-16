import crypto from 'crypto';
import moment from 'moment';

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