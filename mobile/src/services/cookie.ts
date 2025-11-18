import AsyncStorage from '@react-native-async-storage/async-storage';

// Minimal cookie-like helper using AsyncStorage.
// Note: On React Native, native HTTP cookies are not automatically managed by fetch.
// If you need real HTTP cookie behavior for the network stack, install
// a native cookie library such as @react-native-cookies/cookies and update these helpers.

const COOKIE_PREFIX = '@cookie:';

export async function setCookie(name: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(COOKIE_PREFIX + name, value);
  } catch (e) {
    console.warn('setCookie failed', e);
    throw e;
  }
}

export async function getCookie(name: string): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(COOKIE_PREFIX + name);
    return v;
  } catch (e) {
    console.warn('getCookie failed', e);
    return null;
  }
}

export async function deleteCookie(name: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(COOKIE_PREFIX + name);
  } catch (e) {
    console.warn('deleteCookie failed', e);
  }
}

export async function clearAllCookies(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()) as string[];
    const cookieKeys = keys.filter((k: string) => k.startsWith(COOKIE_PREFIX));
    await AsyncStorage.multiRemove(cookieKeys);
  } catch (e) {
    console.warn('clearAllCookies failed', e);
  }
}

export default {
  setCookie,
  getCookie,
  deleteCookie,
  clearAllCookies,
};
