import {
  Users,
  UserPlus,
  Wallet,
  CalendarDays,
  ClipboardCheck,
  Target,
  Network,
  KeyRound,
  ListChecks,
  Sparkles,
  Send,
  CheckCircle2,
  Bell,
  Coins,
  Settings2,
  Building2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { IllustrationKind } from "./step-illustration";

export interface GuideStep {
  icon: LucideIcon;
  title: string;
  detail: string;
  illustration: IllustrationKind;
  illustrationLabel?: string;
  illustrationChips?: string[];
}

export interface Guide {
  id: string;
  title: string;
  icon: LucideIcon;
  summary: string;
  href: string;
  steps: GuideStep[];
}

export const HELP_GUIDES: Guide[] = [
  {
    id: "employee",
    title: "เพิ่มพนักงานใหม่",
    icon: Users,
    summary: "บันทึกข้อมูลพนักงานเข้าระบบ พร้อมสร้างบัญชีให้เข้าใช้งานแอปได้",
    href: "/employees",
    steps: [
      {
        icon: UserPlus,
        title: "ไปที่เมนู \"พนักงาน\" แล้วกด \"+ เพิ่มพนักงาน\"",
        detail: "อยู่แถบเมนูซ้าย หมวด \"พนักงาน\"",
        illustration: "nav",
        illustrationLabel: "พนักงาน",
      },
      {
        icon: ListChecks,
        title: "กรอกข้อมูลส่วนตัว ตำแหน่ง แผนก และหัวหน้างาน",
        detail: "แบ่งเป็นแท็บ: ข้อมูลส่วนตัว / การจ้างงาน / เงินเดือน / ที่อยู่",
        illustration: "form",
      },
      {
        icon: Coins,
        title: "กรอกเงินเดือนพื้นฐานและบัญชีธนาคาร",
        detail: "จำเป็นสำหรับตอนออกรอบเงินเดือนและไฟล์โอนเงิน",
        illustration: "form",
      },
      {
        icon: CheckCircle2,
        title: "กด \"บันทึก\"",
        detail: "ระบบจะเพิ่มพนักงานเข้ารายชื่อทันที",
        illustration: "button",
        illustrationLabel: "บันทึก",
      },
      {
        icon: KeyRound,
        title: "(ถ้าต้องการ) กด \"สร้างบัญชีเข้าใช้งาน\" ที่หน้าโปรไฟล์พนักงาน",
        detail: "ตั้งอีเมล + รหัสผ่านเริ่มต้น พนักงานใช้ล็อกอินแอปได้ทันที",
        illustration: "button",
        illustrationLabel: "สร้างบัญชี",
      },
    ],
  },
  {
    id: "payroll",
    title: "ออกเงินเดือนประจำงวด",
    icon: Wallet,
    summary: "คิดเงินเดือน ภาษี ประกันสังคมให้พนักงานทั้งบริษัทอัตโนมัติ",
    href: "/payroll",
    steps: [
      {
        icon: CalendarDays,
        title: "ไปที่ \"เงินเดือนและสลิป\" แล้วเลือกงวดเดือน",
        detail: "เลือกเดือน/ปีที่ต้องการออกเงินเดือน",
        illustration: "select",
        illustrationChips: ["ส.ค. 2569", "ก.ย. 2569", "ต.ค. 2569"],
      },
      {
        icon: Sparkles,
        title: "กด \"ออก/อัปเดตรอบเงินเดือน\"",
        detail: "ระบบคิดเงินเดือน ภาษีหัก ณ ที่จ่าย ประกันสังคม ให้ทุกคนอัตโนมัติ",
        illustration: "button",
        illustrationLabel: "ออกรอบเงินเดือน",
      },
      {
        icon: ListChecks,
        title: "ตรวจสอบสลิปแต่ละคน ปรับโบนัส/หักเพิ่มได้ถ้าจำเป็น",
        detail: "กดเข้ารายการพนักงานเพื่อเพิ่มรายการพิเศษก่อนปิดงวด",
        illustration: "review",
      },
      {
        icon: CheckCircle2,
        title: "กด \"จ่ายแล้ว\" หลังโอนเงินจริง แล้ว \"ปิดงวด\"",
        detail: "ปิดงวดแล้วแก้ไขไม่ได้อีก กันข้อมูลเพี้ยนย้อนหลัง",
        illustration: "button",
        illustrationLabel: "ปิดงวด",
      },
    ],
  },
  {
    id: "requests",
    title: "อนุมัติคำขอ (ลา / OT / แก้เวลา)",
    icon: ClipboardCheck,
    summary: "ตรวจและอนุมัติคำขอลา ขอทำงานล่วงเวลา หรือขอแก้เวลาเข้า-ออกงาน",
    href: "/requests",
    steps: [
      {
        icon: Bell,
        title: "เปิดจากกระดิ่งแจ้งเตือน หรือเมนู \"การลา\" / \"ล่วงเวลา (OT)\"",
        detail: "มีคำขอใหม่จะมีตัวเลขแจ้งเตือนบนไอคอน",
        illustration: "notify",
      },
      {
        icon: ListChecks,
        title: "ดูรายละเอียดคำขอ วันที่ เหตุผล เอกสารแนบ",
        detail: "กดเข้ารายการเพื่อดูข้อมูลเต็มก่อนตัดสินใจ",
        illustration: "review",
      },
      {
        icon: CheckCircle2,
        title: "กด \"อนุมัติ\" หรือ \"ไม่อนุมัติ\" พร้อมระบุเหตุผล",
        detail: "พนักงานจะได้รับแจ้งเตือนผลการอนุมัติทันที",
        illustration: "button",
        illustrationLabel: "อนุมัติ",
      },
    ],
  },
  {
    id: "campaign",
    title: "สร้างรอบประเมินผลงาน",
    icon: Target,
    summary: "ตั้งรอบประเมิน เลือกผู้ประเมิน แบบประเมิน แล้วเผยแพร่ให้พนักงาน",
    href: "/performance",
    steps: [
      {
        icon: Sparkles,
        title: "ไปที่ \"ประเมินผลงาน\" กด \"+ สร้างรอบประเมิน\"",
        detail: "เริ่มตัวช่วยสร้างรอบประเมินทีละขั้นตอน",
        illustration: "nav",
        illustrationLabel: "ประเมินผลงาน",
      },
      {
        icon: UsersRound,
        title: "เลือกกลุ่มพนักงาน — ทั้งบริษัท / แผนก / ทีม / เลือกเอง",
        detail: "ระบบจะดึงรายชื่อพนักงานตามเงื่อนไขที่เลือกให้อัตโนมัติ",
        illustration: "select",
        illustrationChips: ["ทั้งบริษัท", "แผนก", "เลือกเอง"],
      },
      {
        icon: Network,
        title: "เลือกผู้ประเมิน — ตนเอง / หัวหน้า / เพื่อนร่วมงาน",
        detail: "เลือกได้มากกว่า 1 แบบต่อรอบประเมิน",
        illustration: "select",
        illustrationChips: ["หัวหน้า", "ตนเอง", "เพื่อนร่วมงาน"],
      },
      {
        icon: ListChecks,
        title: "เลือกแบบประเมินที่มีอยู่ หรือสร้างใหม่",
        detail: "แก้ไขหัวข้อ/คำถามได้ก่อนเผยแพร่จริง",
        illustration: "form",
      },
      {
        icon: Send,
        title: "ตรวจตัวอย่างแล้วกด \"เผยแพร่\"",
        detail: "พนักงานที่เกี่ยวข้องจะได้รับแจ้งเตือนให้เริ่มประเมินทันที",
        illustration: "button",
        illustrationLabel: "เผยแพร่",
      },
    ],
  },
  {
    id: "organization",
    title: "จัดการโครงสร้างองค์กร",
    icon: Building2,
    summary: "เพิ่ม/แก้ไขแผนก ตำแหน่ง สาขา และสายการบังคับบัญชา",
    href: "/organization",
    steps: [
      {
        icon: Network,
        title: "ไปที่เมนู \"โครงสร้างองค์กร\"",
        detail: "อยู่หมวด \"องค์กร\" แถบเมนูซ้าย",
        illustration: "nav",
        illustrationLabel: "โครงสร้างองค์กร",
      },
      {
        icon: ListChecks,
        title: "เพิ่ม/แก้ไขแผนก ตำแหน่ง หรือสาขา",
        detail: "กด \"+ เพิ่ม\" ในแท็บที่ต้องการแก้ไข",
        illustration: "form",
      },
      {
        icon: Settings2,
        title: "กำหนดหัวหน้างานให้พนักงานแต่ละคน",
        detail: "ทำได้จากหน้าโปรไฟล์พนักงาน หรือหน้าโครงสร้างองค์กร",
        illustration: "select",
        illustrationChips: ["ผจก.ฝ่ายขาย", "หัวหน้าทีม", "ไม่มี"],
      },
      {
        icon: CheckCircle2,
        title: "กด \"บันทึก\"",
        detail: "การเปลี่ยนแปลงมีผลทันที และกระทบผังองค์กรที่แสดงในระบบ",
        illustration: "button",
        illustrationLabel: "บันทึก",
      },
    ],
  },
];
