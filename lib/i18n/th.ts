export const th = {
  common: {
    cancel: "ยกเลิก",
    delete: "ลบ",
    retry: "ลองใหม่",
    save: "บันทึก",
  },
  auth: {
    badCredentials: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    badEmail: "อีเมลไม่ถูกต้อง",
    confirmSent: "ส่งลิงก์ยืนยันไปที่อีเมลแล้ว เปิดลิงก์เพื่อเข้าใช้งาน",
    confirmPassword: "ยืนยันรหัสผ่านใหม่",
    continueWithGoogle: "ดำเนินการต่อด้วย Google",
    email: "อีเมล",
    emailAlreadyRegistered: "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน",
    forgotBody: "กรอกอีเมลที่ใช้สมัคร แล้วระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่",
    forgotLink: "ลืมรหัสผ่าน?",
    forgotTitle: "Forgot password",
    googleError: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองใหม่อีกครั้ง",
    loginBody: "เข้าสู่ระบบเพื่อดูเวิร์คเอาท์ของวันนี้",
    loginSubmit: "เข้าสู่ระบบ",
    loginTitle: "Login",
    newPassword: "รหัสผ่านใหม่",
    noAccount: "ยังไม่มีบัญชี?",
    or: "หรือ",
    password: "รหัสผ่าน",
    passwordMismatch: "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
    passwordTooShort: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร",
    resetExpired: "ลิงก์หมดอายุแล้ว ขอลิงก์ใหม่อีกครั้ง",
    resetFailed: "ตั้งรหัสผ่านใหม่ไม่สำเร็จ ลองใหม่อีกครั้ง",
    resetSent: "ถ้าอีเมลนี้มีบัญชีอยู่ ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว",
    resetSubmit: "ตั้งรหัสผ่านใหม่",
    resetTitle: "Reset password",
    sendReset: "ส่งลิงก์ตั้งรหัสผ่านใหม่",
    signInCta: "เข้าสู่ระบบ",
    signUpBody: "สร้างบัญชีเพื่อเริ่มบันทึกการฝึกของคุณ",
    signUpCta: "สมัครใช้งาน",
    signUpSubmit: "สมัครใช้งาน",
    signUpTitle: "Sign up",
    submitPending: "กำลังดำเนินการ...",
    signupFailed: "สมัครไม่สำเร็จ ลองใหม่อีกครั้ง",
    hasAccount: "มีบัญชีอยู่แล้ว?",
  },
  today: {
    emptySet: "กรอกอย่างน้อยหนึ่งค่าก่อนบันทึก",
    requiredSetValue: "กรอกค่าที่จำเป็นของท่านี้ก่อนบันทึก",
  },
} as const;

type WidenStrings<T> = {
  [K in keyof T]: T[K] extends string ? string : WidenStrings<T[K]>;
};

export type Dict = WidenStrings<typeof th>;
export type AuthMessageKey = keyof typeof th.auth;
