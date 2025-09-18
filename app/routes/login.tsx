import { useState } from "react"

export default function Login() {
  const [error, setError] = useState('');
  return (
    <>
      <div className="h-full flex flex-col">
        <p className="title py-6 h-fit text-center text-6xl select-none">
          مــفـــتــقــد
        </p>
        <div className="flex flex-col justify-center size-full">
          <div className="flex flex-col items-center justify-center">
            <form className="flex flex-col gap-2.5 w-5/7 lg:w-3/7">
              <input className="dark:bg-main text-main-comp lg:h-10 h-12 rounded-md p-2" dir="auto" type="text" name="username" placeholder="اسم المستخدم"/>
              <input className="dark:bg-main text-main-comp lg:h-10 h-12 rounded-md p-2" dir="auto" type="password" name="password" placeholder="الباسورد"/>
              <button className="dark:bg-main dark:text-main-comp lg:h-10 h-12 rounded-md p-2 text-xl" type="submit">تسجيل الدخول</button>
            </form>
            {error !== '' && 'error'}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 w-full text-center py-6">
      تم تطويره في 2024 بواسطة توني جورج خادم كنيسة الشهيد العظيم مارجرجس بدمنهور
      </div>
    </>
)
}