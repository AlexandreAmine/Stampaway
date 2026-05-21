import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export const PushNotificationsHandler = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        const perm = await PushNotifications.checkPermissions();
        let status = perm.receive;
        if (status === "prompt" || status === "prompt-with-rationale") {
          const req = await PushNotifications.requestPermissions();
          status = req.receive;
        }
        if (status !== "granted") return;

        await PushNotifications.register();

        const regHandle = await PushNotifications.addListener("registration", async (t) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          await supabase.from("device_tokens").upsert(
            { user_id: user.id, token: t.value, platform: "ios" },
            { onConflict: "token" },
          );
        });

        const errHandle = await PushNotifications.addListener("registrationError", (e) => {
          console.error("Push registration error", e);
        });

        cleanup = () => {
          regHandle.remove();
          errHandle.remove();
        };
      } catch (e) {
        console.error("Push setup failed", e);
      }
    })();

    return () => { cleanup?.(); };
  }, []);

  return null;
};
