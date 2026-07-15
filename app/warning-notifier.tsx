"use client";

import { useEffect, useRef } from "react";

export default function WarningNotifier({
  active,
  message,
}: {
  active: boolean;
  message: string;
}) {
  const lastMessage = useRef("");

  useEffect(() => {
    if (!active || !message) return;
    if (!("Notification" in window)) return;
    if (lastMessage.current === message) return;

    async function notify() {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }

      if (Notification.permission === "granted") {
        new Notification("Gewächshaus Warnung", {
          body: message,
        });

        lastMessage.current = message;
      }
    }

    notify();
  }, [active, message]);

  return null;
}