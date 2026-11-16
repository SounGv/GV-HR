/* Prints the side menu each role preset sees (groups, items, section headings) from the real navigation config. Offline, read-only. */
import { NAV_GROUPS } from "@/config/navigation";
import { ROLE_PRESETS, expandPermissions } from "@/config/permissions";

const wantName = process.argv[2];
for (const preset of ROLE_PRESETS) {
  if (wantName && preset.name !== wantName) continue;
  const perms = new Set(expandPermissions(preset.permissions));
  const can = (k: string) => perms.has(k);
  let groups = 0;
  let items = 0;
  const lines: string[] = [];
  for (const g of NAV_GROUPS) {
    const vis = g.items.filter((i) => !i.featured && can(i.permission));
    if (!vis.length) continue;
    groups++;
    items += vis.length;
    lines.push(`  ${g.label} (${vis.length})`);
    let last = "";
    for (const i of vis) {
      if (i.section && i.section !== last) lines.push(`      [${i.section}]`);
      last = i.section ?? "";
      lines.push(`      - ${i.label}`);
    }
  }
  console.log(`${preset.name}: ${groups} groups, ${items} items`);
  console.log(lines.join("\n"));
}
