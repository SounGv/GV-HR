import { AppProvider } from "@/context/AppContext";
import { EmployeeApp } from "@/components/EmployeeApp";

export default function Page() {
  return (
    <AppProvider>
      <EmployeeApp />
    </AppProvider>
  );
}
