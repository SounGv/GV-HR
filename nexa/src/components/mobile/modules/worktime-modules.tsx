"use client";

import { useState } from "react";
import { MobileScreen } from "../mobile-screen";
import { MobilePrimaryButton } from "../mobile-action-footer";
import {
  type DemoState,
  MobileBlockedAlert,
  MobileCameraPlaceholder,
  MobileDevNote,
  MobileDisabledButton,
  MobileFieldLabel,
  MobileInRangeHint,
  MobileModuleCard,
  MobileModuleLayout,
  MobileOutOfRangeAlert,
  MobileSelectBox,
  MobileSuccessScreen,
  MobileUploadZone,
} from "../mobile-ui";

export function MobileCheckinModule() {
  const [demo, setDemo] = useState<DemoState>("normal");

  return (
    <MobileScreen title="สแกนเข้า-ออกงาน" backHref="/services" contentClassName="flex flex-col p-0">
      <MobileModuleLayout
        demo={demo}
        onDemoChange={setDemo}
        demoLabels={{ blocked: "นอกพื้นที่", success: "สำเร็จ" }}
        success={
          <MobileSuccessScreen
            title="เช็คอินสำเร็จ"
            subtitle="บันทึกเวลาเข้างานเรียบร้อย"
            rows={[
              { label: "เวลา", value: "08:57 น." },
              { label: "สถานที่", value: "สำนักงานใหญ่" },
              { label: "สถานะ", value: "ตรงเวลา", highlight: true },
            ]}
          />
        }
        blocked={<MobileOutOfRangeAlert distance="640 เมตร" radius="150 ม." />}
        devNote="ต้องเชื่อม GPS/Geofence จริงและกล้องสแกน QR จริง ปัจจุบันเป็นภาพจำลอง"
        footer={
          demo === "blocked" ? (
            <MobileDisabledButton>อยู่นอกพื้นที่ — เช็คอินไม่ได้</MobileDisabledButton>
          ) : (
            <MobilePrimaryButton onClick={() => setDemo("success")}>
              ถ่ายรูป &amp; เช็คอิน
            </MobilePrimaryButton>
          )
        }
      >
        <MobileModuleCard>
          <MobileCameraPlaceholder />
          <MobileInRangeHint distance="42 ม." />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            เวลาปัจจุบัน 08:57 น. — แตะปุ่มด้านล่างเพื่อถ่ายรูปและบันทึกตำแหน่งพร้อมกัน
          </p>
        </MobileModuleCard>
        <MobileDevNote>
          1 คลิกต้องเรียกกล้องถ่ายเซลฟี่ + อ่านพิกัด GPS จริงพร้อมกัน แล้วส่งขึ้น backend ทันที
        </MobileDevNote>
      </MobileModuleLayout>
    </MobileScreen>
  );
}

export function MobileTimeEditModule() {
  const [demo, setDemo] = useState<DemoState>("normal");

  return (
    <MobileScreen title="แก้เวลาเข้า-ออกงาน" backHref="/services" contentClassName="flex flex-col p-0">
      <MobileModuleLayout
        demo={demo}
        onDemoChange={setDemo}
        success={
          <MobileSuccessScreen
            title="ส่งคำขอแก้ไขเวลาสำเร็จ"
            subtitle="รอหัวหน้างานอนุมัติ"
          />
        }
        blocked={
          <MobileBlockedAlert>
            มีคำขอแก้ไขเวลาของวันที่ 5 ส.ค. อยู่ระหว่างรออนุมัติแล้ว ส่งซ้ำไม่ได้จนกว่าคำขอเดิมจะได้รับการพิจารณา
          </MobileBlockedAlert>
        }
        footer={
          demo === "blocked" ? (
            <MobileDisabledButton>มีคำขอค้างอยู่ — ส่งซ้ำไม่ได้</MobileDisabledButton>
          ) : (
            <MobilePrimaryButton onClick={() => setDemo("success")}>
              ส่งคำขอแก้ไขเวลา
            </MobilePrimaryButton>
          )
        }
      >
        <MobileModuleCard>
          <MobileFieldLabel>วันที่ต้องการแก้ไข</MobileFieldLabel>
          <MobileSelectBox value="5 สิงหาคม 2569" className="mb-4" />
          <div className="mb-4 grid grid-cols-2 gap-2">
            <MobileSelectBox label="เวลาเข้างานที่ถูกต้อง" value="08:55 น." />
            <MobileSelectBox label="เวลาออกงานที่ถูกต้อง" value="18:05 น." />
          </div>
          <MobileFieldLabel>เหตุผล</MobileFieldLabel>
          <MobileSelectBox value="ลืมสแกนเข้างานตอนเช้า" className="mb-4" />
          <MobileFieldLabel>แนบหลักฐาน (ถ้ามี)</MobileFieldLabel>
          <MobileUploadZone label="แตะเพื่อแนบภาพหลักฐาน" />
        </MobileModuleCard>
      </MobileModuleLayout>
    </MobileScreen>
  );
}

export function MobileShiftModule() {
  const [demo, setDemo] = useState<DemoState>("normal");

  return (
    <MobileScreen title="ตารางกะ" backHref="/services" contentClassName="flex flex-col p-0">
      <MobileModuleLayout
        demo={demo}
        onDemoChange={setDemo}
        success={
          <MobileSuccessScreen title="ส่งคำขอสลับกะสำเร็จ" subtitle="รอหัวหน้างานอนุมัติ" />
        }
        blocked={
          <MobileBlockedAlert>
            พิมพ์ชนกมีกะของตัวเองอยู่แล้วในวันที่เลือก (พุธ 6 ส.ค.) ไม่สามารถสลับกะซ้อนกันได้
            กรุณาเลือกวันอื่นหรือเพื่อนร่วมงานคนอื่น
          </MobileBlockedAlert>
        }
        footer={
          demo === "blocked" ? (
            <MobileDisabledButton>กะซ้อนกัน — เลือกใหม่</MobileDisabledButton>
          ) : (
            <MobilePrimaryButton onClick={() => setDemo("success")}>
              ส่งคำขอสลับกะ
            </MobilePrimaryButton>
          )
        }
      >
        <MobileModuleCard className="mb-3.5">
          <MobileFieldLabel>กะสัปดาห์นี้ (4–10 ส.ค.)</MobileFieldLabel>
          {[
            ["จันทร์ 4 ส.ค.", "09:00–18:00"],
            ["อังคาร 5 ส.ค.", "09:00–18:00"],
            ["พุธ 6 ส.ค.", "13:00–22:00"],
            ["เสาร์ 8 ส.ค.", "วันหยุด"],
          ].map(([day, time], i, arr) => (
            <div
              key={day}
              className={`flex justify-between py-2 text-[13px] ${i < arr.length - 1 ? "border-b border-border" : ""}`}
            >
              <span>{day}</span>
              <span className={`font-semibold ${time === "วันหยุด" ? "text-muted-foreground" : ""}`}>
                {time}
              </span>
            </div>
          ))}
        </MobileModuleCard>
        <p className="px-1 text-[13px] font-semibold text-foreground">ขอสลับกะ</p>
        <MobileModuleCard>
          <MobileFieldLabel>วันของฉันที่จะสลับ</MobileFieldLabel>
          <MobileSelectBox value="พุธ 6 ส.ค. (13:00–22:00)" className="mb-4" />
          <MobileFieldLabel>เพื่อนร่วมงานที่จะสลับด้วย</MobileFieldLabel>
          <MobileSelectBox
            value="พิมพ์ชนก แสงทอง — จันทร์ 4 ส.ค. (09:00–18:00)"
            className="mb-4"
          />
          <MobileFieldLabel>เหตุผล</MobileFieldLabel>
          <MobileSelectBox value="ติดธุระส่วนตัวช่วงเย็นวันพุธ" />
        </MobileModuleCard>
      </MobileModuleLayout>
    </MobileScreen>
  );
}
