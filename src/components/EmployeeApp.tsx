"use client";

import { useApp } from "@/context/AppContext";
import { PhoneFrame } from "./PhoneFrame";
import { BottomNav } from "./BottomNav";
import { Toast } from "./Toast";
import { GpsSheet } from "./GpsSheet";
import { Home } from "./views/Home";
import { Attendance } from "./views/Attendance";
import { Requests } from "./views/Requests";
import { Payroll } from "./views/Payroll";
import { Payslip } from "./views/Payslip";
import { More } from "./views/More";
import { Profile } from "./views/Profile";
import { Notifications } from "./views/Notifications";
import { Performance } from "./views/Performance";
import { AiEval } from "./views/AiEval";
import { Reports } from "./views/Reports";
import { Holidays } from "./views/Holidays";
import { Leave } from "./views/Leave";
import { hhmm } from "@/lib/format";

export function EmployeeApp() {
  const { state } = useApp();
  const chromeBg = state.view === "home" ? "#17181c" : "#f5f6f8";
  const chromeFg = state.view === "home" ? "#fff" : "#191a2e";
  const nowClock = hhmm(state.now);

  return (
    <PhoneFrame
      chromeBg={chromeBg}
      chromeFg={chromeFg}
      nowClock={nowClock}
      bottomNav={<BottomNav />}
      overlays={
        <>
          <GpsSheet />
          <Toast />
        </>
      }
    >
      {state.view === "home" && <Home />}
      {state.view === "attendance" && <Attendance />}
      {state.view === "requests" && <Requests />}
      {state.view === "payroll" && <Payroll />}
      {state.view === "more" && <More />}
      {state.view === "perf" && <Performance />}
      {state.view === "notifs" && <Notifications />}
      {state.view === "payslip" && <Payslip />}
      {state.view === "profile" && <Profile />}
      {state.view === "reports" && <Reports />}
      {state.view === "holidays" && <Holidays />}
      {state.view === "aieval" && <AiEval />}
      {state.view === "leave" && <Leave />}
    </PhoneFrame>
  );
}
