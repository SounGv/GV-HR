"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type {
  AiEmployee,
  AiMode,
  AiResult,
  GpsState,
  HolidayForm,
  HolidayItem,
  LeaveDraft,
  LeaveRequest,
  LeaveTypeKey,
  ReportTab,
  RequestStatus,
  TabKey,
  ViewKey,
} from "@/lib/types";
import { initialHolidays, initialRequests, leaveTypeName } from "@/lib/mock";
import { thDate } from "@/lib/format";
import { mockGenCriteria, mockGenDraft } from "@/lib/aiMock";

interface AppState {
  view: ViewKey;
  tab: TabKey;
  parent: ViewKey;
  clockedIn: boolean;
  clockInTs: number | null;
  clockOutTs: number | null;
  now: number;
  reqFilter: "all" | RequestStatus;
  toast: string | null;
  unreadIds: Record<string, boolean>;
  showPay: boolean;
  gps: GpsState | null;
  reportTab: ReportTab;
  aiMode: AiMode;
  aiDept: string | null;
  aiRole: string;
  aiEmp: AiEmployee | null;
  aiLoading: boolean;
  aiResult: AiResult | null;
  aiError: string;
  holidayRemind: boolean;
  holidaySheet: boolean;
  nextHId: number;
  hForm: HolidayForm;
  holidays: HolidayItem[];
  leave: LeaveDraft | null;
  nextId: number;
  requests: LeaveRequest[];
}

const initialState: AppState = {
  view: "home",
  tab: "home",
  parent: "home",
  clockedIn: false,
  clockInTs: null,
  clockOutTs: null,
  now: Date.now(),
  reqFilter: "all",
  toast: null,
  unreadIds: { n1: true, n2: true },
  showPay: false,
  gps: null,
  reportTab: "attendance",
  aiMode: "criteria",
  aiDept: null,
  aiRole: "",
  aiEmp: null,
  aiLoading: false,
  aiResult: null,
  aiError: "",
  holidayRemind: true,
  holidaySheet: false,
  nextHId: 8,
  hForm: { name: "", date: "", type: "วันหยุดบริษัท", notify: true },
  holidays: initialHolidays,
  leave: null,
  nextId: 2042,
  requests: initialRequests,
};

type Action =
  | { type: "GO"; view: ViewKey; tab?: TabKey }
  | { type: "GO_SUB"; view: ViewKey }
  | { type: "BACK" }
  | { type: "TOAST_SHOW"; msg: string }
  | { type: "TOAST_HIDE" }
  | { type: "TICK"; now: number }
  | { type: "CLOCK_START_GPS"; mode: "in" | "out" }
  | { type: "GPS_SET_READY" }
  | { type: "GPS_CLOSE" }
  | { type: "GPS_CONFIRM" }
  | { type: "LEAVE_OPEN"; leaveType?: LeaveTypeKey }
  | { type: "LEAVE_UPDATE"; field: keyof LeaveDraft; value: string | boolean }
  | { type: "LEAVE_BACK" }
  | { type: "LEAVE_NEXT" }
  | { type: "SET_FILTER"; filter: "all" | RequestStatus }
  | { type: "MARK_READ" }
  | { type: "AI_SET_MODE"; mode: AiMode }
  | { type: "AI_SET_DEPT"; dept: string }
  | { type: "AI_SET_ROLE"; role: string }
  | { type: "AI_SET_EMP"; emp: AiEmployee }
  | { type: "AI_LOADING_START" }
  | { type: "AI_LOADING_DONE"; result: AiResult }
  | { type: "AI_ERROR"; error: string }
  | { type: "HOLIDAY_OPEN" }
  | { type: "HOLIDAY_CLOSE" }
  | { type: "HOLIDAY_FORM_UPDATE"; field: keyof HolidayForm; value: string | boolean }
  | { type: "HOLIDAY_ADD" }
  | { type: "HOLIDAY_DELETE"; id: number }
  | { type: "HOLIDAY_TOGGLE_NOTIFY"; id: number }
  | { type: "HOLIDAY_TOGGLE_REMIND" }
  | { type: "PAY_TOGGLE" }
  | { type: "REPORT_SET_TAB"; tab: ReportTab };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "GO":
      return {
        ...state,
        view: action.view,
        tab: action.tab || state.tab,
        parent: action.tab ? action.view : state.parent,
      };
    case "GO_SUB":
      return { ...state, view: action.view, parent: state.tab };
    case "BACK":
      return { ...state, view: state.parent };
    case "TOAST_SHOW":
      return { ...state, toast: action.msg };
    case "TOAST_HIDE":
      return { ...state, toast: null };
    case "TICK":
      return { ...state, now: action.now };
    case "CLOCK_START_GPS":
      return { ...state, gps: { mode: action.mode, phase: "locating" } };
    case "GPS_SET_READY":
      return state.gps ? { ...state, gps: { ...state.gps, phase: "ready" } } : state;
    case "GPS_CLOSE":
      return { ...state, gps: null };
    case "GPS_CONFIRM": {
      const g = state.gps;
      if (!g || g.phase !== "ready") return state;
      if (g.mode === "in") {
        return { ...state, gps: null, clockedIn: true, clockInTs: Date.now() };
      }
      return { ...state, gps: null, clockedIn: false, clockOutTs: Date.now() };
    }
    case "LEAVE_OPEN":
      return {
        ...state,
        view: "leave",
        parent: state.tab,
        leave: {
          step: 1,
          type: action.leaveType || null,
          from: "",
          to: "",
          half: "full",
          reason: "",
          attach: false,
        },
      };
    case "LEAVE_UPDATE":
      return state.leave
        ? { ...state, leave: { ...state.leave, [action.field]: action.value } as LeaveDraft }
        : state;
    case "LEAVE_BACK": {
      const l = state.leave;
      if (l && l.step > 1) {
        return { ...state, leave: { ...l, step: (l.step - 1) as LeaveDraft["step"] } };
      }
      return { ...state, view: state.parent };
    }
    case "LEAVE_NEXT": {
      const l = state.leave;
      if (!l) return state;
      if (l.step === 1 && !l.type) return state;
      if (l.step < 4) {
        return { ...state, leave: { ...l, step: (l.step + 1) as LeaveDraft["step"] } };
      }
      const type = l.type || "annual";
      const typeName = leaveTypeName[type];
      let range = l.from ? thDate(l.from) : "วันนี้";
      if (l.to && l.to !== l.from) range += "–" + thDate(l.to);
      const req: LeaveRequest = {
        id: "REQ-" + state.nextId,
        type: typeName,
        key: type,
        dateLabel: range,
        sub: l.half === "half" ? "ครึ่งวัน" : "1 วัน",
        status: "Pending",
        submitted: "วันนี้",
      };
      return {
        ...state,
        requests: [req, ...state.requests],
        nextId: state.nextId + 1,
        leave: null,
        view: "requests",
        tab: "requests",
        parent: "requests",
        reqFilter: "all",
        toast: "ส่งคำขอเรียบร้อยแล้ว",
      };
    }
    case "SET_FILTER":
      return { ...state, reqFilter: action.filter };
    case "MARK_READ":
      return { ...state, unreadIds: {} };
    case "AI_SET_MODE":
      return { ...state, aiMode: action.mode, aiResult: null, aiError: "" };
    case "AI_SET_DEPT":
      return { ...state, aiDept: action.dept };
    case "AI_SET_ROLE":
      return { ...state, aiRole: action.role };
    case "AI_SET_EMP":
      return { ...state, aiEmp: action.emp };
    case "AI_LOADING_START":
      return { ...state, aiLoading: true, aiError: "", aiResult: null };
    case "AI_LOADING_DONE":
      return { ...state, aiLoading: false, aiResult: action.result };
    case "AI_ERROR":
      return { ...state, aiLoading: false, aiError: action.error };
    case "HOLIDAY_OPEN":
      return {
        ...state,
        holidaySheet: true,
        hForm: { name: "", date: "", type: "วันหยุดบริษัท", notify: true },
      };
    case "HOLIDAY_CLOSE":
      return { ...state, holidaySheet: false };
    case "HOLIDAY_FORM_UPDATE":
      return { ...state, hForm: { ...state.hForm, [action.field]: action.value } as HolidayForm };
    case "HOLIDAY_ADD": {
      const h = state.hForm;
      if (!h.name || !h.date) return state;
      const item: HolidayItem = {
        id: state.nextHId,
        dateISO: h.date,
        name: h.name,
        type: h.type,
        notify: h.notify,
      };
      const holidays = [...state.holidays, item].sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1));
      return {
        ...state,
        holidays,
        nextHId: state.nextHId + 1,
        holidaySheet: false,
        toast: "เพิ่มวันหยุดเรียบร้อย",
      };
    }
    case "HOLIDAY_DELETE":
      return {
        ...state,
        holidays: state.holidays.filter((h) => h.id !== action.id),
        toast: "ลบวันหยุดแล้ว",
      };
    case "HOLIDAY_TOGGLE_NOTIFY":
      return {
        ...state,
        holidays: state.holidays.map((h) =>
          h.id === action.id ? { ...h, notify: !h.notify } : h
        ),
      };
    case "HOLIDAY_TOGGLE_REMIND":
      return { ...state, holidayRemind: !state.holidayRemind };
    case "PAY_TOGGLE":
      return { ...state, showPay: !state.showPay };
    case "REPORT_SET_TAB":
      return { ...state, reportTab: action.tab };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  go: (view: ViewKey, tab?: TabKey) => void;
  goSub: (view: ViewKey) => void;
  back: () => void;
  showToast: (msg: string) => void;
  toggleClock: () => void;
  closeGps: () => void;
  confirmGps: () => void;
  openLeave: (leaveType?: LeaveTypeKey) => void;
  openCorrection: () => void;
  updLeave: (field: keyof LeaveDraft, value: string | boolean) => void;
  leaveBack: () => void;
  leaveNext: () => void;
  setFilter: (filter: "all" | RequestStatus) => void;
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
  toggleHolidayRemind: () => void;
  togglePay: () => void;
  setReportTab: (tab: ReportTab) => void;
  doLogout: () => void;
  downloadSlip: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gpsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // clock tick
  useEffect(() => {
    const t = setInterval(() => dispatch({ type: "TICK", now: Date.now() }), 1000);
    return () => clearInterval(t);
  }, []);

  // toast auto-hide
  useEffect(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (state.toast) {
      toastTimer.current = setTimeout(() => dispatch({ type: "TOAST_HIDE" }), 2200);
    }
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [state.toast]);

  // gps locating -> ready
  useEffect(() => {
    if (gpsTimer.current) clearTimeout(gpsTimer.current);
    if (state.gps && state.gps.phase === "locating") {
      gpsTimer.current = setTimeout(() => dispatch({ type: "GPS_SET_READY" }), 1500);
    }
    return () => {
      if (gpsTimer.current) clearTimeout(gpsTimer.current);
    };
  }, [state.gps]);

  const showToast = useCallback((msg: string) => dispatch({ type: "TOAST_SHOW", msg }), []);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      go: (view, tab) => dispatch({ type: "GO", view, tab }),
      goSub: (view) => dispatch({ type: "GO_SUB", view }),
      back: () => dispatch({ type: "BACK" }),
      showToast,
      toggleClock: () => {
        const mode = !state.clockInTs ? "in" : state.clockedIn ? "out" : null;
        if (!mode) return;
        dispatch({ type: "CLOCK_START_GPS", mode });
      },
      closeGps: () => dispatch({ type: "GPS_CLOSE" }),
      confirmGps: () => dispatch({ type: "GPS_CONFIRM" }),
      openLeave: (leaveType) => dispatch({ type: "LEAVE_OPEN", leaveType }),
      openCorrection: () => dispatch({ type: "LEAVE_OPEN", leaveType: "correction" }),
      updLeave: (field, val) => dispatch({ type: "LEAVE_UPDATE", field, value: val }),
      leaveBack: () => dispatch({ type: "LEAVE_BACK" }),
      leaveNext: () => dispatch({ type: "LEAVE_NEXT" }),
      setFilter: (filter) => dispatch({ type: "SET_FILTER", filter }),
      markRead: () => dispatch({ type: "MARK_READ" }),
      setAiMode: (mode) => dispatch({ type: "AI_SET_MODE", mode }),
      setAiDept: (dept) => dispatch({ type: "AI_SET_DEPT", dept }),
      setAiRole: (role) => dispatch({ type: "AI_SET_ROLE", role }),
      setAiEmp: (emp) => dispatch({ type: "AI_SET_EMP", emp }),
      genCriteria: () => {
        if (!state.aiDept) return;
        dispatch({ type: "AI_LOADING_START" });
        mockGenCriteria(state.aiDept, state.aiRole)
          .then((result) => dispatch({ type: "AI_LOADING_DONE", result }))
          .catch(() => dispatch({ type: "AI_ERROR", error: "ไม่สามารถสร้างเกณฑ์ได้ กรุณาลองใหม่อีกครั้ง" }));
      },
      genDraft: () => {
        if (!state.aiEmp) return;
        dispatch({ type: "AI_LOADING_START" });
        mockGenDraft(state.aiEmp)
          .then((result) => dispatch({ type: "AI_LOADING_DONE", result }))
          .catch(() => dispatch({ type: "AI_ERROR", error: "ไม่สามารถร่างความเห็นได้ กรุณาลองใหม่อีกครั้ง" }));
      },
      openHoliday: () => dispatch({ type: "HOLIDAY_OPEN" }),
      closeHoliday: () => dispatch({ type: "HOLIDAY_CLOSE" }),
      updH: (field, val) => dispatch({ type: "HOLIDAY_FORM_UPDATE", field, value: val }),
      addHoliday: () => dispatch({ type: "HOLIDAY_ADD" }),
      delHoliday: (id) => dispatch({ type: "HOLIDAY_DELETE", id }),
      toggleHNotify: (id) => dispatch({ type: "HOLIDAY_TOGGLE_NOTIFY", id }),
      toggleHolidayRemind: () => dispatch({ type: "HOLIDAY_TOGGLE_REMIND" }),
      togglePay: () => dispatch({ type: "PAY_TOGGLE" }),
      setReportTab: (tab) => dispatch({ type: "REPORT_SET_TAB", tab }),
      doLogout: () => showToast("ออกจากระบบ (สาธิต)"),
      downloadSlip: () => showToast("กำลังดาวน์โหลดสลิป PDF"),
    }),
    [state, showToast]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export type { AiEmployee, LeaveTypeKey, ReportTab, RequestStatus, TabKey, ViewKey };
