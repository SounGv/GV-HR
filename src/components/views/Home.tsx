"use client";

import { useApp } from "@/context/AppContext";
import { Icon } from "@/components/Icon";
import { cardShadowSm, cardShadow } from "@/lib/styles";
import { clockStatus } from "@/lib/derive";
import { hhmm, initialsOf, thDays, thMonthsLong, timeAgo } from "@/lib/format";

export function Home() {
  const { state, goSub, go, toggleClock, openLeave } = useApp();
  const me = state.me;
  const initials = initialsOf(me?.name || "");
  const now = new Date(state.now);
  const hr = now.getHours();
  const greeting = hr < 12 ? "สวัสดีตอนเช้า" : hr < 17 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น";
  const todayLong =
    "วัน" +
    thDays[now.getDay()] +
    "ที่ " +
    now.getDate() +
    " " +
    thMonthsLong[now.getMonth()] +
    " " +
    (now.getFullYear() + 543);

  const today = state.attendanceToday;
  const clockInTs = today?.clockInAt ? new Date(today.clockInAt).getTime() : null;
  const clockOutTs = today?.clockOutAt ? new Date(today.clockOutAt).getTime() : null;
  const cs = clockStatus({
    clockedIn: !!clockInTs && !clockOutTs,
    clockInTs,
    clockOutTs,
    now: state.now,
  });

  const clockInDisplay = hhmm(clockInTs);
  const clockOutDisplay = hhmm(clockOutTs);

  const balanceColors: Record<string, string> = { annual: "#17181c", sick: "#10b981", personal: "#f59e0b" };
  const balances = state.leaveBalances.map((b) => ({ ...b, color: balanceColors[b.key] || "#17181c" }));
  const homeNotifs = state.notifications.slice(0, 2);
  const hasUnread = state.notifications.some((n) => !n.isRead);
  const perf = state.performance;

  return (
    <div style={{ animation: "gvpop .25s ease" }}>
      <div
        style={{
          background: "linear-gradient(160deg,#17181c 0%,#0c0d10 100%)",
          padding: "14px 20px 74px",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: "rgba(255,255,255,.16)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 16,
                border: "1.5px solid rgba(255,255,255,.35)",
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{greeting}</div>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{me?.name}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{me?.position}</div>
            </div>
          </div>
          <button
            onClick={() => goSub("notifs")}
            style={{
              position: "relative",
              width: 40,
              height: 40,
              border: "none",
              borderRadius: 13,
              background: "rgba(255,255,255,.14)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Icon name="notifications" size={22} />
            {hasUnread && (
              <span
                style={{
                  position: "absolute",
                  top: 8,
                  right: 9,
                  width: 8,
                  height: 8,
                  background: "#ff5a5f",
                  borderRadius: "50%",
                  border: "1.5px solid #0c0d10",
                }}
              />
            )}
          </button>
        </div>
        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.8 }}>{todayLong}</div>
      </div>

      {/* clock card */}
      <div
        style={{
          margin: "-58px 16px 0",
          background: "#fff",
          borderRadius: 24,
          padding: "22px 20px",
          boxShadow: "0 18px 40px -20px rgba(30,30,80,.35)",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "#7b7d8c", fontWeight: 600 }}>กะวันนี้ · Today</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>กะปกติ · 09:00 - 18:00</div>
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 11px",
              borderRadius: 999,
              background: cs.statusBg,
              color: cs.statusFg,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: cs.statusFg }} />
            {cs.statusText}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <div style={{ flex: 1, background: "#f5f6fa", borderRadius: 16, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "#7b7d8c", fontWeight: 600 }}>เข้างาน</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>{clockInDisplay}</div>
          </div>
          <div style={{ flex: 1, background: "#f5f6fa", borderRadius: 16, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "#7b7d8c", fontWeight: 600 }}>ออกงาน</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>{clockOutDisplay}</div>
          </div>
        </div>

        {cs.isWorking && (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#7b7d8c", fontWeight: 600 }}>เวลาทำงานวันนี้</div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: 1,
                color: "#10b981",
              }}
            >
              {cs.workedStr}
            </div>
          </div>
        )}

        <button onClick={toggleClock} style={cs.clockBtnStyle}>
          <Icon name={cs.clockBtnIcon} size={26} />
          <div style={{ textAlign: "left", lineHeight: 1.15 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{cs.clockBtnLabel}</div>
            <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>{cs.clockBtnSub}</div>
          </div>
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 12,
            color: "#9aa0ab",
            fontSize: 11,
          }}
        >
          <Icon name="location_on" size={15} />
          สำนักงานใหญ่ · Gadget Villa (GPS ยืนยันแล้ว)
        </div>
      </div>

      {/* quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "18px 16px 4px" }}>
        <div
          onClick={() => go("payroll", "payroll")}
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 16,
            cursor: "pointer",
            boxShadow: cardShadow,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              background: "#eef7cc",
              color: "#17181c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
            }}
          >
            <Icon name="account_balance_wallet" size={20} />
          </div>
          <div style={{ fontSize: 11, color: "#7b7d8c", fontWeight: 600 }}>เงินเดือน</div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 3, color: "#c2c4cf", lineHeight: 1.4 }}>
            ••••••
          </div>
          <div style={{ fontSize: 11, color: "#9aa0ab", display: "flex", alignItems: "center", gap: 3 }}>
            <Icon name="lock" size={13} />
            แตะเพื่อดู
          </div>
        </div>
        <div
          onClick={() => goSub("perf")}
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 16,
            cursor: "pointer",
            boxShadow: cardShadow,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              background: "#e7f8f0",
              color: "#0f9d6e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
            }}
          >
            <Icon name="trending_up" size={20} />
          </div>
          <div style={{ fontSize: 11, color: "#7b7d8c", fontWeight: 600 }}>คะแนนผลงาน</div>
          <div style={{ fontSize: 19, fontWeight: 800 }}>
            {perf ? perf.overallScore.toFixed(1) : "—"}{" "}
            <span style={{ fontSize: 12, color: "#9aa0ab", fontWeight: 600 }}>/ 5.0</span>
          </div>
          <div style={{ fontSize: 11, color: "#9aa0ab" }}>{perf?.cycle || "ยังไม่มีรอบประเมิน"}</div>
        </div>
      </div>

      {/* leave balance strip */}
      <div
        style={{
          margin: "14px 16px 0",
          background: "#fff",
          borderRadius: 20,
          padding: 16,
          boxShadow: cardShadow,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>วันลาคงเหลือ</div>
          <button
            onClick={() => openLeave()}
            style={{
              border: "none",
              background: "#eef7cc",
              color: "#17181c",
              fontWeight: 700,
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 999,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + ขอลา
          </button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {balances.map((b) => (
            <div key={b.label} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: b.color, lineHeight: 1 }}>{b.remain}</div>
              <div style={{ fontSize: 11, color: "#7b7d8c", fontWeight: 600, marginTop: 3 }}>{b.label}</div>
              <div style={{ fontSize: 10, color: "#b6b9c2" }}>
                ใช้ {b.used}/{b.total}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* recent notifications */}
      <div style={{ margin: "14px 16px 0" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>การแจ้งเตือนล่าสุด</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {homeNotifs.map((n) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                gap: 12,
                background: "#fff",
                borderRadius: 16,
                padding: "13px 14px",
                boxShadow: cardShadowSm,
              }}
            >
              <div
                style={{
                  flex: "none",
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: n.bg,
                  color: n.color,
                }}
              >
                <Icon name={n.icon} size={19} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{n.title}</div>
                <div style={{ fontSize: 11, color: "#8a8d99" }}>{timeAgo(n.createdAt)} ที่แล้ว</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}
