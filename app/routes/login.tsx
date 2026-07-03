import { Form, redirect, useActionData, useNavigation } from "react-router";
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
  
  const validation = loginSchema.safeParse(formData);
  
  if (!validation.success) {
    return {
      success: false,
      error: "يا سيدي الفاضل اكتب بياناتك فوق عشان تخش جوا",
    };
  }

  const { username, password } = validation.data;

  try {
    const response = await api.post('/auth/login', { username, password });
    localStorage.setItem('authToken', response.data.data.access_token);
    localStorage.setItem('isAdmin', response.data.data.is_admin ? 'true' : 'false');
    if (response.data.data.account_id) {
      localStorage.setItem('accountId', String(response.data.data.account_id));
    }
    if (response.data.data.roles) {
      localStorage.setItem('userRoles', response.data.data.roles);
    }
    return redirect('/');
  } catch (error) {
    if (error instanceof AxiosError) {
      let message = 'حصلت مشكلة غير متوقعة، كلم توني جورج';
      switch (error.status) {
        case 400:
          message = "يا سيدي الفاضل اكتب بياناتك فوق عشان تخش جوا";
          break;
        case 401:
          message = 'اسم المستخدم أو الباسورد غلط';
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
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting" || navigation.state === "loading";

  return (
    <>
      <ModeToggle className="absolute lg:top-0 lg:right-0 bottom-25 lg:m-4 pl-2 pr-6 lg:px-1 rounded-r-none lg:rounded-md" />
      <div className="h-full flex flex-col">
        <h1 className="title py-6 h-fit text-center font-bold text-6xl select-none text-primary dark:text-foreground font-[almarai]">
          مــفـــتــقــد
        </h1>
        <div className="flex flex-col justify-center size-full">
          <div className="flex flex-col items-center justify-center">
            <Form className="flex flex-col gap-2.5 w-5/7 lg:w-3/7 login-form" method="post">
              <Input autoComplete="off" type="text" name="username" placeholder="اسم المستخدم" disabled={isSubmitting} />
              <Input autoComplete="current-password" type="password" name="password" placeholder="الباسورد" disabled={isSubmitting} />
              <Button type="submit" loading={isSubmitting}>تسجيل الدخول</Button>
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

      <div className="fixed bottom-0 w-full text-center py-6 login-footer">
        تم تطويره بواسطة توني جورج خادم كنيسة الشهيد العظيم مارجرجس بدمنهور 2024-2025
      </div>
    </>
  )
}
