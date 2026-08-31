export function LoginHelpText() {
  return (
    <p className="text-center text-sm text-[var(--login-text-secondary)]">
      หากคุณมีปัญหาในการเข้าสู่ระบบ กรุณาติดต่อฝ่ายสนับสนุน
      <br />
      หรืออีเมล{" "}
      <a href="mailto:support@gvone.com" className="font-medium text-[var(--login-brand-green)] hover:underline">
        support@gvone.com
      </a>
    </p>
  );
}
