import type { AiCriteriaResult, AiDraftResult, AiEmployee } from "./types";

// Mocked "AI" generation — this prototype has no backend/LLM wired up yet, so
// department/employee-specific results are assembled from canned building
// blocks instead of a real model call.

const deptCompetencyBank: Record<string, { name: string; indicators: string[] }[]> = {
  บริหาร: [
    { name: "ภาวะผู้นำ", indicators: ["มอบหมายงานชัดเจน", "โค้ชทีมงานสม่ำเสมอ"] },
    { name: "การตัดสินใจเชิงกลยุทธ์", indicators: ["วิเคราะห์ข้อมูลก่อนตัดสินใจ", "รับผิดชอบผลลัพธ์"] },
    { name: "การสื่อสารกับผู้บริหาร", indicators: ["รายงานตรงประเด็น", "สื่อสารทั้งข่าวดีและปัญหา"] },
  ],
  ฝ่ายขาย: [
    { name: "ทักษะการปิดการขาย", indicators: ["เข้าใจความต้องการลูกค้า", "ปิดยอดตามเป้าหมาย"] },
    { name: "การดูแลลูกค้าสัมพันธ์", indicators: ["ติดตามลูกค้าหลังการขาย", "รักษาฐานลูกค้าเดิม"] },
    { name: "ความรู้ผลิตภัณฑ์", indicators: ["อธิบายสเปกสินค้าได้ถูกต้อง", "แนะนำสินค้าทดแทนได้"] },
  ],
  การตลาด: [
    { name: "ความคิดสร้างสรรค์", indicators: ["นำเสนอแคมเปญใหม่ๆ", "ปรับเนื้อหาให้เข้ากับกลุ่มเป้าหมาย"] },
    { name: "การวิเคราะห์ข้อมูล", indicators: ["อ่านผล engagement ได้", "ปรับกลยุทธ์จากข้อมูลจริง"] },
    { name: "การบริหารแคมเปญ", indicators: ["ควบคุมงบประมาณ", "ส่งมอบตรงเวลา"] },
  ],
  คลังสินค้า: [
    { name: "ความแม่นยำในการทำงาน", indicators: ["หยิบ/แพ็คสินค้าถูกต้อง", "ตรวจนับสต็อกไม่ผิดพลาด"] },
    { name: "ความปลอดภัยในการทำงาน", indicators: ["ปฏิบัติตามกฎความปลอดภัย", "ใช้อุปกรณ์ป้องกันถูกต้อง"] },
    { name: "การทำงานเป็นทีม", indicators: ["ช่วยเหลือเพื่อนร่วมงาน", "ประสานงานข้ามกะได้ดี"] },
  ],
  บัญชี: [
    { name: "ความละเอียดรอบคอบ", indicators: ["ตรวจสอบเอกสารก่อนบันทึก", "ไม่มีข้อผิดพลาดซ้ำ"] },
    { name: "การปฏิบัติตามกฎระเบียบ", indicators: ["ปิดงบตรงตามกำหนด", "ปฏิบัติตามมาตรฐานบัญชี"] },
    { name: "การสื่อสารกับหน่วยงานอื่น", indicators: ["ตอบคำถามการเงินได้ชัดเจน", "ประสานงานกับผู้ตรวจสอบ"] },
  ],
  จัดซื้อ: [
    { name: "การเจรจาต่อรอง", indicators: ["ได้ราคา/เงื่อนไขที่ดีขึ้น", "รักษาความสัมพันธ์กับซัพพลายเออร์"] },
    { name: "การบริหารซัพพลายเชน", indicators: ["สั่งซื้อทันเวลา", "ไม่มีสินค้าขาดสต็อก"] },
    { name: "ความโปร่งใส", indicators: ["บันทึกเอกสารครบถ้วน", "ปฏิบัติตามขั้นตอนจัดซื้อ"] },
  ],
  บริการลูกค้า: [
    { name: "การแก้ปัญหาให้ลูกค้า", indicators: ["แก้ไขปัญหาตั้งแต่ครั้งแรก", "ติดตามจนลูกค้าพอใจ"] },
    { name: "ความอดทนและอารมณ์", indicators: ["รับมือลูกค้าไม่พอใจได้ดี", "รักษามารยาทเสมอ"] },
    { name: "ความรวดเร็วในการตอบกลับ", indicators: ["ตอบแชท/สายภายในเวลาที่กำหนด", "ปิดเคสตรงเวลา"] },
  ],
  ไอที: [
    { name: "ความเสถียรของระบบ", indicators: ["ลด downtime", "แก้ปัญหาเชิงรุกก่อนเกิดผลกระทบ"] },
    { name: "การแก้ปัญหาเชิงเทคนิค", indicators: ["วิเคราะห์ root cause ได้", "แก้ไขได้ตรงจุด"] },
    { name: "การสื่อสารกับผู้ใช้งาน", indicators: ["อธิบายปัญหาทางเทคนิคให้เข้าใจง่าย", "อัปเดตความคืบหน้าสม่ำเสมอ"] },
  ],
};

const deptKpiBank: Record<string, { name: string; target: string }[]> = {
  บริหาร: [
    { name: "ผลประกอบการทีม", target: "บรรลุเป้าหมายรายไตรมาส" },
    { name: "อัตราการรักษาพนักงาน", target: "≥ 90% ต่อปี" },
    { name: "ความพึงพอใจของทีม", target: "≥ 4.0/5" },
  ],
  ฝ่ายขาย: [
    { name: "ยอดขายรายเดือน", target: "≥ 100% ของเป้า" },
    { name: "ลูกค้าใหม่ต่อเดือน", target: "≥ 8 ราย" },
    { name: "อัตราการปิดการขาย", target: "≥ 30%" },
  ],
  การตลาด: [
    { name: "Engagement Rate", target: "≥ 5%" },
    { name: "จำนวนลีดที่สร้างได้", target: "≥ 150 ลีด/เดือน" },
    { name: "งบประมาณเทียบผลลัพธ์ (ROI)", target: "≥ 2 เท่า" },
  ],
  คลังสินค้า: [
    { name: "Productivity · ชิ้น/ชั่วโมง", target: "≥ 60 ชิ้น/ชม." },
    { name: "ความแม่นยำการหยิบสินค้า", target: "≥ 99%" },
    { name: "อัตราการมาทำงาน", target: "≥ 95%" },
  ],
  บัญชี: [
    { name: "ปิดงบตรงเวลา", target: "100% ภายในวันที่ 5" },
    { name: "ความถูกต้องของรายงาน", target: "ไม่มีข้อผิดพลาด" },
    { name: "รอบเวลาเบิกจ่าย", target: "≤ 3 วันทำการ" },
  ],
  จัดซื้อ: [
    { name: "ต้นทุนที่ลดได้", target: "≥ 5% ต่อปี" },
    { name: "ระยะเวลาจัดซื้อเฉลี่ย", target: "≤ 5 วันทำการ" },
    { name: "อัตราสินค้าขาดสต็อก", target: "≤ 1%" },
  ],
  บริการลูกค้า: [
    { name: "คะแนนความพึงพอใจ (CSAT)", target: "≥ 4.5/5" },
    { name: "เวลาตอบกลับเฉลี่ย", target: "≤ 5 นาที" },
    { name: "อัตราการแก้ปัญหาครั้งแรก", target: "≥ 85%" },
  ],
  ไอที: [
    { name: "System Uptime", target: "≥ 99.5%" },
    { name: "เวลาปิด Ticket เฉลี่ย", target: "≤ 4 ชั่วโมง" },
    { name: "โครงการที่ส่งมอบตรงเวลา", target: "≥ 90%" },
  ],
};

function splitWeights(count: number): number[] {
  const base = Math.floor(100 / count);
  const weights = Array(count).fill(base);
  weights[0] += 100 - base * count;
  return weights;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockGenCriteria(dept: string, role: string): Promise<AiCriteriaResult> {
  await delay(1400);
  const comps = deptCompetencyBank[dept] || deptCompetencyBank["คลังสินค้า"];
  const kpis = deptKpiBank[dept] || deptKpiBank["คลังสินค้า"];
  // weights across competencies + KPIs must sum to exactly 100
  const allWeights = splitWeights(comps.length + kpis.length);
  const compWeights = allWeights.slice(0, comps.length);
  const kpiWeights = allWeights.slice(comps.length);
  const roleNote = role ? `สำหรับตำแหน่ง "${role}" ` : "";
  return {
    type: "criteria",
    summary: `เกณฑ์ประเมิน${roleNote}แผนก${dept} เน้นสมรรถนะและ KPI ที่วัดผลได้จริง เหมาะกับลักษณะงานเฉพาะของแผนกนี้`,
    competencies: comps.map((c, i) => ({ name: c.name, weight: compWeights[i], indicators: c.indicators })),
    kpis: kpis.map((k, i) => ({ name: k.name, weight: kpiWeights[i], target: k.target })),
  };
}

export async function mockGenDraft(emp: AiEmployee): Promise<AiDraftResult> {
  await delay(1400);
  return {
    type: "draft",
    overall: "ผลงานโดยรวม: ดีเยี่ยม (Exceeds Expectations)",
    strengths: [
      `${emp.name} แสดงผลงานที่โดดเด่นในแผนก${emp.dept} ตลอดรอบการประเมิน`,
      "ทำงานได้ตามเป้าหมายอย่างสม่ำเสมอและรักษาคุณภาพงาน",
      "ได้รับความไว้วางใจจากทีมและหัวหน้างานในการดูแลงานสำคัญ",
    ],
    improvements: [
      "ควรพัฒนาทักษะการสื่อสารกับทีมข้ามแผนกให้ราบรื่นยิ่งขึ้น",
      "บริหารเวลาในงานที่มีหลายโปรเจกต์พร้อมกันให้มีประสิทธิภาพมากขึ้น",
    ],
    development: [
      "เข้าร่วมอบรมทักษะการสื่อสารและการนำเสนอ",
      "มอบหมายโครงการที่ต้องประสานงานข้ามแผนกเพื่อฝึกฝนเพิ่มเติม",
    ],
    summary: `${emp.name} เป็นพนักงานที่มีศักยภาพสูงในแผนก${emp.dept} ผลงานในรอบนี้อยู่ในเกณฑ์ดีเยี่ยม ควรได้รับการสนับสนุนด้านการพัฒนาทักษะการสื่อสารเพื่อต่อยอดสู่บทบาทที่สูงขึ้นในอนาคต`,
  };
}
