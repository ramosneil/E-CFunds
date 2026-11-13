// Small helpers for "where is the app running?": a browser (PWA) or the Android app (Capacitor).
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
