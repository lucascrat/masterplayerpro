export interface RewardProfile {
  code: string;
  coins: number;
  accessUntil: string | null;
}

export interface DailyStats {
  dailyCount: number;
  dailyMax: number;
  coinsPerVideo: number;
  hoursPerCoin: number;
}
