import webpush from "npm:web-push@3.6.7";

type PushReminder = {
  user_id: string;
  reminder_id: string;
  title: string;
  body: string;
  target_label: string;
  remind_at: string;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const legacyServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
const adminKey = secretKeys
  ? JSON.parse(secretKeys).default
  : legacyServiceKey;

if (!adminKey) throw new Error("Supabase admin key is unavailable");

const adminFetch = async (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("apikey", adminKey);
  headers.set("Content-Type", "application/json");
  if (legacyServiceKey && adminKey === legacyServiceKey) {
    headers.set("Authorization", `Bearer ${legacyServiceKey}`);
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${await response.text()}`);
  }
  return response;
};

const deleteExpiredSubscription = async (id: string) => {
  await adminFetch(`push_subscriptions?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
};

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const configResponse = await adminFetch("rpc/get_push_delivery_config", {
      method: "POST",
      body: "{}",
    });
    const [config] = await configResponse.json();
    if (!config?.vapid_private_key || !config?.vapid_contact || !config?.cron_secret) {
      throw new Error("Push delivery configuration is incomplete");
    }
    if (request.headers.get("x-cron-secret") !== config.cron_secret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    webpush.setVapidDetails(
      config.vapid_contact,
      Deno.env.get("VAPID_PUBLIC_KEY") ?? "BBekV8DBj4dFkUx9TZ162s855pICXXYq5fS216Y9413mo5R6LZzOsKoyS7fNilGze3rdzkP-7TKBEUYHzrZRpQY",
      config.vapid_private_key,
    );

    const now = new Date().toISOString();
    const remindersResponse = await adminFetch(
      `push_reminders?select=user_id,reminder_id,title,body,target_label,remind_at&sent_at=is.null&remind_at=lte.${encodeURIComponent(now)}&order=remind_at.asc&limit=100`,
    );
    const reminders = await remindersResponse.json() as PushReminder[];
    if (reminders.length === 0) {
      return Response.json({ checked_at: now, reminders: 0, delivered: 0 });
    }

    const userIds = [...new Set(reminders.map((reminder) => reminder.user_id))];
    const subscriptionsResponse = await adminFetch(
      `push_subscriptions?select=id,user_id,endpoint,p256dh,auth_key&user_id=in.(${userIds.join(",")})`,
    );
    const subscriptions = await subscriptionsResponse.json() as PushSubscriptionRow[];
    const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
    for (const subscription of subscriptions) {
      const rows = subscriptionsByUser.get(subscription.user_id) ?? [];
      rows.push(subscription);
      subscriptionsByUser.set(subscription.user_id, rows);
    }

    let delivered = 0;
    let failed = 0;
    for (const reminder of reminders) {
      const userSubscriptions = subscriptionsByUser.get(reminder.user_id) ?? [];
      let deliveredForReminder = userSubscriptions.length === 0;
      for (const subscription of userSubscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
            },
            JSON.stringify({
              title: `Нагадування: ${reminder.title}`,
              body: reminder.body || reminder.target_label || reminder.title,
              tag: reminder.reminder_id,
              url: "/",
              timestamp: Date.parse(reminder.remind_at),
            }),
            { TTL: 86_400, urgency: "high" },
          );
          delivered += 1;
          deliveredForReminder = true;
        } catch (error) {
          const statusCode = typeof error === "object" && error && "statusCode" in error
            ? Number(error.statusCode)
            : 0;
          if (statusCode === 404 || statusCode === 410) {
            await deleteExpiredSubscription(subscription.id);
          } else {
            console.error("Push delivery failed", reminder.reminder_id, statusCode, error);
          }
          failed += 1;
        }
      }

      if (deliveredForReminder) {
        await adminFetch(
          `push_reminders?user_id=eq.${reminder.user_id}&reminder_id=eq.${encodeURIComponent(reminder.reminder_id)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ sent_at: now, updated_at: now }),
          },
        );
      }
    }

    return Response.json({
      checked_at: now,
      reminders: reminders.length,
      delivered,
      failed,
    });
  } catch (error) {
    console.error("Push reminder worker failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
});
