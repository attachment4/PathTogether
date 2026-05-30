// Notifications stub - works in Expo Go, full functionality in EAS Build
export async function setupNotificationChannel(): Promise<void> {}
export async function requestPermissions(): Promise<boolean> { return false; }
export async function scheduleHabitNotifications(_habits?: any, _hasPartner?: boolean, _enabled?: boolean): Promise<void> {}
export async function scheduleHabitTimeNotifications(_habits?: any): Promise<void> {}
export async function scheduleAppReminder(_hasPartner?: boolean, _enabled?: boolean): Promise<void> {}
export async function scheduleStreakReminder(_streak?: number, _hasPartner?: boolean, _enabled?: boolean): Promise<void> {}
export async function scheduleMorningMotivation(_hasPartner?: boolean, _enabled?: boolean): Promise<void> {}
export async function cancelAllNotifications(): Promise<void> {}
export async function cancelHabitNotifications(_habitId?: string): Promise<void> {}
export async function notifyPartnerDone(_partnerName?: string, _habitName?: string): Promise<void> {}
export async function notifyAchievement(_name?: string): Promise<void> {}
export async function setBadgeCount(_count: number): Promise<void> {}
export async function scheduleEveningReminder(_pendingCount?: number, _enabled?: boolean): Promise<void> {}
