/**
 * One-shot Gadget Villa org restructure plan (pure — no DB).
 *
 * Intent (HR request):
 * 1. Move Ob out of Claims into Data Engineer; Mai takes Claims.
 * 2. Note approves leave/OT for GM Jao Deng and every head under Ting / Lisha.
 * 3. Promote Transport out of Beer’s warehouse so they are separate ฝ่าย.
 */

/** Local label helper so this module stays importable from plain node checks (no @/ alias). */
function displayName(person: {
  firstName?: string | null;
  lastName?: string | null;
  nickname: string | null | undefined;
}): string {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  const nickname = person.nickname?.trim();
  return nickname ? `${name} (${nickname})` : name;
}

export type RestructurePerson = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  departmentId: string | null;
  managerId: string | null;
  positionTitle: string | null;
};

export type RestructureDept = {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
};

export type PersonMove = {
  employeeId: string;
  label: string;
  departmentId: string | null;
  managerId: string | null;
  reason: string;
};

export type DeptChange =
  | { kind: "rename"; id: string; name: string; reason: string }
  | { kind: "detach"; id: string; parentId: null; name?: string; reason: string }
  | { kind: "create"; name: string; code: string; parentId: null; reason: string };

export type RestructurePlan = {
  deptChanges: DeptChange[];
  personMoves: PersonMove[];
  unresolved: string[];
  notes: string[];
};

const nick = (p: RestructurePerson) => (p.nickname ?? "").trim();
const labelOf = (p: RestructurePerson) => displayName(p);

/** Nickname / short-name tokens used on the live org chart. */
export const PEOPLE_ALIASES = {
  ob: ["โอ๊ป", "โอ๊บ", "ธนวัตร มัณฑนานนท์", "oab", "ob"],
  // ชัยณรงค์ เลาหโกญจน ใหม่ (บัญชี), ผจก.ฝ่ายบัญชีและการเงิน.
  mai: ["ใหม่ (บัญชี)", "ชัยณรงค์ เลาหโกญจน"],
  // จุฑามาส เลื่อนศักดิ์ (โน๊ต), จนท.ฝ่ายบุคคล. Not จักรพงศ์ (โน้ต), head of accounting & finance.
  note: ["จุฑามาส เลื่อนศักดิ์", "โน๊ต"],
  ting: ["เติ้ง", "วีรวรรณ สุกณาวรรณ", "ting"],
  lisha: ["Elisa", "ลิช่า", "ลิชา", "Miss.Ho Yi-Hsuan", "lisha"],
  beer: ["เบียร์รับเข้า", "วันชัย ไชยหงษ์", "เบียร์", "beer"],
  // เมธา ทองหมี (เจา), จนท.ฝ่ายขนส่ง.
  jaoDeng: ["เมธา ทองหมี", "เจา", "เจาเด้ง", "เจ้าเด้ง"],
} as const;

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

/** True when nickname or full name matches any alias (exact after normalize). */
export function matchesAlias(person: RestructurePerson, aliases: readonly string[]): boolean {
  const n = norm(nick(person));
  const full = norm(`${person.firstName}${person.lastName}`);
  const fullSpaced = norm(`${person.firstName} ${person.lastName}`);
  const first = norm(person.firstName);
  for (const a of aliases) {
    const key = norm(a);
    if (!key) continue;
    // Exact only — substring would match "หัวเติ้ง" when looking for "เติ้ง".
    if (n === key || full === key || fullSpaced === key || first === key) return true;
  }
  return false;
}

function findOne(
  people: RestructurePerson[],
  aliases: readonly string[],
  role: string,
  unresolved: string[],
): RestructurePerson | null {
  const hits = people.filter((p) => matchesAlias(p, aliases));
  if (hits.length === 1) return hits[0]!;
  if (hits.length === 0) {
    unresolved.push(`ไม่พบ${role} (ลองชื่อเล่น: ${aliases.join(", ")})`);
    return null;
  }
  unresolved.push(
    `พบ${role}หลายคน: ${hits.map(labelOf).join(", ")} — ระบุชื่อเล่นให้ชัดก่อนรัน`,
  );
  return null;
}

function deptByName(depts: RestructureDept[], re: RegExp): RestructureDept | undefined {
  return depts.find((d) => re.test(d.name));
}

function claimsDept(depts: RestructureDept[]): RestructureDept | undefined {
  // Prefer the claims sub-dept over the combined "เซอร์วิสและเคลม" parent.
  return (
    depts.find((d) => /เคลม/.test(d.name) && !/เซอร์วิส/.test(d.name)) ??
    deptByName(depts, /เคลม/) ??
    deptByName(depts, /claim/i)
  );
}

function transportDept(depts: RestructureDept[]): RestructureDept | undefined {
  // Prefer the dedicated transport unit — not the combined "คลัง…และขนส่ง" root.
  return (
    depts.find((d) => /ขนส่ง/.test(d.name) && !/คลัง/.test(d.name)) ??
    depts.find((d) => /^แผนกขนส่ง/.test(d.name.trim()))
  );
}

function warehouseRoot(depts: RestructureDept[]): RestructureDept | undefined {
  return (
    depts.find((d) => /คลัง.*ขนส่ง|ขนส่ง.*คลัง|Logistics/i.test(d.name) && !d.parentId) ??
    depts.find((d) => /คลังสินค้า/.test(d.name) && !d.parentId)
  );
}

function dataEngineerDept(depts: RestructureDept[]): RestructureDept | undefined {
  return depts.find((d) => /data\s*engineer|ดาต้า\s*เอนจิน|ดาต้าเอนจี/i.test(d.name));
}

/** Everyone who eventually reports to `rootId` (not including root). */
export function descendantsOf(
  rootId: string,
  people: RestructurePerson[],
): RestructurePerson[] {
  const byManager = new Map<string, RestructurePerson[]>();
  for (const p of people) {
    if (!p.managerId || p.managerId === p.id) continue;
    const list = byManager.get(p.managerId) ?? [];
    list.push(p);
    byManager.set(p.managerId, list);
  }
  const out: RestructurePerson[] = [];
  const stack = [...(byManager.get(rootId) ?? [])];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur.id)) continue;
    seen.add(cur.id);
    out.push(cur);
    for (const c of byManager.get(cur.id) ?? []) stack.push(c);
  }
  return out;
}

/** People in `scope` who have at least one direct report (anywhere in the company). */
export function headsInScope(
  scope: RestructurePerson[],
  everyone: RestructurePerson[],
): RestructurePerson[] {
  const scopeIds = new Set(scope.map((p) => p.id));
  const reportCount = new Map<string, number>();
  for (const p of everyone) {
    if (!p.managerId || p.managerId === p.id) continue;
    reportCount.set(p.managerId, (reportCount.get(p.managerId) ?? 0) + 1);
  }
  return scope.filter((p) => (reportCount.get(p.id) ?? 0) > 0 && scopeIds.has(p.id));
}

/**
 * Build the restructure plan from live rows. Does not mutate input.
 * Creates a Data Engineer department when missing (code DATA-ENG).
 */
export function planOrgRestructure(
  people: RestructurePerson[],
  depts: RestructureDept[],
): RestructurePlan {
  const unresolved: string[] = [];
  const notes: string[] = [];
  const deptChanges: DeptChange[] = [];
  const personMoves: PersonMove[] = [];

  const ob = findOne(people, PEOPLE_ALIASES.ob, "พี่โอ๊บ", unresolved);
  const mai = findOne(people, PEOPLE_ALIASES.mai, "พี่ใหม่", unresolved);
  const note = findOne(people, PEOPLE_ALIASES.note, "พี่โน๊ต", unresolved);
  const ting = findOne(people, PEOPLE_ALIASES.ting, "พี่เติ้ง", unresolved);
  const lisha = findOne(people, PEOPLE_ALIASES.lisha, "พี่ลิช่า", unresolved);
  const beer = findOne(people, PEOPLE_ALIASES.beer, "พี่เบียร์", unresolved);
  const jaoDeng = findOne(people, PEOPLE_ALIASES.jaoDeng, "GM เจาเด้ง", unresolved);

  // —— 1) Split ขนส่ง from Beer’s warehouse ——
  const whRoot = warehouseRoot(depts);
  const transport = transportDept(depts);
  if (transport) {
    if (transport.parentId) {
      const newName = /แผนก/.test(transport.name)
        ? transport.name.replace(/^แผนก/, "ฝ่าย")
        : transport.name;
      deptChanges.push({
        kind: "detach",
        id: transport.id,
        parentId: null,
        name: newName !== transport.name ? newName : undefined,
        reason: "แยกฝ่ายขนส่งออกจากทีมคลังพี่เบียร์",
      });
    } else {
      notes.push(`ฝ่ายขนส่ง (${transport.name}) เป็น root อยู่แล้ว — ไม่ต้องแยก`);
    }
  } else {
    unresolved.push("ไม่พบแผนก/ฝ่ายขนส่ง");
  }
  if (whRoot && /และ\s*ขนส่ง|Logistics/i.test(whRoot.name)) {
    deptChanges.push({
      kind: "rename",
      id: whRoot.id,
      name: whRoot.name
        .replace(/\s*และ\s*ขนส่ง/g, "")
        .replace(/\s*&\s*Warehouse/i, "")
        .replace(/Logistics\s*&\s*Warehouse/i, "ฝ่ายคลังสินค้า")
        .trim() || "ฝ่ายคลังสินค้า",
      reason: "ตัดคำว่าขนส่งออกจากชื่อฝ่ายคลัง",
    });
  } else if (whRoot) {
    notes.push(`ฝ่ายคลัง (${whRoot.name}) ไม่มีคำว่าขนส่งในชื่อแล้ว`);
  }
  if (beer) notes.push(`พี่เบียร์อยู่ที่: ${labelOf(beer)} — คลังยังเป็นทีมเดิม`);

  // Warehouse online / offline groups: Thai suffix to match the position titles
  // (พนักงานคลังสินค้า-ออนไลน์ / -ออฟไลน์), and ฝ่าย instead of แผนก.
  for (const [pattern, suffix] of [
    [/online|ออนไลน์/i, "ออนไลน์"],
    [/offline|ออฟไลน์/i, "ออฟไลน์"],
  ] as const) {
    const d = depts.find((x) => /คลังสินค้า/.test(x.name) && pattern.test(x.name));
    if (!d) continue;
    const name = `ฝ่ายคลังสินค้า ${suffix}`;
    if (d.name !== name) {
      deptChanges.push({
        kind: "rename",
        id: d.id,
        name,
        reason: `เรียกกลุ่มคลัง ${suffix} เป็นภาษาไทยและเป็นฝ่าย`,
      });
    }
  }

  // —— 2) Data Engineer home for Ob ——
  const dataDept = dataEngineerDept(depts);
  if (!dataDept) {
    deptChanges.push({
      kind: "create",
      name: "ฝ่าย Data Engineer",
      code: "DATA-ENG",
      parentId: null,
      reason: "ยังไม่มีฝ่าย Data Engineer ในระบบ",
    });
    notes.push("จะสร้างฝ่าย Data Engineer (รหัส DATA-ENG) แล้วค่อยย้ายพี่โอ๊บ");
  }

  const claims = claimsDept(depts);
  if (!claims) unresolved.push("ไม่พบแผนกเคลม");

  // Placeholder id for create — apply script replaces after insert.
  const dataDeptId = dataDept?.id ?? "__CREATE_DATA_ENG__";

  if (ob) {
    personMoves.push({
      employeeId: ob.id,
      label: labelOf(ob),
      departmentId: dataDeptId,
      managerId: ob.managerId,
      reason: "ย้ายพี่โอ๊บออกจากเคลมไป Data Engineer",
    });
  }
  if (mai && claims && mai.departmentId !== claims.id) {
    notes.push(
      `${labelOf(mai)} เป็นหัวหน้าทั้งฝ่ายบัญชีและฝ่ายเคลม — ไม่ย้ายแผนกของเขา แค่ให้ลูกน้องเคลมขึ้นตรงกับเขา`,
    );
  }

  // Claims people who reported to Ob → report to Mai, who keeps his accounting department.
  if (ob && mai && claims) {
    for (const p of people) {
      if (p.id === ob.id || p.id === mai.id) continue;
      if (p.managerId === ob.id && p.departmentId === claims.id) {
        personMoves.push({
          employeeId: p.id,
          label: labelOf(p),
          departmentId: p.departmentId,
          managerId: mai.id,
          reason: "ลูกน้องเคลมที่เคยขึ้นกับพี่โอ๊บ → ขึ้นกับพี่ใหม่",
        });
      }
    }
  }

  // —— 3) Note as approver (managerId) ——
  if (note) {
    const setNote = (p: RestructurePerson, reason: string) => {
      if (p.id === note.id) return;
      if (p.managerId === note.id) {
        notes.push(`${labelOf(p)} มีพี่โน๊ตเป็นหัวหน้าอยู่แล้ว`);
        return;
      }
      const existing = personMoves.find((m) => m.employeeId === p.id);
      if (existing) {
        existing.managerId = note.id;
        existing.reason = `${existing.reason}; ${reason}`;
        return;
      }
      personMoves.push({
        employeeId: p.id,
        label: labelOf(p),
        departmentId: p.departmentId,
        managerId: note.id,
        reason,
      });
    };

    if (jaoDeng) setNote(jaoDeng, "GM เจาเด้ง — ให้พี่โน๊ตกดอนุมัติ");

    if (ting) {
      const under = descendantsOf(ting.id, people);
      const heads = headsInScope(under, people);
      if (heads.length === 0) {
        notes.push(`ไม่พบหัวหน้าภายใต้พี่เติ้ง (${labelOf(ting)}) — ไม่มีการเปลี่ยน`);
      } else {
        for (const h of heads) setNote(h, `หัวหน้าภายใต้พี่เติ้ง → พี่โน๊ตกดให้`);
      }
    }
    if (lisha) {
      const under = descendantsOf(lisha.id, people);
      const heads = headsInScope(under, people);
      // Lisha’s division may be flat (no nested heads): then every direct report who
      // is a “head” elsewhere, or if nobody has reports, set Note on people who
      // currently report to Lisha and hold a manager-level title — else all direct reports.
      if (heads.length === 0) {
        const directs = people.filter((p) => p.managerId === lisha.id);
        if (directs.length === 0) {
          notes.push(`พี่ลิช่า (${labelOf(lisha)}) ไม่มีลูกน้องในสาย — ไม่มีการเปลี่ยน`);
        } else {
          // Flat purchase team: treat each direct report as needing Note to approve
          // only when they themselves have reports; otherwise leave reporting as-is
          // and still set Note as manager for people titled ผู้จัดการ under Lisha.
          const mgrTitle = directs.filter((p) => /ผจก|ผู้จัดการ|manager|head/i.test(p.positionTitle ?? ""));
          const targets = mgrTitle.length > 0 ? mgrTitle : directs;
          for (const t of targets) setNote(t, `ภายใต้พี่ลิช่า → พี่โน๊ตกดให้`);
        }
      } else {
        for (const h of heads) setNote(h, `หัวหน้าภายใต้พี่ลิช่า → พี่โน๊ตกดให้`);
      }
    }
  }

  return { deptChanges, personMoves, unresolved, notes };
}
