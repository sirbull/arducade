/** The measurement ID is supplied locally at build time, never stored in Git. */
export function installAnalytics(): void {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  if (!import.meta.env.PROD || window.location.hostname !== 'arducade.bullfolio.no'
      || !measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) return;

  const analyticsWindow = window as Window & {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
  };
  analyticsWindow.dataLayer ??= [];
  analyticsWindow.gtag = function (..._args: unknown[]): void {
    analyticsWindow.dataLayer!.push(arguments);
  };
  analyticsWindow.gtag('js', new Date());
  analyticsWindow.gtag('config', measurementId);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);
}
