import { useEffect } from "react";
import { driver, DriveStep } from "driver.js";
import { useAuth } from "@/contexts/AuthContext";

declare global {
  interface Window {
    activeTourFn?: () => void;
  }
}

export function usePageTour(tourId: string, steps: DriveStep[]) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || steps.length === 0) return;

    const storageKey = `tour_${tourId}_${user.id}`;
    const hasSeenTour = localStorage.getItem(storageKey);

    let driverObj: any = null;

    const startTour = () => {
      const validSteps = steps.filter((s: any) => {
        if (!s.element) return true;
        return document.querySelector(s.element) !== null;
      });

      if (validSteps.length === 0) return;

      driverObj = driver({
        showProgress: true,
        animate: true,
        popoverClass: "arena-tour-theme",
        steps: validSteps,
        onDestroyStarted: () => {
          if (!hasSeenTour) {
            localStorage.setItem(storageKey, "true");
          }
          if (driverObj) driverObj.destroy();
        },
      });
      driverObj.drive();
    };

    // Register this tour as the currently active one for the "Replay Tour" button
    window.activeTourFn = () => setTimeout(startTour, 100);

    let timeout: ReturnType<typeof setTimeout>;
    // Auto-start if they haven't seen this specific tour yet
    if (!hasSeenTour) {
      timeout = setTimeout(startTour, 500);
    }

    // Cleanup when leaving the page
    return () => {
      if (timeout) clearTimeout(timeout);
      if (driverObj) driverObj.destroy();
      if (window.activeTourFn === startTour) {
        window.activeTourFn = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tourId]);
}
