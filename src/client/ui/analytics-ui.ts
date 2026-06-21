import { getStoredAuth } from "../platform/auth";
import { getApiBaseUrl } from "../platform/api";

function sendUiEvent(eventType: string, payload: any) {
  const auth = getStoredAuth();
  const envelope = {
    id: crypto.randomUUID(),
    eventType,
    userId: auth ? auth.user.id : null,
    timestamp: new Date().toISOString(),
    payload,
  };

  try {
    const blob = new Blob([JSON.stringify(envelope)], { type: "application/json" });
    navigator.sendBeacon(`${getApiBaseUrl()}/analytics/event`, blob);
  } catch (err) {
    console.warn("Analytics beacon failed", err);
  }
}

export function initUiTelemetry(containerElement: HTMLElement, pageId: string) {
  const visibilityMap = new Map<Element, number>();
  let maxScrollDepth = 0;

  // 1. Impression Tracking via IntersectionObserver
  const observer = new IntersectionObserver(
    (entries) => {
      const now = Date.now();
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Element entered viewport
          visibilityMap.set(entry.target, now);
        } else {
          // Element left viewport
          const startTime = visibilityMap.get(entry.target);
          if (startTime) {
            const visibleTimeMs = now - startTime;
            visibilityMap.delete(entry.target);

            // Only send if visible for > 1 second (1000ms)
            if (visibleTimeMs >= 1000) {
              const elementId = entry.target.getAttribute("data-track-id") || "unknown";
              const elementType = entry.target.getAttribute("data-track-type") || "unknown";
              
              sendUiEvent("UiImpression", {
                elementId,
                elementType,
                visibleTimeMs,
              });
            }
          }
        }
      });
    },
    { threshold: 0.5 } // Requires at least 50% visibility
  );

  // 2. Click Tracking via Event Delegation
  const clickHandler = (e: MouseEvent) => {
    let target = e.target as Element | null;
    while (target && target !== containerElement) {
      const clickAction = target.getAttribute("data-click-action");
      if (clickAction) {
        // Find nearest tracked element parent to inherit IDs, if it exists
        const trackedParent = target.closest("[data-track-id]");
        const elementId = trackedParent ? trackedParent.getAttribute("data-track-id") : (target.getAttribute("id") || "unknown");
        const elementType = trackedParent ? trackedParent.getAttribute("data-track-type") : "button";

        sendUiEvent("UiClick", {
          elementId,
          elementType,
          action: clickAction,
        });
        break; // Stop bubbling the analytics event
      }
      target = target.parentElement;
    }
  };

  containerElement.addEventListener("click", clickHandler);

  // 3. Scroll Tracking
  const scrollContainer = containerElement.querySelector(".vp-content") || window;
  let scrollTimeout: any = null;

  const scrollHandler = (e: Event) => {
    if (scrollTimeout) return;
    scrollTimeout = setTimeout(() => {
      scrollTimeout = null;
      let depth = 0;
      
      if (e.target === document || e.target === window) {
        const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        const winHeight = window.innerHeight;
        const scrollY = window.scrollY;
        if (docHeight > winHeight) {
          depth = Math.round((scrollY / (docHeight - winHeight)) * 100);
        }
      } else {
        const el = e.target as HTMLElement;
        if (el.scrollHeight > el.clientHeight) {
          depth = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
        }
      }
      
      if (depth > maxScrollDepth) {
        maxScrollDepth = depth;
      }
    }, 500); // 500ms throttle to prevent UI thread blocking
  };

  scrollContainer.addEventListener("scroll", scrollHandler, { passive: true });

  // Expose a method to observe dynamically injected elements
  const observeElements = () => {
    const elements = containerElement.querySelectorAll("[data-track-id]");
    elements.forEach(el => observer.observe(el));
  };

  // Initial observation
  observeElements();

  return {
    observeElements,
    dispose: () => {
      // Force flush any pending visible elements that are currently on screen
      const now = Date.now();
      visibilityMap.forEach((startTime, target) => {
        const visibleTimeMs = now - startTime;
        if (visibleTimeMs >= 1000) {
          sendUiEvent("UiImpression", {
            elementId: target.getAttribute("data-track-id") || "unknown",
            elementType: target.getAttribute("data-track-type") || "unknown",
            visibleTimeMs,
          });
        }
      });
      visibilityMap.clear();

      // Submit final scroll depth
      sendUiEvent("UiScrollDepth", {
        page: pageId,
        maxDepthPercent: maxScrollDepth,
      });

      // Cleanup listeners
      observer.disconnect();
      containerElement.removeEventListener("click", clickHandler);
      scrollContainer.removeEventListener("scroll", scrollHandler);
    }
  };
}
