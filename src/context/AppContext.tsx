"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type {
  AiCompetency,
  AiEmployee,
  AiKpi,
  AiMode,
  AiResult,
  AttendanceRecordRow,
  GpsState,
  HolidayForm,
  HolidayItem,
  LeaveBalanceRow,
  LeaveDraft,
  LeaveRequestRow,
  LeaveTypeKey,
  Me,
  NotificationRow,
  PayrollRow,
  PerformanceRow,
  ReportData,
  ReportTab,
  RequestStatus,
  TabKey,
  ViewKey,
  Workplace,
} from "@/lib/types";
import { apiFetch, getCurrentPosition } from "@/lib/apiClient";

interface AiCriteria {
  summary: string;
  competencies: AiCompetency[];
  kpis: AiKpi[];
}

interface AiDraft {
  overall: string;
  strengths: string[];
  improvements: string[];
  development: string[];
  summary: string;
}

interface AppState {
  view: ViewKey;
  tab: TabKey;
  parent: ViewKey;

  me: Me | null;
  bootLoading: boolean;
  bootError: string | null;

  now: number;
  toast: string | null;
  gps: GpsState | null;

  attendanceToday: AttendanceRecordRow | null;
  attendanceHistory: AttendanceRecordRow[];
  workplaces: Workplace[];

  leaveBalances: LeaveBalanceRow[];
  requests: LeaveRequestRow[];
  reqFilter: "all" | RequestStatus;
  reqScope: "mine" | "team" | "all";
  requestsLoading: boolean;

  holidays: HolidayItem[];
  holidaySheet: boolean;
  hForm: HolidayForm;

  notifications: NotificationRow[];

  payroll: PayrollRow[];
  showPay: boolean;

  performance: PerformanceRow | null;

  aiEmployees: AiEmployee[];
  aiMode: AiMode;
  aiDept: string | null;
  aiRole: string;
  aiEmp: AiEmployee | null;
  aiLoading: boolean;
  aiResult: AiResult | null;
  aiError: string;

  reportTab: ReportTab;
  reportData: ReportData | null;
  reportLoading: boolean;

  leave: LeaveDraft | null;
}

const initialState: AppState = {
  view: "home",
  tab: "home",
  parent: "home",

  me: null,
  bootLoading: true,
  bootError: null,

  now: Date.now(),
  toast: null,
  gps: null,

  attendanceToday: null,
  attendanceHistory: [],
  workplaces: [],

  leaveBalances: [],
  requests: [],
  reqFilter: "all",
  reqScope: "mine",
  requestsLoading: false,

  holidays: [],
  holidaySheet: false,
  hForm: { name: "", date: "", type: "company", notify: true },

  notifications: [],

  payroll: [],
  showPay: false,

  performance: null,

  aiEmployees: [],
  aiMode: "criteria",
  aiDept: null,
  aiRole: "",
  aiEmp: null,
  aiLoading: false,
  aiResult: null,
  aiError: "",

  reportTab: "attendance",
  reportData: null,
  reportLoading: false,

  leave: null,
};

interface AppContextValue {
  state: AppState;
  go: (view: ViewKey, tab?: TabKey) => void;
  goSub: (view: ViewKey) => void;
  back: () => void;
  showToast: (msg: string) => void;

  toggleClock: () => void;
  closeGps: () => void;
  confirmGps: () => void;
  setWorkplace: (workplaceId: number) => void;
  submitQrCode: (qrToken: string) => void;
  retryGps: () => void;

  refreshRequests: (scope?: "mine" | "team" | "all") => void;
  openLeave: (leaveType?: LeaveTypeKey) => void;
  openCorrection: () => void;
  updLeave: (field: keyof LeaveDraft, value: string | boolean | null) => void;
  leaveBack: () => void;
  leaveNext: () => void;
  uploadAttachment: (file: File) => Promise<void>;
  setFilter: (filter: "all" | RequestStatus) => void;
  setReqScope: (scope: "mine" | "team" | "all") => void;
  decideLeave: (id: number, action: "approve" | "reject") => void;

  markRead: () => void;

  setAiMode: (mode: AiMode) => void;
  setAiDept: (dept: string) => void;
  setAiRole: (role: string) => void;
  setAiEmp: (emp: AiEmployee) => void;
  genCriteria: () => void;
  genDraft: () => void;

  openHoliday: () => void;
  closeHoliday: () => void;
  updH: (field: keyof HolidayForm, value: string | boolean) => void;
  addHoliday: () => void;
  delHoliday: (id: number) => void;
  toggleHNotify: (id: number) => void;

  togglePay: () => void;
  setReportTab: (tab: ReportTab) => void;

  doLogout: () => void;
  downloadSlip: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AppState>(initialState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patch = useCallback((p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    setState((s) => ({ ...s, ...(typeof p === "function" ? p(s) : p) }));
  }, []);

  const showToast = useCallback(
    (msg: string) => {
      patch({ toast: msg });
    },
    [patch]
  );

  // toast auto-hide
  useEffect(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (state.toast) {
      toastTimer.current = setTimeout(() => patch({ toast: null }), 2200);
    }
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [state.toast, patch]);

  // live clock ticker
  useEffect(() => {
    const t = setInterval(() => patch({ now: Date.now() }), 1000);
    return () => clearInterval(t);
  }, [patch]);

  const refreshAttendance = useCallback(async () => {
    const data = await apiFetch<{ today: AttendanceRecordRow | null; history: AttendanceRecordRow[] }>(
      "/api/attendance"
    );
    patch({ attendanceToday: data.today, attendanceHistory: data.history });
  }, [patch]);

  const refreshLeaveBalances = useCallback(async () => {
    const data = await apiFetch<{ balances: LeaveBalanceRow[] }>("/api/leave/balances");
    patch({ leaveBalances: data.balances });
  }, [patch]);

  const refreshRequests = useCallback(
    (scope?: "mine" | "team" | "all") => {
      const useScope = scope || stateRef.current.reqScope;
      patch({ requestsLoading: true, reqScope: useScope });
      apiFetch<{ requests: LeaveRequestRow[] }>(`/api/leave?scope=${useScope}`)
        .then((data) => patch({ requests: data.requests, requestsLoading: false }))
        .catch(() => patch({ requestsLoading: false }));
    },
    [patch]
  );

  const refreshHolidays = useCallback(async () => {
    const data = await apiFetch<{ holidays: HolidayItem[] }>("/api/holidays");
    patch({ holidays: data.holidays });
  }, [patch]);

  const refreshNotifications = useCallback(async () => {
    const data = await apiFetch<{ notifications: NotificationRow[] }>("/api/notifications");
    patch({ notifications: data.notifications });
  }, [patch]);

  const refreshPayroll = useCallback(async () => {
    const data = await apiFetch<{ payroll: PayrollRow[] }>("/api/payroll");
    patch({ payroll: data.payroll });
  }, [patch]);

  const refreshPerformance = useCallback(async () => {
    const data = await apiFetch<{ performance: PerformanceRow | null }>("/api/performance");
    patch({ performance: data.performance });
  }, [patch]);

  const refreshAiEmployees = useCallback(async () => {
    const data = await apiFetch<{ employees: AiEmployee[] }>("/api/employees");
    patch({ aiEmployees: data.employees });
  }, [patch]);

  const refreshWorkplaces = useCallback(async () => {
    const data = await apiFetch<{ workplaces: Workplace[] }>("/api/workplaces");
    patch({ workplaces: data.workplaces });
  }, [patch]);

  // bootstrap on mount
  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch<Me>("/api/auth/me");
        patch({ me });
        const defaultScope = me.role === "hr" ? "all" : me.role === "manager" ? "team" : "mine";
        await Promise.all([
          refreshAttendance(),
          refreshLeaveBalances(),
          refreshHolidays(),
          refreshNotifications(),
          refreshPayroll(),
          refreshPerformance(),
          refreshWorkplaces(),
          me.role !== "employee" ? refreshAiEmployees() : Promise.resolve(),
        ]);
        refreshRequests(defaultScope);
        patch({ bootLoading: false });
      } catch {
        router.replace("/login");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback(
    (view: ViewKey, tab?: TabKey) => {
      patch((s) => ({
        view,
        tab: tab || s.tab,
        parent: tab ? view : s.parent,
      }));
      if (view === "requests") refreshRequests();
    },
    [patch, refreshRequests]
  );

  const goSub = useCallback(
    (view: ViewKey) => {
      patch((s) => ({ view, parent: s.tab }));
      if (view === "reports") {
        patch({ reportLoading: true });
        apiFetch<ReportData>(`/api/reports?tab=${stateRef.current.reportTab}`)
          .then((data) => patch({ reportData: data, reportLoading: false }))
          .catch(() => patch({ reportLoading: false }));
      }
    },
    [patch]
  );

  const back = useCallback(() => {
    patch((s) => ({ view: s.parent }));
  }, [patch]);

  const toggleClock = useCallback(() => {
    const today = stateRef.current.attendanceToday;
    const mode: "in" | "out" | null = !today?.clockInAt ? "in" : !today?.clockOutAt ? "out" : null;
    if (!mode) return;
    const defaultWorkplace = stateRef.current.workplaces[0];
    if (!defaultWorkplace) {
      showToast("ไม่พบสถานที่ทำงานในระบบ กรุณาติดต่อ HR");
      return;
    }
    patch({ gps: { mode, phase: "qr", workplaceId: defaultWorkplace.id, step: 0 } });
  }, [patch, showToast]);

  const setWorkplace = useCallback(
    (workplaceId: number) => patch((s) => (s.gps ? { gps: { ...s.gps, workplaceId } } : {})),
    [patch]
  );

  const closeGps = useCallback(() => patch({ gps: null }), [patch]);

  const retryGps = useCallback(() => {
    patch((s) =>
      s.gps ? { gps: { mode: s.gps.mode, phase: "qr", workplaceId: s.gps.workplaceId, step: 0 } } : {}
    );
  }, [patch]);

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const submitQrCode = useCallback(
    (qrToken: string) => {
      const gps = stateRef.current.gps;
      if (!gps) return;
      (async () => {
        try {
          patch((s) => (s.gps ? { gps: { ...s.gps, phase: "progress", step: 1, qrToken } } : {}));
          const pos = await getCurrentPosition();
          patch((s) =>
            s.gps
              ? {
                  gps: {
                    ...s.gps,
                    step: 2,
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                  },
                }
              : {}
          );
          await delay(350);
          patch((s) => (s.gps ? { gps: { ...s.gps, step: 3 } } : {}));
          const verify = await apiFetch<{
            ok: boolean;
            error?: string;
            distance?: number;
            workplace?: { id: number; name: string; radiusMeters: number };
          }>("/api/attendance/verify-location", {
            method: "POST",
            body: JSON.stringify({ workplaceId: gps.workplaceId, qrToken, lat: pos.coords.latitude, lng: pos.coords.longitude }),
          });
          patch((s) =>
            s.gps
              ? {
                  gps: {
                    ...s.gps,
                    phase: "result",
                    step: 5,
                    verified: verify.ok,
                    distance: verify.distance,
                    workplaceName: verify.workplace?.name,
                    radiusMeters: verify.workplace?.radiusMeters,
                    error: verify.error,
                  },
                }
              : {}
          );
        } catch (err) {
          patch((s) =>
            s.gps
              ? { gps: { ...s.gps, phase: "result", verified: false, error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" } }
              : {}
          );
        }
      })();
    },
    [patch]
  );

  const confirmGps = useCallback(() => {
    const gps = stateRef.current.gps;
    if (!gps || gps.phase !== "result" || !gps.verified || gps.lat === undefined || gps.lng === undefined) return;
    const endpoint = gps.mode === "in" ? "/api/attendance/clock-in" : "/api/attendance/clock-out";
    apiFetch<{ record: AttendanceRecordRow }>(endpoint, {
      method: "POST",
      body: JSON.stringify({
        lat: gps.lat,
        lng: gps.lng,
        workplaceId: gps.workplaceId,
        qrToken: gps.qrToken,
      }),
    })
      .then(() => {
        patch({ gps: null });
        showToast(gps.mode === "in" ? "ลงเวลาเข้างานเรียบร้อย" : "ลงเวลาออกงานเรียบร้อย");
        refreshAttendance();
      })
      .catch((err: Error) => {
        patch((s) => (s.gps ? { gps: { ...s.gps, phase: "result", verified: false, error: err.message } } : {}));
      });
  }, [patch, showToast, refreshAttendance]);

  const openLeave = useCallback(
    (leaveType?: LeaveTypeKey) => {
      patch((s) => ({
        view: "leave",
        parent: s.tab,
        leave: {
          step: 1,
          type: leaveType || null,
          from: "",
          to: "",
          half: "full",
          otStart: "18:00",
          otEnd: "21:00",
          reason: "",
          attachmentUrl: null,
          attachmentName: null,
          uploading: false,
        },
      }));
    },
    [patch]
  );

  const openCorrection = useCallback(() => openLeave("correction"), [openLeave]);

  const updLeave = useCallback(
    (field: keyof LeaveDraft, value: string | boolean | null) => {
      patch((s) => (s.leave ? { leave: { ...s.leave, [field]: value } as LeaveDraft } : {}));
    },
    [patch]
  );

  const leaveBack = useCallback(() => {
    patch((s) => {
      if (s.leave && s.leave.step > 1) {
        return { leave: { ...s.leave, step: (s.leave.step - 1) as LeaveDraft["step"] } };
      }
      return { view: s.parent };
    });
  }, [patch]);

  const uploadAttachment = useCallback(
    async (file: File) => {
      patch((s) => (s.leave ? { leave: { ...s.leave, uploading: true } } : {}));
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "อัปโหลดไฟล์ไม่สำเร็จ");
        patch((s) =>
          s.leave
            ? { leave: { ...s.leave, attachmentUrl: data.url, attachmentName: data.fileName, uploading: false } }
            : {}
        );
      } catch (err) {
        patch((s) => (s.leave ? { leave: { ...s.leave, uploading: false } } : {}));
        showToast(err instanceof Error ? err.message : "อัปโหลดไฟล์ไม่สำเร็จ");
      }
    },
    [patch, showToast]
  );

  const leaveNext = useCallback(() => {
    const l = stateRef.current.leave;
    if (!l) return;
    if (l.step === 1 && !l.type) return;
    if (l.step < 4) {
      patch({ leave: { ...l, step: (l.step + 1) as LeaveDraft["step"] } });
      return;
    }
    apiFetch("/api/leave", {
      method: "POST",
      body: JSON.stringify({
        type: l.type,
        dateFrom: l.from || null,
        dateTo: l.to || l.from || null,
        halfDay: l.half === "half",
        otStartTime: l.type === "ot" ? l.otStart : null,
        otEndTime: l.type === "ot" ? l.otEnd : null,
        reason: l.reason,
        attachmentUrl: l.attachmentUrl,
      }),
    })
      .then(() => {
        patch({ leave: null, view: "requests", tab: "requests", parent: "requests", reqFilter: "all" });
        showToast("ส่งคำขอเรียบร้อยแล้ว");
        refreshRequests("mine");
        refreshLeaveBalances();
      })
      .catch((err: Error) => showToast(err.message));
  }, [patch, showToast, refreshRequests, refreshLeaveBalances]);

  const setFilter = useCallback((filter: "all" | RequestStatus) => patch({ reqFilter: filter }), [patch]);
  const setReqScope = useCallback((scope: "mine" | "team" | "all") => refreshRequests(scope), [refreshRequests]);

  const decideLeave = useCallback(
    (id: number, action: "approve" | "reject") => {
      apiFetch(`/api/leave/${id}/decide`, { method: "POST", body: JSON.stringify({ action }) })
        .then(() => {
          showToast(action === "approve" ? "อนุมัติคำขอแล้ว" : "ไม่อนุมัติคำขอแล้ว");
          refreshRequests();
        })
        .catch((err: Error) => showToast(err.message));
    },
    [showToast, refreshRequests]
  );

  const markRead = useCallback(() => {
    apiFetch("/api/notifications/mark-read", { method: "POST" }).then(() => refreshNotifications());
  }, [refreshNotifications]);

  const setAiMode = useCallback(
    (mode: AiMode) => patch({ aiMode: mode, aiResult: null, aiError: "" }),
    [patch]
  );
  const setAiDept = useCallback((dept: string) => patch({ aiDept: dept }), [patch]);
  const setAiRole = useCallback((role: string) => patch({ aiRole: role }), [patch]);
  const setAiEmp = useCallback((emp: AiEmployee) => patch({ aiEmp: emp }), [patch]);

  const genCriteria = useCallback(() => {
    const s = stateRef.current;
    if (!s.aiDept) return;
    patch({ aiLoading: true, aiError: "", aiResult: null });
    apiFetch<{ criteria: AiCriteria }>("/api/ai/criteria", {
      method: "POST",
      body: JSON.stringify({ department: s.aiDept, role: s.aiRole }),
    })
      .then((data) =>
        patch({
          aiLoading: false,
          aiResult: {
            type: "criteria",
            summary: data.criteria.summary,
            competencies: data.criteria.competencies,
            kpis: data.criteria.kpis,
          },
        })
      )
      .catch((err: Error) => patch({ aiLoading: false, aiError: err.message }));
  }, [patch]);

  const genDraft = useCallback(() => {
    const s = stateRef.current;
    if (!s.aiEmp) return;
    patch({ aiLoading: true, aiError: "", aiResult: null });
    apiFetch<{ draft: AiDraft }>("/api/ai/draft", {
      method: "POST",
      body: JSON.stringify({ employeeId: s.aiEmp.id, scores: s.aiEmp.scores }),
    })
      .then((data) =>
        patch({
          aiLoading: false,
          aiResult: {
            type: "draft",
            overall: data.draft.overall,
            strengths: data.draft.strengths,
            improvements: data.draft.improvements,
            development: data.draft.development,
            summary: data.draft.summary,
          },
        })
      )
      .catch((err: Error) => patch({ aiLoading: false, aiError: err.message }));
  }, [patch]);

  const openHoliday = useCallback(
    () => patch({ holidaySheet: true, hForm: { name: "", date: "", type: "company", notify: true } }),
    [patch]
  );
  const closeHoliday = useCallback(() => patch({ holidaySheet: false }), [patch]);
  const updH = useCallback(
    (field: keyof HolidayForm, value: string | boolean) =>
      patch((s) => ({ hForm: { ...s.hForm, [field]: value } as HolidayForm })),
    [patch]
  );
  const addHoliday = useCallback(() => {
    const hf = stateRef.current.hForm;
    if (!hf.name || !hf.date) return;
    apiFetch("/api/holidays", {
      method: "POST",
      body: JSON.stringify({ name: hf.name, dateISO: hf.date, type: hf.type, notifyEnabled: hf.notify }),
    })
      .then(() => {
        patch({ holidaySheet: false });
        showToast("เพิ่มวันหยุดเรียบร้อย");
        refreshHolidays();
      })
      .catch((err: Error) => showToast(err.message));
  }, [patch, showToast, refreshHolidays]);
  const delHoliday = useCallback(
    (id: number) => {
      apiFetch(`/api/holidays/${id}`, { method: "DELETE" })
        .then(() => {
          showToast("ลบวันหยุดแล้ว");
          refreshHolidays();
        })
        .catch((err: Error) => showToast(err.message));
    },
    [showToast, refreshHolidays]
  );
  const toggleHNotify = useCallback(
    (id: number) => {
      const h = stateRef.current.holidays.find((x) => x.id === id);
      if (!h) return;
      apiFetch(`/api/holidays/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ notifyEnabled: !h.notifyEnabled }),
      }).then(() => refreshHolidays());
    },
    [refreshHolidays]
  );

  const togglePay = useCallback(() => patch((s) => ({ showPay: !s.showPay })), [patch]);

  const setReportTab = useCallback(
    (tab: ReportTab) => {
      patch({ reportTab: tab, reportLoading: true });
      apiFetch<ReportData>(`/api/reports?tab=${tab}`)
        .then((data) => patch({ reportData: data, reportLoading: false }))
        .catch(() => patch({ reportLoading: false }));
    },
    [patch]
  );

  const doLogout = useCallback(() => {
    apiFetch("/api/auth/logout", { method: "POST" }).finally(() => {
      router.replace("/login");
    });
  }, [router]);

  const downloadSlip = useCallback(() => showToast("กำลังดาวน์โหลดสลิป PDF"), [showToast]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      go,
      goSub,
      back,
      showToast,
      toggleClock,
      closeGps,
      confirmGps,
      setWorkplace,
      submitQrCode,
      retryGps,
      refreshRequests,
      openLeave,
      openCorrection,
      updLeave,
      leaveBack,
      leaveNext,
      uploadAttachment,
      setFilter,
      setReqScope,
      decideLeave,
      markRead,
      setAiMode,
      setAiDept,
      setAiRole,
      setAiEmp,
      genCriteria,
      genDraft,
      openHoliday,
      closeHoliday,
      updH,
      addHoliday,
      delHoliday,
      toggleHNotify,
      togglePay,
      setReportTab,
      doLogout,
      downloadSlip,
    }),
    [
      state,
      go,
      goSub,
      back,
      showToast,
      toggleClock,
      closeGps,
      confirmGps,
      setWorkplace,
      submitQrCode,
      retryGps,
      refreshRequests,
      openLeave,
      openCorrection,
      updLeave,
      leaveBack,
      leaveNext,
      uploadAttachment,
      setFilter,
      setReqScope,
      decideLeave,
      markRead,
      setAiMode,
      setAiDept,
      setAiRole,
      setAiEmp,
      genCriteria,
      genDraft,
      openHoliday,
      closeHoliday,
      updH,
      addHoliday,
      delHoliday,
      toggleHNotify,
      togglePay,
      setReportTab,
      doLogout,
      downloadSlip,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
