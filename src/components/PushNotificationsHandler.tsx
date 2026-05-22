import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const PushNotificationsHandler = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (!Capacitor.isNativePlatform()) {
      console.log("[Push] Not a native platform, skipping");
      return;
    }
    if (Capacitor.getPlatform() !== "ios") {
      console.log("[Push] Not iOS, skipping for now");
      return;
    }

    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        console.log("[Push] Setting up push notifications...");

        const perm = await PushNotifications.checkPermissions();
        console.log("[Push] Current permission:", perm.receive);

        let status = perm.receive;
        if (status === "prompt" || status === "prompt-with-rationale") {
          console.log("[Push] Requesting permission...");
          const req = await PushNotifications.requestPermissions();
          status = req.receive;
          console.log("[Push] Permission result:", status);
        }

        if (status !== "granted") {
          console.log("[Push] Permission not granted, status:", status);
          return;
        }

        const regHandle = await PushNotifications.addListener("registration", async (t) => {
          console.log("[Push] Got APNs token:", t.value.slice(0, 16) + "...");
          const { error } = await supabase.from("device_tokens").upsert(
            { user_id: user.id, token: t.value, platform: "ios" },
            { onConflict: "token" },
          );
          if (error) console.error("[Push] Token upsert failed:", error);
          else console.log("[Push] Token saved to device_tokens");
        });

        const errHandle = await PushNotifications.addListener("registrationError", (e) => {
          console.error("[Push] Registration error:", JSON.stringify(e));
        });

        console.log("[Push] Calling register()...");
        await PushNotifications.register();

        cleanup = () => {
          regHandle.remove();
          errHandle.remove();
        };
      } catch (e) {
        console.error("[Push] Setup failed:", e);
      }
    })();

    return () => { cleanup?.(); };
  }, [user]);

  return null;
};
