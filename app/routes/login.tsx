import { Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/login";
import api from "~/lib/api";
import { AxiosError } from "axios";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { ModeToggle } from "~/components/mode-toggle";
import { Input } from "~/components/ui/input";

const loginSchema = z.object({
  username: z.string()
    .min(4),
  password: z.string()
    .min(1)
});

export async function clientLoader() {
  if (localStorage.getItem('authToken')) {
    return redirect('/');
  }
  return null;
}

export function HydrateFallback() {
  return null;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = await request.formData();
  const formData = {
    username: data.get('username') as string,
    password: data.get('password') as string,
  };
  
  const validation = z.safeParse(loginSchema, formData);
  
  if (!validation.success) {
    return {
      success: false,
      error: "يا سيدي الفاضل اكتب بياناتك فوق عشان تخش جوا",
    };
  }

  const { username, password } = validation.data;

  try {
    const response = await api.post('/auth/login', { username, password });
    console.log(response);
    localStorage.setItem('authToken', response.data.data.access_token);
    return redirect('/');
  } catch (error) {
    if (error instanceof AxiosError) {
      let message = 'حصلت مشكلة غير متوقعة، كلم توني جورج';
      switch (error.status) {
        case 404: 
          message = 'اسم المستخدم مش موجود';
          break;
        case 400:
          message = "يا سيدي الفاضل اكتب بياناتك فوق عشان تخش جوا";
          break;
        case 401:
          message = 'الباسورد غلط';
          break;
        case 429:
          message = 'هدي اعصابك براحة خالص استنى شوية وحاول تاني';
          break;
      }
      return {
        success: false,
        error: message
      };
    }
  }
}

// todo: mode toggle not appearing on mobile screens, because of ripple effect. it makes the button position relative not absolute
export default function Login() {
  const actionState = useActionData<typeof clientAction>();
  return (
    <>
      <ModeToggle className="absolute lg:top-0 lg:right-0 bottom-25 lg:m-4 pl-2 pr-6 lg:px-1 rounded-r-none lg:rounded-md" />
      <div className="h-full flex flex-col">
        <h1 className="title py-6 h-fit text-center font-bold text-6xl select-none text-primary dark:text-foreground font-[almarai]">
          مــفـــتــقــد
        </h1>
        <div className="flex flex-col justify-center size-full">
          <div className="flex flex-col items-center justify-center">
            <Form className="flex flex-col gap-2.5 w-5/7 lg:w-3/7" method="post">
              <Input autoComplete="off" type="text" name="username" placeholder="اسم المستخدم" />
              <Input type="password" name="password" placeholder="الباسورد" />
              <Button type="submit">تسجيل الدخول</Button>
            </Form>
          </div>
          {actionState?.error &&
            <div className="flex flex-col items-center justify-center mt-4">
              <div className="bg-red-500 text-white px-4 py-2 rounded-md">
                {actionState.error}
              </div>
            </div>
          }  
        </div>
      </div>

      <div className="fixed bottom-0 w-full text-center py-6">
        تم تطويره بواسطة توني جورج خادم كنيسة الشهيد العظيم مارجرجس بدمنهور 2024-2025
      </div>
    </>
  )
}