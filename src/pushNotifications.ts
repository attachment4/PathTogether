// Push notifications disabled in Expo Go - will work in EAS Build
export async function registerDeviceToken(): Promise<string | null> { return null; }
export async function requestPartnerNotification(): Promise<void> {}
