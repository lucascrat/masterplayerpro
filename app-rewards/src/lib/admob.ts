import {
  AdMob,
  BannerAdOptions,
  BannerAdPosition,
  BannerAdSize,
  RewardAdOptions,
  AdMobRewardItem,
  AdLoadInfo,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

/**
 * AdMob unit IDs — provided by the app owner.
 * App ID (ca-app-pub-6105194579101073~8578653192) is configured in
 * AndroidManifest via capacitor.config.ts plugin block.
 */
export const AD_UNITS = {
  rewarded: 'ca-app-pub-6105194579101073/1188929949',
  banner: 'ca-app-pub-6105194579101073/8171459080',
  interstitial: 'ca-app-pub-6105194579101073/4973308463',
} as const;

let initialized = false;

export async function initAdMob() {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) {
    // Web/dev — AdMob only works on native, silently no-op
    initialized = true;
    return;
  }
  try {
    await AdMob.initialize({
      testingDevices: [],
      initializeForTesting: false,
    });
    initialized = true;
  } catch (e) {
    console.warn('[AdMob] init failed', e);
  }
}

export async function showBanner() {
  if (!Capacitor.isNativePlatform()) return;
  const options: BannerAdOptions = {
    adId: AD_UNITS.banner,
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    margin: 0,
    isTesting: false,
  };
  try {
    await AdMob.showBanner(options);
  } catch (e) {
    console.warn('[AdMob] banner failed', e);
  }
}

export async function hideBanner() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.hideBanner();
  } catch {
    /* no banner shown */
  }
}

/**
 * Shows a rewarded video and resolves with the reward when the user earns it.
 * Rejects if the ad fails to load or the user dismisses without earning.
 */
export async function showRewarded(): Promise<AdMobRewardItem> {
  if (!Capacitor.isNativePlatform()) {
    // Web fallback: pretend we rewarded after a short delay so devs can test the UI flow.
    await new Promise((r) => setTimeout(r, 1500));
    return { type: 'coin', amount: 1 };
  }

  const options: RewardAdOptions = {
    adId: AD_UNITS.rewarded,
    isTesting: false,
  };

  return new Promise(async (resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const onLoaded = (_: AdLoadInfo) => {};
    const onReward = (reward: AdMobRewardItem) => finish(() => resolve(reward));
    const onFailedToLoad = (err: any) => finish(() => reject(new Error(`ad_load_failed: ${err?.message || err?.code || 'unknown'}`)));
    const onDismissed = () => finish(() => reject(new Error('dismissed_without_reward')));

    const listeners = [
      await AdMob.addListener(RewardAdPluginEvents.Loaded, onLoaded),
      await AdMob.addListener(RewardAdPluginEvents.Rewarded, onReward),
      await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, onFailedToLoad),
      await AdMob.addListener(RewardAdPluginEvents.Dismissed, onDismissed),
    ];
    const cleanup = () => listeners.forEach((l) => l.remove());

    try {
      await AdMob.prepareRewardVideoAd(options);
      await AdMob.showRewardVideoAd();
    } catch (e: any) {
      finish(() => reject(new Error(`ad_show_failed: ${e?.message || e}`)));
    }
  });
}

export async function showInterstitial() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.prepareInterstitial({
      adId: AD_UNITS.interstitial,
      isTesting: false,
    });
    await AdMob.showInterstitial();
  } catch (e) {
    console.warn('[AdMob] interstitial failed', e);
  }
}
